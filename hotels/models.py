from django.db import models
from trip_features.models import Trip_features
import os
from django.dispatch import receiver


class Hotels(models.Model):

    trip_name = models.ForeignKey(Trip_features, verbose_name="trip name", max_length=255 ,on_delete=models.CASCADE)

    h_photo1 = models.ImageField(upload_to='images/reserve/hotels' , verbose_name = 'hotel photo 1' , null=True ,blank=True)
    h_photo2 = models.ImageField(upload_to='images/reserve/hotels' , verbose_name = 'hotel photo 2' , null=True ,blank=True)
    h_photo3 = models.ImageField(upload_to='images/reserve/hotels' , verbose_name = 'hotel photo 3' , null=True ,blank=True)
    
    # HAZARD (two of them): as the primary key, this name is what every booking
    # and review references, so editing it strands those references on a row
    # that no longer exists rather than renaming the hotel — the admin locks the
    # field on change to keep that path shut. And because it is the *whole* key,
    # hotel names are unique across the entire site: two different trips cannot
    # each offer a hotel called "Hilton". Both are fixed by a surrogate integer
    # primary key with uniqueness moved to (trip_name, name).
    name = models.CharField(max_length=150  ,verbose_name="hotel name :", primary_key = True)
    price = models.DecimalField(max_digits=6 , decimal_places=2, verbose_name="price per night" , null=True ,blank=True ,default=0)
    rate = models.DecimalField(max_digits=2, decimal_places=1, verbose_name="rate" , null=True ,blank=True ,default=0)    
    wifi  = models.BooleanField(default = False ,verbose_name="wifi")
    pool  = models.BooleanField(default = False ,verbose_name="Swimming pool")
    restaurant  = models.BooleanField(default = False ,verbose_name="restaurant") 
    car_parking  = models.BooleanField(default = False ,verbose_name="Car Parking ") 
    air_conditioning = models.BooleanField(default = False ,verbose_name="Air Conditioning") 
    room_services = models.BooleanField(default = False ,verbose_name="Room Services ") 
    beachfront = models.BooleanField(default = False ,verbose_name="Beachfront") 
    gym = models.BooleanField(default = False ,verbose_name="Gym") 
    cinema = models.BooleanField(default = False ,verbose_name="Cinema")

    # Denormalized review aggregates (FR-38), maintained by reviews/signals.py.
    # Kept separate from `rate` above, which remains the editorial rating.
    average_rating = models.DecimalField(
        max_digits=3, decimal_places=2, default=0,
        editable=False, verbose_name='Average review rating',
    )
    reviews_count = models.PositiveIntegerField(
        default=0, editable=False, verbose_name='Number of reviews',
    )

    # FR-46. NULL means the platform owns this hotel: it stays admin-managed
    # and no partner can reach it.
    partner = models.ForeignKey(
        'partners.Partner', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='hotels', verbose_name='owning partner',
    )

    class Meta:
     verbose_name = 'Hotel'
     verbose_name_plural = 'Hotels'
     ordering = ['name']
    
    def __str__(self):
     return str(self.name)

 
 
@receiver(models.signals.pre_delete, sender = Hotels)

def dell(sender , instance , using ,  **kwargs):
    
 if instance.h_photo1:
     current_path =instance.h_photo1.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
         
 if instance.h_photo2:
     current_path =instance.h_photo2.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)

 if instance.h_photo3:
     current_path =instance.h_photo3.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
