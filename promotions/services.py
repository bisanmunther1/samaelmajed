"""The single place a promo code is judged and priced.

Both the dry-run endpoint and the booking flow call `validate_promo_code`, so
what the customer is quoted and what they are actually charged can never drift
apart. The booking flow additionally passes `lock=True`, which takes a row lock
so two concurrent redemptions cannot both slip past the usage limit.
"""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.db.models import F, Q
from django.utils import timezone

from . import errors
from .errors import PromoCodeError
from .models import PERCENTAGE, PromoCode, PromoCodeUsage

TWO_PLACES = Decimal('0.01')
HUNDRED = Decimal('100')


def normalize_code(text):
    return (text or '').strip().upper()


def parse_amount(value):
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError, AttributeError):
        raise PromoCodeError(errors.PROMO_INVALID_AMOUNT)
    if amount < 0:
        raise PromoCodeError(errors.PROMO_INVALID_AMOUNT)
    return amount


def compute_discount(promo, amount):
    if promo.discount_type == PERCENTAGE:
        discount = amount * promo.discount_value / HUNDRED
        if promo.max_discount is not None:
            discount = min(discount, promo.max_discount)
    else:
        discount = promo.discount_value

    # A discount may wipe out the total but never push it below zero.
    discount = min(discount, amount)
    return discount.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def validate_promo_code(code, amount, user, trip=None, lock=False):
    """Returns (promo_code, discount_amount) or raises PromoCodeError.

    `lock=True` selects the row for update so the usage-limit check and the
    increment that follows it are atomic. It is a no-op on SQLite, which
    serialises writers anyway; on Postgres/MySQL it is what makes the limit
    hold under concurrency.
    """
    amount = parse_amount(amount)

    queryset = PromoCode.objects.all()
    if lock:
        queryset = queryset.select_for_update()

    promo = queryset.filter(code=normalize_code(code)).first()
    if promo is None:
        raise PromoCodeError(errors.PROMO_NOT_FOUND)

    if not promo.is_active:
        raise PromoCodeError(errors.PROMO_INACTIVE)

    now = timezone.now()
    if not (promo.valid_from <= now <= promo.valid_until):
        raise PromoCodeError(errors.PROMO_NOT_IN_WINDOW)

    if promo.usage_limit is not None and promo.times_used >= promo.usage_limit:
        raise PromoCodeError(errors.PROMO_USAGE_LIMIT_REACHED)

    if user is not None and promo.usage_limit_per_user is not None:
        used_by_user = PromoCodeUsage.objects.filter(promo_code=promo, user=user).count()
        if used_by_user >= promo.usage_limit_per_user:
            raise PromoCodeError(errors.PROMO_USER_LIMIT_REACHED)

    if amount < promo.min_booking_amount:
        raise PromoCodeError(errors.PROMO_MIN_AMOUNT_NOT_MET)

    # An empty applicable_trips means "every trip"; a populated one is a
    # whitelist, and an unknown trip cannot be on it.
    if promo.applicable_trips.exists():
        if trip is None or not promo.applicable_trips.filter(pk=trip.pk).exists():
            raise PromoCodeError(errors.PROMO_TRIP_NOT_ELIGIBLE)

    return promo, compute_discount(promo, amount)


def active_promo_codes():
    """Codes anyone can use right now.

    Trip-restricted codes are deliberately left out: this feeds a general
    "current offers" list, and a code that fails on most trips would read as
    broken there.
    """
    now = timezone.now()
    return (
        PromoCode.objects
        .filter(is_active=True, valid_from__lte=now, valid_until__gte=now)
        .filter(applicable_trips__isnull=True)
        # Unlimited codes, or ones with uses left.
        .filter(Q(usage_limit__isnull=True) | Q(usage_limit__gt=F('times_used')))
        .order_by('valid_until')
    )
