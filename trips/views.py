from datetime import timedelta

from django.db.models import Max, Min
from django.utils import timezone
from django.utils.dateparse import parse_date

from .models import Trips
from rest_framework.response import Response
from rest_framework.decorators import api_view

from common.filtering import FilterError, apply_trip_filters


@api_view(['POST'])
def send_trip_cards(request , type):

  data = request.data.copy()

  # FR-39 filters ride on the query string and are purely additive: with none
  # of them present this is the same queryset, in the same order, as before.
  params = request.query_params

  base = Trips.objects.filter(type=type,price__lte = data['price'],rate__gte = data['rate'])

  # `available` was hard-filtered here; it only stops being implicit when the
  # caller asks about it explicitly.
  if 'available' not in params:
    base = base.filter(available =True)

  trips = base.order_by(data['order_by'] )

  if data['place'] != 'Any':
     trips = trips.filter(place =data['place'] )

  try:
    trips = apply_trip_filters(trips, params)
  except FilterError as error:
    return Response(error.payload, status =400)

  result = list( trips.values())

  if data['reverse']:
      result.reverse()

  Len = min( data['number_of_images'] , len(result))

  return Response( result[:Len] ,status =200)

@api_view(['GET'])
def trending_places(request , type):

     trips = Trips.objects.filter(type=type , available =True).order_by('num').values()
     trips_array = list(trips)
     Len = min( 9, len(trips_array))

     return Response( trips_array[:Len] ,status = 200)


@api_view(['POST'])
def discounted_places(request):

  trips = Trips.objects.filter( available =True ).order_by('discount').values()

  trips_array = list( trips.values() )

  trips_array.reverse()

  return Response( trips_array[:9] ,status = 200)


@api_view(['GET'])
def filter_options(request):
    """Feeds the FilterBar its destination list and the real price bounds, so
    the frontend never has to hardcode a range."""
    trips = Trips.objects.all()

    places = sorted(
        trips.exclude(place__isnull=True).exclude(place='')
        .values_list('place', flat=True).distinct()
    )
    bounds = trips.aggregate(min_price=Min('price'), max_price=Max('price'))

    return Response({
        'places': places,
        'min_price': bounds['min_price'] if bounds['min_price'] is not None else 0,
        'max_price': bounds['max_price'] if bounds['max_price'] is not None else 0,
    }, status =200)


# How far ahead the availability endpoint looks when no range is given, and the
# widest span it will answer in one call.
DEFAULT_AVAILABILITY_DAYS = 30
MAX_AVAILABILITY_DAYS = 180


@api_view(['GET'])
def trip_availability(request, name):
    """Remaining seats per date for one trip.

    Dates nobody has booked yet have no row, so they report the trip's default
    capacity rather than being absent — the caller gets a continuous calendar.
    """
    trip = Trips.objects.filter(name=name).first()
    if trip is None:
        return Response(
            {'detail': 'الرحلة المطلوبة غير موجودة.', 'code': 'trip_not_found'}, status=404,
        )

    today = timezone.localdate()

    start = parse_date(request.query_params.get('from') or '') or today
    end = parse_date(request.query_params.get('to') or '') or (start + timedelta(days=DEFAULT_AVAILABILITY_DAYS))

    if end < start:
        return Response(
            {'detail': 'نطاق التاريخ غير صحيح.', 'code': 'invalid_date_range'}, status=400,
        )

    span = (end - start).days
    if span > MAX_AVAILABILITY_DAYS:
        end = start + timedelta(days=MAX_AVAILABILITY_DAYS)

    # One query for the dates that exist; the rest fall back to capacity.
    booked = {
        row.date: row
        for row in trip.availability.filter(date__gte=start, date__lte=end)
    }

    days = []
    cursor = start
    while cursor <= end:
        row = booked.get(cursor)
        remaining = row.remaining_seats if row is not None else trip.capacity
        days.append({
            'date': cursor,
            'total_seats': row.total_seats if row is not None else trip.capacity,
            'remaining_seats': remaining,
            'is_sold_out': remaining == 0,
        })
        cursor += timedelta(days=1)

    return Response({'trip': trip.name, 'capacity': trip.capacity, 'days': days}, status=200)
