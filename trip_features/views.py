from django.shortcuts import render
from rest_framework.response import Response
from rest_framework.decorators import api_view
from .models import Trip_features
from trips.models import Trips
from trips.pricing import compute_final_price
# Create your views here.


@api_view(['GET'])
def get_features( request,name ):


  features = Trip_features.objects.filter(name=name).values()[0]

  # The booking flow prices itself from this response (transport + hotel +
  # this) -- without it, a trip with no transport or hotel picked invoiced at
  # $0, even though the card advertises a real price for the trip itself.
  trip = Trips.objects.filter(pk=name).only('price', 'discount').first()
  features['trip_price'] = compute_final_price(trip.price, trip.discount) if trip else 0

  return Response(features ,status =200)

