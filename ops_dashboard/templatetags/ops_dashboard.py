from django import template

from ops_dashboard.services import get_dashboard_snapshot

register = template.Library()


@register.simple_tag
def operations_snapshot():
    """Everything the admin index dashboard renders, in one cached call."""
    return get_dashboard_snapshot()


@register.filter
def booking_status_label(booking):
    """The badge text for a booking row: cancelled beats unpaid beats confirmed."""
    if booking.status == 'cancelled':
        return 'ملغى'
    if not booking.is_paid:
        return 'غير مدفوع'
    return 'مؤكّد'


@register.filter
def booking_status_class(booking):
    if booking.status == 'cancelled':
        return 'is-cancelled'
    if not booking.is_paid:
        return 'is-unpaid'
    return 'is-confirmed'
