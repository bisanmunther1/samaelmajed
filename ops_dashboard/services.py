"""Aggregates for the Jazzmin operations dashboard.

WHY NOT statistics_report.build_statistics
------------------------------------------
The obvious move is to reuse it, and the dashboard this replaces did exactly
that — it called `build_statistics()` three times (week, month, all-time) to
render three numbers. That is what made the old dashboard expensive: each call
runs six independent GROUP BY queries for series the dashboard never rendered,
so roughly thirty queries were issued to display three integers, on every single
admin page load.

It also cannot answer this dashboard's questions: `build_statistics` reports
counts only — there is no revenue anywhere in it.

So the numbers here are computed directly, in a handful of conditional
aggregates. What is *not* re-derived is the business rule: `STATUS_CANCELLED`
is imported from profiles.models, the same source statistics_report imports it
from, so "cancelled bookings do not count" cannot drift between the two.
`statistics_report` itself is untouched.

EVERY figure excludes cancelled bookings unless its name says otherwise.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Avg, Count, DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from hotels.models import Hotels
from partners.models import Partner
from profiles.models import REFUND_PENDING, STATUS_CANCELLED, Trip_per_user
from promotions.models import PromoCode
from reviews.models import Review
from trips.models import TripAvailability, Trips

# The dashboard renders on every admin page view, so the aggregates are cached
# rather than recomputed on each one.
#
# The trade-off is staleness against query load, and it is deliberately tuned
# towards freshness: 5 seconds means an operator who approves a partner or marks
# a refund settled sees the change on their next refresh, which is what makes
# the attention panel trustworthy. The cost is that a burst of admin navigation
# recomputes more often — acceptable, because the cold path is 12 queries and
# the warm path is 1. Raise this only if the aggregates get materially more
# expensive than that.
CACHE_KEY = 'ops_dashboard_snapshot'
CACHE_SECONDS = 5

# Thresholds for the attention panel.
NEAR_CAPACITY_RATIO = 0.9
NEAR_CAPACITY_DAYS = 14
LOW_RATING_MAX = 2
LOW_RATING_DAYS = 30
PROMO_EXPIRY_DAYS = 7
UPCOMING_DEPARTURES = 8
RECENT_BOOKINGS = 8

MONEY = DecimalField(max_digits=12, decimal_places=2)
ZERO = Decimal('0.00')


def _money(expression):
    """Sum that yields 0.00 rather than None when nothing matches."""
    return Coalesce(expression, ZERO, output_field=MONEY)


def _percent_change(current, previous):
    """Percent change, or None when there is no previous figure to compare to —
    'up 100%' from a zero baseline would be a lie."""
    if not previous:
        return None
    return round(((current - previous) / previous) * 100, 1)


def booking_totals(today):
    """One query: every booking count and money figure the dashboard shows."""
    month_start = today.replace(day=1)
    previous_month_end = month_start - timedelta(days=1)
    previous_month_start = previous_month_end.replace(day=1)

    live = ~Q(status=STATUS_CANCELLED)

    return Trip_per_user.objects.aggregate(
        # `total` is the one figure that deliberately counts everything: its
        # label breaks it down into confirmed vs cancelled.
        total=Count('pk'),
        confirmed=Count('pk', filter=live),
        cancelled=Count('pk', filter=Q(status=STATUS_CANCELLED)),

        this_month=Count('pk', filter=live & Q(trip_date__gte=month_start)),
        last_month=Count('pk', filter=live & Q(
            trip_date__gte=previous_month_start, trip_date__lte=previous_month_end,
        )),

        revenue=_money(Sum('price', filter=live)),
        revenue_this_month=_money(Sum('price', filter=live & Q(trip_date__gte=month_start))),
        average_value=Avg('price', filter=live),

        # Attention panel, folded in rather than costing their own queries.
        unpaid=Count('pk', filter=live & Q(is_paid=False)),
        refunds_pending=Count('pk', filter=Q(refund_status=REFUND_PENDING)),
        refunds_owed=_money(Sum('refund_amount', filter=Q(refund_status=REFUND_PENDING))),
    )


def catalogue_totals(today):
    """Two queries: the trip/hotel catalogue and upcoming seat occupancy."""
    trips = Trips.objects.aggregate(
        total=Count('pk'),
        available=Count('pk', filter=Q(available=True)),
    )
    hotels = Hotels.objects.count()

    # The near-capacity count rides along here rather than costing its own
    # query: both scan TripAvailability for upcoming dates.
    horizon = today + timedelta(days=NEAR_CAPACITY_DAYS)
    seats = TripAvailability.objects.filter(date__gte=today).aggregate(
        booked=Coalesce(Sum('booked_seats'), 0),
        total=Coalesce(Sum('total_seats'), 0),
        near_capacity=Count('pk', filter=Q(
            date__lte=horizon, total_seats__gt=0,
            booked_seats__gte=F('total_seats') * NEAR_CAPACITY_RATIO,
        )),
    )
    occupancy = round((seats['booked'] / seats['total']) * 100, 1) if seats['total'] else 0

    return {
        'trips_total': trips['total'],
        'trips_available': trips['available'],
        'hotels_total': hotels,
        'seats_booked': seats['booked'],
        'seats_total': seats['total'],
        'occupancy': occupancy,
        'near_capacity': seats['near_capacity'],
    }


def people_totals(today):
    """Three queries: users, partners, reviews."""
    partners = Partner.objects.aggregate(
        total=Count('pk'),
        approved=Count('pk', filter=Q(is_approved=True)),
        pending=Count('pk', filter=Q(is_approved=False)),
    )

    low_rating_since = today - timedelta(days=LOW_RATING_DAYS)
    reviews = Review.objects.aggregate(
        total=Count('pk', filter=Q(is_approved=True)),
        average=Avg('rating', filter=Q(is_approved=True)),
        low_recent=Count('pk', filter=Q(
            rating__lte=LOW_RATING_MAX, created_at__date__gte=low_rating_since,
        )),
    )

    return {
        'users_total': User.objects.count(),
        'partners_total': partners['total'],
        'partners_approved': partners['approved'],
        'partners_pending': partners['pending'],
        'reviews_total': reviews['total'],
        'reviews_average': round(reviews['average'], 2) if reviews['average'] is not None else 0,
        'low_reviews': reviews['low_recent'],
    }


def attention_extras(today):
    """Two queries for the checks that cannot fold into the aggregates above."""
    # Bookable trips that have no seat pool defined for any upcoming date: they
    # will silently fall back to the trip default the first time someone books.
    trips_without_capacity = Trips.objects.filter(available=True).exclude(
        availability__date__gte=today,
    ).count()

    now = timezone.now()
    expiring_promos = PromoCode.objects.filter(
        is_active=True, valid_until__gte=now,
        valid_until__lte=now + timedelta(days=PROMO_EXPIRY_DAYS),
    ).count()

    return {
        'trips_without_capacity': trips_without_capacity,
        'expiring_promos': expiring_promos,
    }


def upcoming_departures(today):
    """One query. Next departures with seats and the revenue booked against them."""
    rows = (
        TripAvailability.objects
        .filter(date__gte=today)
        .select_related('trip')
        .order_by('date', 'trip_id')[:UPCOMING_DEPARTURES]
    )

    departures = []
    for row in rows:
        occupancy = round((row.booked_seats / row.total_seats) * 100) if row.total_seats else 0
        departures.append({
            'id': row.pk,
            'trip': row.trip_id,
            'date': row.date,
            'booked': row.booked_seats,
            'total': row.total_seats,
            'occupancy': occupancy,
        })
    return departures


def departure_revenue(departures):
    """One query for the revenue behind every departure shown, keyed by
    (trip, date) — rather than one query per row."""
    if not departures:
        return {}

    pairs = {(entry['trip'], entry['date']) for entry in departures}
    dates = {entry['date'] for entry in departures}
    trip_ids = {entry['trip'] for entry in departures}

    rows = (
        Trip_per_user.objects
        .exclude(status=STATUS_CANCELLED)
        .filter(trip_id__in=trip_ids, trip_date__in=dates)
        .values('trip_id', 'trip_date')
        .annotate(revenue=_money(Sum('price')))
    )

    return {
        (row['trip_id'], row['trip_date']): row['revenue']
        for row in rows
        if (row['trip_id'], row['trip_date']) in pairs
    }


def recent_bookings():
    """One query. `select_related` so rendering the trip and customer columns
    does not issue a query per row."""
    return list(
        Trip_per_user.objects
        .select_related('username', 'trip')
        .order_by('-pk')[:RECENT_BOOKINGS]
    )


def build_snapshot():
    """Everything the dashboard renders, in one pass."""
    today = timezone.localdate()

    bookings = booking_totals(today)
    catalogue = catalogue_totals(today)
    people = people_totals(today)
    extras = attention_extras(today)

    departures = upcoming_departures(today)
    revenue_by_departure = departure_revenue(departures)
    for entry in departures:
        entry['revenue'] = revenue_by_departure.get((entry['trip'], entry['date']), ZERO)

    change = _percent_change(bookings['this_month'], bookings['last_month'])

    # Only rows with something to act on; the panel renders empty when the
    # operator has nothing waiting.
    attention = [
        {
            'key': 'unpaid_bookings', 'label': 'حجوزات غير مدفوعة',
            'count': bookings['unpaid'], 'url': '/admin/profiles/trip_per_user/?is_paid__exact=0',
        },
        {
            'key': 'refunds_pending', 'label': 'مستردات قيد التسوية',
            'count': bookings['refunds_pending'],
            'note': f"{bookings['refunds_owed'].quantize(ZERO)}$",
            'url': '/admin/profiles/trip_per_user/?refund_status__exact=pending',
        },
        {
            'key': 'partners_pending', 'label': 'شركاء بانتظار الاعتماد',
            'count': people['partners_pending'],
            'url': '/admin/partners/partner/?is_approved__exact=0',
        },
        {
            'key': 'low_reviews', 'label': 'تقييمات منخفضة (آخر 30 يوماً)',
            'count': people['low_reviews'], 'url': '/admin/reviews/review/?rating__lte=2',
        },
        {
            'key': 'near_capacity', 'label': 'مغادرات قادمة قاربت الامتلاء',
            'count': catalogue['near_capacity'], 'url': '/admin/trips/tripavailability/',
        },
        {
            'key': 'trips_without_capacity', 'label': 'رحلات متاحة بلا سعة مُعرَّفة',
            'count': extras['trips_without_capacity'], 'url': '/admin/trips/trips/?available__exact=1',
        },
        {
            'key': 'expiring_promos', 'label': 'أكواد خصم تنتهي خلال 7 أيام',
            'count': extras['expiring_promos'], 'url': '/admin/promotions/promocode/?is_active__exact=1',
        },
    ]

    return {
        'bookings': bookings,
        'bookings_change': change,
        'catalogue': catalogue,
        'people': people,
        'attention': [row for row in attention if row['count']],
        'departures': departures,
    }


def get_dashboard_snapshot():
    """Cached snapshot. `recent_bookings` is left out of the cache so the newest
    bookings are always current — it is a single indexed query."""
    snapshot = cache.get(CACHE_KEY)
    if snapshot is None:
        snapshot = build_snapshot()
        cache.set(CACHE_KEY, snapshot, CACHE_SECONDS)

    return {**snapshot, 'recent_bookings': recent_bookings()}
