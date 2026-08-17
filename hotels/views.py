 
from rest_framework.response import Response
 
 
from rest_framework.decorators import api_view
 
from .models import Hotels



@api_view(['POST'])
def get_hotel(request ):

     data = request.data.copy()
     print("data['name'] ",data['name'])
     hotels = Hotels.objects.filter(trip_name = data['trip_name'] , name = data['name']).values()
     return Response(  list(hotels) , status = 200 )


@api_view(['GET'])
def get_hotels_price(request , trip_name):
    hotels = Hotels.objects.filter(trip_name = trip_name).values('price','name')
    
    hotel_arr =list(hotels)

    part1=[] #price
    part2=[] #name
    all = []
    
    for i in hotel_arr:
        part1.append(i['price'])
        part2.append(i['name'])
 
    all.append(part1)
    all.append(part2)
 
    return Response(  all  , status = 200 )