from django.db import models
from django.contrib.auth.models import User
import os
from django.dispatch import receiver
from django.utils import timezone

class Profile(models.Model):
   
 username =models.CharField(max_length=255 ,primary_key=True )
 email = models.EmailField( )
 user =models.OneToOneField(User , on_delete=models.CASCADE )
 joined_at = models.DateField( auto_now_add=True,editable=False  )
 photo = models.ImageField(blank=True, null =True , upload_to='images/users/')
 first_name= models.CharField(max_length=255 , blank=True , null =True)
 last_name= models.CharField(max_length=255 , blank=True, null =True)
 phone= models.CharField(max_length=30 ,blank=True, null =True)
 country = models.CharField(max_length=255,blank=True, null =True)
 birth_date = models.DateField(blank=True, null =True)
 bio =models.TextField(blank=True, null =True)
 
 class Meta:
   verbose_name = 'Profile'
   verbose_name_plural = 'Profiles'
   ordering = ['username']
 
 def __str__(self):
    return self.username


@receiver(models.signals.pre_delete, sender = Profile)

def dell(sender , instance , using ,  **kwargs):
    
 if instance.photo:
     current_path =instance.photo.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
  
 
 
 
 
# What the booking form sends when the customer picked no hotel. It is a
# sentinel, not a hotel name — never resolve it against the Hotels catalogue.
NO_HOTEL_SENTINEL = 'no_name'

# FR-40 booking lifecycle.
STATUS_CONFIRMED = 'confirmed'
STATUS_CANCELLED = 'cancelled'
BOOKING_STATUSES = [
    (STATUS_CONFIRMED, 'Confirmed'),
    (STATUS_CANCELLED, 'Cancelled'),
]

REFUND_NOT_APPLICABLE = 'not_applicable'
REFUND_PENDING = 'pending'
REFUND_COMPLETED = 'completed'
REFUND_STATUSES = [
    (REFUND_NOT_APPLICABLE, 'Not applicable'),
    (REFUND_PENDING, 'Pending'),
    (REFUND_COMPLETED, 'Completed'),
]


class Trip_per_user(models.Model):
   username = models.ForeignKey(Profile, verbose_name="username", on_delete=models.CASCADE,max_length=255 )
   trip_date = models.DateField(null=True ,blank=True ,)
   hotel_reserve_date= models.DateField( null=True ,blank=True  )
   price = models.DecimalField(max_digits=6 , decimal_places=2,null=True ,blank=True )

   # The booking's trip and hotel. These replaced the free-text trip_name /
   # hotel_name columns: every join used to be a string comparison, which meant
   # a renamed or differently-cased record silently stopped matching.
   #
   # Anything that needs the name reads it through the relation (`trip.name`).
   # Referenced lazily by label because profiles is loaded before hotels in
   # INSTALLED_APPS.
   #
   # PROTECT, not CASCADE: deleting a trip that people have booked should fail
   # loudly rather than quietly erase their booking history.
   trip = models.ForeignKey(
       'trips.Trips', null=True, blank=True, on_delete=models.PROTECT,
       related_name='bookings', verbose_name='trip',
   )
   hotel = models.ForeignKey(
       'hotels.Hotels', null=True, blank=True, on_delete=models.PROTECT,
       related_name='bookings', verbose_name='hotel',
   )

   # FR-38 refuses a review on a booking that is not paid.
   #
   # The default stays True so the rows that predate this field — written when
   # a booking implied payment — keep their meaning and need no data migration.
   # New bookings are created with is_paid=False explicitly in
   # profiles.views.Update_profile_data, because nothing in the PayPal flow
   # persists a payment result yet; confirmation is a manual admin step until
   # FR-40 wires a real capture handler.
   is_paid = models.BooleanField(default=True, verbose_name='Paid / completed')

   # FR-45. `price` stays what the customer actually owes, so every existing
   # reader keeps working; these record how it got there.
   #
   # `original_price` is null on rows that predate promo codes — for those,
   # `price` is the original. The promo_code relation is declared by label
   # because promotions.models imports this module, so profiles cannot import
   # promotions back at module level.
   original_price = models.DecimalField(
       max_digits=6, decimal_places=2, null=True, blank=True,
       verbose_name='price before discount',
   )
   discount_amount = models.DecimalField(
       max_digits=6, decimal_places=2, default=0, verbose_name='discount applied',
   )
   promo_code = models.ForeignKey(
       'promotions.PromoCode', null=True, blank=True, on_delete=models.SET_NULL,
       related_name='bookings', verbose_name='promo code',
   )

   # FR-43. Travellers on this booking; it is what gets taken from — and given
   # back to — the departure's seat pool. Existing rows are single-traveller.
   seats = models.PositiveIntegerField(default=1, verbose_name='travellers')

   # FR-40. Cancelled bookings are kept, not deleted: they stay in the
   # customer's history and remain the record behind any refund owed.
   status = models.CharField(
       max_length=10, choices=BOOKING_STATUSES, default=STATUS_CONFIRMED,
       verbose_name='status',
   )
   cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name='cancelled at')
   cancellation_reason = models.TextField(blank=True, verbose_name='cancellation reason')
   refund_amount = models.DecimalField(
       max_digits=6, decimal_places=2, default=0, verbose_name='refund amount',
   )
   # There is no automated refund in this project — see profiles/cancellation.py.
   # This tracks what an operator still owes the customer.
   refund_status = models.CharField(
       max_length=15, choices=REFUND_STATUSES, default=REFUND_NOT_APPLICABLE,
       verbose_name='refund status',
   )

   @property
   def is_cancelled(self):
     return self.status == STATUS_CANCELLED

   class Meta:
     verbose_name = 'Booking'
     verbose_name_plural = 'Bookings'

   def __str__(self):
    return str(self.username)