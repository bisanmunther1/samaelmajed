from django.db.models import Max, Min
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
