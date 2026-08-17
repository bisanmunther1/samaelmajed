 
from .models import Trips  
from rest_framework.response import Response
from rest_framework.decorators import api_view
 
 

@api_view(['POST']) 
def send_trip_cards(request , type):
    
  data = request.data.copy()
  trips = Trips.objects.filter(type=type,price__lte = data['price'],rate__gte = data['rate'],available =True ).order_by(data['order_by'] )
  
  if data['place'] != 'Any':
     trips = trips.filter(place =data['place'] )
      
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
  