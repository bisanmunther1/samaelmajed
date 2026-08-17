from django import template
from django.utils import timezone

from statistics_report.services import build_statistics

register = template.Library()


@register.simple_tag
def get_dashboard_stats():
    """At-a-glance numbers for the admin index dashboard, reusing the FR-37
    aggregation logic (statistics_report.services.build_statistics) rather
    than writing new queries."""
    today = timezone.localdate()
    week_start = today - timezone.timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    bookings_this_week = build_statistics(start_date=week_start)['total_bookings']
    bookings_this_month = build_statistics(start_date=month_start)['total_bookings']
    total_users = build_statistics()['new_users']

    return {
        'bookings_this_week': bookings_this_week,
        'bookings_this_month': bookings_this_month,
        'total_users': total_users,
    }
