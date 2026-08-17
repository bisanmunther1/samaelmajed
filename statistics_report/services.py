from django.db.models import Count, OuterRef, Q, Subquery

from profiles.models import Profile, Trip_per_user
from trip_features.models import Trip_features
from trips.models import Trips


def build_statistics(start_date=None, end_date=None):

    bookings = Trip_per_user.objects.all()
    if start_date:
        bookings = bookings.filter(trip_date__gte=start_date)
    if end_date:
        bookings = bookings.filter(trip_date__lte=end_date)

    total_bookings = bookings.count()

    most_booked_trips = list(
        bookings.values('trip_name')
        .annotate(bookings_count=Count('pk'))
        .order_by('-bookings_count')
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

    place_subquery = Trips.objects.filter(name=OuterRef('trip_name')).values('place')[:1]
    bookings_by_destination = list(
        bookings.annotate(place=Subquery(place_subquery))
        .values('place')
        .annotate(bookings_count=Count('pk'))
        .order_by('-bookings_count')
    )

    bookings_by_hotel = list(
        bookings.exclude(hotel_name__isnull=True)
        .exclude(hotel_name='')
        .values('hotel_name')
        .annotate(bookings_count=Count('pk'))
        .order_by('-bookings_count')
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
            'bookings_count': bookings.filter(trip_name__in=plane_trip_names).count(),
        },
        {
            'transport_method': 'bus',
            'bookings_count': bookings.filter(trip_name__in=bus_trip_names).count(),
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
