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
  
 
 
 
 
class Trip_per_user(models.Model):
   username = models.ForeignKey(Profile, verbose_name="username", on_delete=models.CASCADE,max_length=255 )
   trip_name = models.CharField(max_length=255,null=True ,blank=True ,)
   trip_date = models.DateField(null=True ,blank=True ,)
   hotel_name = models.CharField( max_length=255 , null=True ,blank=True)
   hotel_reserve_date= models.DateField( null=True ,blank=True  )
   price = models.DecimalField(max_digits=6 , decimal_places=2,null=True ,blank=True )

   class Meta:
     verbose_name = 'Booking'
     verbose_name_plural = 'Bookings'

   def __str__(self):
    return str(self.username)