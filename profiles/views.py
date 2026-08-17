from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from . import errors
from .errors import booking_error
from .models import NO_HOTEL_SENTINEL, Profile , Trip_per_user
from hotels.models import Hotels
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

    # The request payload is unchanged — the client still sends names. They are
    # resolved to real records here, and an unknown name is now rejected with a
    # coded error instead of being stored as an unmatched string.
    row_trip_update = Trips.objects.filter(name = data['trip_name']).first()

    if row_trip_update is None:
      return Response(booking_error(errors.TRIP_NOT_FOUND), status =400)

    if not row_trip_update.available:
      return Response(booking_error(errors.TRIP_NOT_AVAILABLE), status =400)

    raw_hotel_name = data['hotel_name']
    hotel = None

    if raw_hotel_name and raw_hotel_name != NO_HOTEL_SENTINEL:
      hotel = Hotels.objects.filter(name = raw_hotel_name).first()
      if hotel is None:
        return Response(booking_error(errors.HOTEL_NOT_FOUND), status =400)

    duplicate = Trip_per_user.objects.filter(
      username_id = data['username'],
      trip = row_trip_update,
      trip_date = data['trip_date'],
      hotel = hotel,
    ).exists()

    if duplicate:
      return Response(status =200)

    row = Trip_per_user(username_id = data['username'] )
    # Set explicitly rather than by changing the model default: this endpoint
    # records an intent to book, and nothing downstream of PayPal reports back
    # that the money actually moved. Staff confirm payment in the admin, and
    # only then can the booking be reviewed (FR-38).
    row.is_paid = False
    row.price = data['price']
    row.trip_date =  data['trip_date']
    row.trip = row_trip_update
    if hotel is not None:
      row.hotel = hotel
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
     
          

# The exact keys this endpoint has always published. Profile.js reads
# trip_name / hotel_name off each row, so they stay in the payload — sourced
# from the linked records now instead of from free-text columns.
BOOKING_ROW_FIELDS = [
    'id', 'username_id', 'trip_date', 'hotel_reserve_date', 'price', 'is_paid',
]


@api_view(['GET'])
def send_profile_data(request,name):

    trip_per_user = Trip_per_user.objects.filter(username_id = name).values(
      *BOOKING_ROW_FIELDS, 'trip__name', 'hotel__name',
    )

    if trip_per_user == None :
     return Response( status =404)

    result = [
      {
        **{field: row[field] for field in BOOKING_ROW_FIELDS},
        'trip_name': row['trip__name'],
        'hotel_name': row['hotel__name'],
      }
      for row in trip_per_user
    ]

    return  Response( result  )
         
 
 