from django.db.models import Count, Q

from profiles.models import STATUS_CANCELLED, Profile, Trip_per_user
from trip_features.models import Trip_features


def _rename(rows, source_key, output_key):
    """Relabels a grouped queryset's join key to the name the API already
    publishes, so the FK conversion is invisible to every client."""
    return [
        {output_key: row[source_key], 'bookings_count': row['bookings_count']}
        for row in rows
    ]


def build_statistics(start_date=None, end_date=None):

    # FR-40: a cancelled booking is not business that happened. Excluded once,
    # here, because every booking figure below derives from this queryset —
    # totals, most-booked trips, over-time, destination, hotel and transport.
    # (There is no revenue aggregation in this module; it reports counts only.)
    bookings = Trip_per_user.objects.exclude(status=STATUS_CANCELLED)
    if start_date:
        bookings = bookings.filter(trip_date__gte=start_date)
    if end_date:
        bookings = bookings.filter(trip_date__lte=end_date)

    total_bookings = bookings.count()

    # Grouped through the foreign key rather than the old free-text column, so
    # a booking can no longer land in its own bucket because of a renamed or
    # differently-cased trip name. The output key stays `trip_name`.
    most_booked_trips = _rename(
        bookings.filter(trip__isnull=False)
        .values('trip__name')
        .annotate(bookings_count=Count('pk'))
        .order_by('-bookings_count'),
        'trip__name', 'trip_name',
    )

    bookings_over_time = [
        {'date': row['trip_date'], 'bookings_count': row['bookings_count']}
        for row in bookings.exclude(trip_date__isnull=True)
            .values('trip_date')
            .annotate(bookings_count=Count('pk'))
            .order_by('trip_date')
    ]

    new_users_qs = Profile.objects.all()
    if start_date:
        new_users_qs = new_users_qs.filter(joined_at__gte=start_date)
    if end_date:
        new_users_qs = new_users_qs.filter(joined_at__lte=end_date)
    new_users = new_users_qs.count()

    new_users_over_time = [
        {'date': row['joined_at'], 'new_users_count': row['new_users_count']}
        for row in new_users_qs.exclude(joined_at__isnull=True)
            .values('joined_at')
            .annotate(new_users_count=Count('pk'))
            .order_by('joined_at')
    ]

    # A plain join now. This used to be a correlated Subquery matching
    # Trips.name against the booking's free-text trip_name, which returned NULL
    # for any booking whose stored name no longer matched a trip — those
    # bookings were silently grouped under an empty destination.
    bookings_by_destination = _rename(
        bookings.filter(trip__isnull=False)
        .values('trip__place')
        .annotate(bookings_count=Count('pk'))
        .order_by('-bookings_count'),
        'trip__place', 'place',
    )

    bookings_by_hotel = _rename(
        bookings.filter(hotel__isnull=False)
        .values('hotel__name')
        .annotate(bookings_count=Count('pk'))
        .order_by('-bookings_count'),
        'hotel__name', 'hotel_name',
    )

    # Trip_per_user has no field recording which transport a booking used, so
    # a booking is attributed to a transport method if the trip it booked
    # offers that method (a trip offering both plane and bus access counts
    # toward both totals).
    plane_q = Q()
    bus_q = Q()
    for i in range(1, 6):
        plane_q |= Q(**{f'access_plane_{i}': True})
        bus_q |= Q(**{f'access_bus_{i}': True})

    plane_trip_names = Trip_features.objects.filter(plane_q).values_list('name', flat=True)
    bus_trip_names = Trip_features.objects.filter(bus_q).values_list('name', flat=True)

    bookings_by_transport = [
        {
            'transport_method': 'plane',
            'bookings_count': bookings.filter(trip_id__in=plane_trip_names).count(),
        },
        {
            'transport_method': 'bus',
            'bookings_count': bookings.filter(trip_id__in=bus_trip_names).count(),
        },
    ]

    return {
        'start_date': start_date,
        'end_date': end_date,
        'total_bookings': total_bookings,
        'most_booked_trips': most_booked_trips,
        'bookings_over_time': bookings_over_time,
        'new_users': new_users,
        'new_users_over_time': new_users_over_time,
        'bookings_by_destination': bookings_by_destination,
        'bookings_by_hotel': bookings_by_hotel,
        'bookings_by_transport': bookings_by_transport,
    }
