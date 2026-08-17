from django.urls import path
from . import views

urlpatterns = [
      
     path('send_hotel/', views.get_hotel, name ='hotel'),
     path('get_prices/<str:trip_name>/', views.get_hotels_price, name ='hotels prices'),
   
]