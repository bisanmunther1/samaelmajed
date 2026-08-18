from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from decimal import Decimal

from django.db import transaction
from django.db.models import F

from . import errors
from .errors import BookingError, booking_error
from .cancellation import cancel_booking, preview_cancellation
from .models import NO_HOTEL_SENTINEL, Profile , Trip_per_user
from hotels.models import Hotels
from promotions.errors import PromoCodeError
from promotions.models import PromoCode, PromoCodeUsage
from promotions.services import parse_amount, validate_promo_code
from trips.availability import CapacityError, reserve_seats
from trips.models import Trips
import os


def _parse_seats(raw):
    """Travellers on a booking. Absent means one, which is how every booking
    behaved before FR-43."""
    if raw is None or str(raw).strip() == '':
        return 1
    try:
        seats = int(str(raw).strip())
    except (TypeError, ValueError):
        raise BookingError(errors.INVALID_SEATS)
    if seats < 1:
        raise BookingError(errors.INVALID_SEATS)
    return seats


def _booking_user(username):
    """The auth user behind a booking. This endpoint identifies the customer by
    their Profile username rather than a token (a pre-existing, documented gap),
    and the per-user promo limit needs the User the profile belongs to."""
    profile = Profile.objects.filter(username=username).select_related('user').first()
    return profile.user if profile is not None else None


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
    row.trip_date =  data['trip_date']
    row.trip = row_trip_update
    if hotel is not None:
      row.hotel = hotel
      row.hotel_reserve_date =data['hotel_reserve_date']

    raw_promo_code = data.get('promo_code')

    try:
      seats = _parse_seats(data.get('seats'))
    except BookingError as error:
      return Response(error.payload, status =400)

    # Everything below is one unit of work: the usage-limit check, the counter
    # increment and the booking that justifies them must not come apart.
    try:
      with transaction.atomic():
        original_price = parse_amount(data['price'])
        discount = Decimal('0.00')
        promo = None

        if raw_promo_code:
          # Re-validated server-side; the client's arithmetic is never trusted.
          promo, discount = validate_promo_code(
            code = raw_promo_code,
            amount = original_price,
            user = _booking_user(data['username']),
            trip = row_trip_update,
            lock = True,
          )

        row.original_price = original_price
        row.discount_amount = discount
        row.price = original_price - discount
        row.promo_code = promo
        row.seats = seats

        # FR-43: take the seats under the same transaction as everything else,
        # so a rejection here unwinds the promo redemption too.
        try:
          reserve_seats(row_trip_update, row.trip_date, seats)
        except CapacityError as full:
          raise BookingError(errors.NO_SEATS_AVAILABLE, remaining=full.remaining)

        old_number = row_trip_update.num

        row_trip_update.num = old_number + 1

        row.save()

        row_trip_update.save()

        if promo is not None:
          PromoCodeUsage.objects.create(
            promo_code = promo, user = _booking_user(data['username']),
            booking = row, discount_amount = discount,
          )
          PromoCode.objects.filter(pk = promo.pk).update(times_used = F('times_used') + 1)

    except PromoCodeError as error:
      return Response(error.payload, status =400)
    except BookingError as error:
      return Response(error.payload, status =400)

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
    # FR-43/FR-40 additions — the profile page marks cancelled bookings and
    # shows what is owed. Purely additive; no existing key changed.
    'seats', 'status', 'cancelled_at', 'cancellation_reason',
    'refund_amount', 'refund_status', 'original_price', 'discount_amount',
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
         
 
 

class BookingCancellationPreview(APIView):
  """What cancelling this booking would refund, without cancelling it."""

  permission_classes = (IsAuthenticated,)

  def get(self, request, booking_id, *args, **kwargs):
    booking = _owned_booking(request, booking_id)
    if isinstance(booking, Response):
      return booking

    return Response(preview_cancellation(booking), status =200)


class BookingCancel(APIView):
  """Cancels a booking: refund on paper, seats released, promo code freed."""

  permission_classes = (IsAuthenticated,)

  def post(self, request, booking_id, *args, **kwargs):
    booking = _owned_booking(request, booking_id)
    if isinstance(booking, Response):
      return booking

    try:
      cancelled = cancel_booking(booking, reason=request.data.get('reason', ''))
    except BookingError as error:
      return Response(error.payload, status =400)

    return Response({
      'booking': cancelled.pk,
      'status': cancelled.status,
      'refund_amount': cancelled.refund_amount,
      'refund_status': cancelled.refund_status,
      'cancelled_at': cancelled.cancelled_at,
    }, status =200)


def _owned_booking(request, booking_id):
  """The booking, if this user may act on it. Returns a Response on failure so
  the callers stay short."""
  booking = (
    Trip_per_user.objects
    .select_related('username__user', 'trip')
    .filter(pk=booking_id)
    .first()
  )

  if booking is None:
    return Response(booking_error(errors.BOOKING_NOT_FOUND), status =404)

  user = request.user
  if not (user.is_staff or booking.username.user_id == user.pk):
    # Same body as "not found": whether a booking exists is not something a
    # stranger should be able to probe.
    return Response(booking_error(errors.BOOKING_NOT_FOUND), status =404)

  return booking
