from django.urls import path
from . import views

urlpatterns = [
 
    path( "send_trip_cards/<str:type>/" , views.send_trip_cards , name="trip data"  ),
    path( "trending/<str:type>/" , views.trending_places , name="trending places"),
    path( "discount/" , views.discounted_places , name="discounted places"),
]
