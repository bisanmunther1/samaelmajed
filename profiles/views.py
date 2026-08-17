from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from .models import Profile , Trip_per_user
from trips.models import Trips
import os


from django.core.serializers import serialize

class Update_data(APIView):
  parser_classes =(MultiPartParser , FormParser)
  permission_classes = (IsAuthenticated,)

  def post(self , request , *args, **kwargs):

    data = request.data.copy()
    row = Profile.objects.get(username = data['username'])

    row.first_name = data['firstname']
    row.last_name =  data['lastname']
    row.bio = data['bio']
    row.country = data['country']
    row.phone = data['phone']
    row.birth_date=data['birth_date']

    if request.FILES: # when update the image delete the old one in its location

     file_name=str(row.photo)
     file_path = os.path.join(settings.MEDIA_ROOT , file_name)

     if os.path.exists(file_path) and len(file_name) > 0:

       os.remove(file_path)

     row.photo =  request.FILES['photo']
    
    row.save()
    return Response( status =200)
   

class Update_profile_data(APIView):
 
  def post(self , request , *args, **kwargs):
  
    data = request.data.copy()

    row_trip_update=Trips.objects.get(name = data['trip_name'])

    if not row_trip_update.available:
      return Response(status =400)

    hotel_name = data['hotel_name'] if data['hotel_name'] != 'no_name' else None

    duplicate = Trip_per_user.objects.filter(
      username_id = data['username'],
      trip_name = data['trip_name'],
      trip_date = data['trip_date'],
      hotel_name = hotel_name,
    ).exists()

    if duplicate:
      return Response(status =200)

    row = Trip_per_user(username_id = data['username'] )
    row.price = data['price']
    row.trip_date =  data['trip_date']
    row.trip_name = data['trip_name']
    if hotel_name is not None:
      row.hotel_name = hotel_name
      row.hotel_reserve_date =data['hotel_reserve_date']


    old_number = row_trip_update.num
    
    row_trip_update.num = old_number + 1
     
    row.save()
    
    row_trip_update.save()
    
    return Response( status =200)
 


 
 
@api_view(['GET'])
def send_data(request,name):
   
  
    profile = Profile.objects.filter(username = name).values()
 
    if profile == None :
     return Response( status =404 )
     
    return  Response( profile[0]  )
     
          

@api_view(['GET'])
def send_profile_data(request,name):
 
    trip_per_user = Trip_per_user.objects.filter(username_id = name).values()
 
    if trip_per_user == None :
     return Response( status =404)
     
    return  Response(list(trip_per_user )  )
         
 
 