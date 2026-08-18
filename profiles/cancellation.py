"""FR-40 — cancelling a booking.

Cancelling is not a delete. The row stays, flagged, because it is the customer's
history and the record behind whatever refund is owed.

REFUNDS ARE NOT AUTOMATED. This project has no PayPal capture (see Paypal.js —
`onApprove` never calls the backend), so there is no charge to reverse
programmatically and no fake refund call is made here. Cancelling computes what
is owed and leaves `refund_status='pending'`; an operator settles it and marks
it completed from the Jazzmin admin.
"""

from django.db import transaction
from django.utils import timezone

from trips.availability import release_seats

from . import errors, policies
from .errors import BookingError
from .models import (
    REFUND_NOT_APPLICABLE, REFUND_PENDING, STATUS_CANCELLED, Trip_per_user,
)


def days_until_departure(booking, today=None):
    today = today or timezone.localdate()
    if booking.trip_date is None:
        return 0
    return (booking.trip_date - today).days


def assert_cancellable(booking, today=None):
    """Raises BookingError unless this booking can still be cancelled."""
    if booking.status == STATUS_CANCELLED:
        raise BookingError(errors.BOOKING_ALREADY_CANCELLED)

    # Departing today still counts as cancellable — at zero refund.
    if booking.trip_date is not None and booking.trip_date < (today or timezone.localdate()):
        raise BookingError(errors.TRIP_ALREADY_DEPARTED)


def preview_cancellation(booking, today=None):
    """What cancelling would refund, without cancelling."""
    days = days_until_departure(booking, today)
    tier, amount = policies.refund_amount(booking.price, days)

    return {
        'booking': booking.pk,
        'price': booking.price,
        'days_until_departure': days,
        'refund_tier': tier,
        'refund_rate': policies.refund_rate(tier),
        'refund_amount': amount,
        'can_cancel': booking.status != STATUS_CANCELLED and (
            booking.trip_date is None or booking.trip_date >= (today or timezone.localdate())
        ),
    }


def _reverse_promo_usage(booking):
    """Gives the promo code back. Imported here rather than at module level
    because promotions imports profiles."""
    from django.db.models import F

    from promotions.models import PromoCode, PromoCodeUsage

    usages = list(PromoCodeUsage.objects.filter(booking=booking))
    for usage in usages:
        PromoCode.objects.filter(pk=usage.promo_code_id).update(
            times_used=F('times_used') - 1,
        )
    PromoCodeUsage.objects.filter(booking=booking).delete()

    # `booking.promo_code` and `discount_amount` are deliberately left in place:
    # they are the record of what this booking was priced at, and the refund is
    # computed from the discounted `price` the customer actually paid.
    return len(usages)


@transaction.atomic
def cancel_booking(booking, reason='', today=None):
    """Cancels, refunds on paper, releases the seats and frees the promo code —
    all or nothing."""
    # Re-read under the transaction so two concurrent cancels cannot both pass
    # the already-cancelled check and release the seats twice.
    booking = Trip_per_user.objects.select_for_update().get(pk=booking.pk)

    assert_cancellable(booking, today)

    days = days_until_departure(booking, today)
    tier, amount = policies.refund_amount(booking.price, days)

    booking.status = STATUS_CANCELLED
    booking.cancelled_at = timezone.now()
    booking.cancellation_reason = reason or ''
    booking.refund_amount = amount
    booking.refund_status = REFUND_PENDING if amount > 0 else REFUND_NOT_APPLICABLE
    booking.save(update_fields=[
        'status', 'cancelled_at', 'cancellation_reason', 'refund_amount', 'refund_status',
    ])

    if booking.trip_id and booking.trip_date:
        release_seats(booking.trip, booking.trip_date, booking.seats)

    _reverse_promo_usage(booking)

    return booking
