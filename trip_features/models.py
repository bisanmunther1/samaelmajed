from django.db import models

from trips.models import Trips
import os
from django.dispatch import receiver
# Create your models here.
class Trip_features(models.Model):

    name = models.OneToOneField(Trips, verbose_name='name', on_delete=models.CASCADE ,primary_key=True)
    img1 = models.ImageField(upload_to='images/reserve' , verbose_name = 'Trip photo 1')
    img2 = models.ImageField(upload_to='images/reserve' , verbose_name = 'Trip photo 2')
    img3 = models.ImageField(upload_to='images/reserve' , verbose_name = 'Trip photo 3')
    img4 = models.ImageField(upload_to='images/reserve' , verbose_name = 'Trip photo 4')
  
    access_plane_1 = models.BooleanField( default=False ,  verbose_name=" access point 1 by plane")
    access_plane_name_1= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name")
    access_plane_price_1= models.DecimalField(max_digits=6 , decimal_places=2 , verbose_name="price" , null=True ,blank=True,default=0)
    plane_start_at_1 = models.DateTimeField( null=True ,blank=True)
   
    access_plane_2= models.BooleanField( default=False ,  verbose_name=" access point 2 by plane")
    access_plane_name_2= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name" )
    access_plane_price_2= models.DecimalField(max_digits=6 , decimal_places=2  , verbose_name="price" , null=True ,blank=True,default=0)
    plane_start_at_2 = models.DateTimeField( null=True ,blank=True)
    
    access_plane_3 = models.BooleanField( default=False ,  verbose_name=" access point 3 by plane")
    access_plane_name_3= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name")
    access_plane_price_3= models.DecimalField(max_digits=6 , decimal_places=2 , verbose_name="price" , null=True ,blank=True,default=0)
    plane_start_at_3 = models.DateTimeField( null=True ,blank=True)


    access_plane_4= models.BooleanField( default=False ,  verbose_name=" access point 4 by plane")
    access_plane_name_4= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name" )
    access_plane_price_4= models.DecimalField(max_digits=6 , decimal_places=2  , verbose_name="price" , null=True ,blank=True,default=0)
    plane_start_at_4 = models.DateTimeField( null=True ,blank=True)
    
    access_plane_5= models.BooleanField( default=False ,  verbose_name=" access point 5 by plane")
    access_plane_name_5= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name" )
    access_plane_price_5= models.DecimalField(max_digits=6 , decimal_places=2  , verbose_name="price" , null=True ,blank=True,default=0)
    plane_start_at_5 = models.DateTimeField( null=True ,blank=True)
  
  
    
    access_bus_1 = models.BooleanField( default=False ,  verbose_name=" access point 1 by bus")
    access_bus_name_1= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name")
    access_bus_price_1= models.DecimalField(max_digits=6 , decimal_places=2  , verbose_name="price" , null=True ,blank=True,default=0)
    bus_start_at_1 = models.DateTimeField( null=True ,blank=True)

    access_bus_2= models.BooleanField( default=False ,  verbose_name=" access point 2 by bus")
    access_bus_name_2= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name" )
    access_bus_price_2= models.DecimalField(max_digits=6 , decimal_places=2 , verbose_name="price" , null=True ,blank=True,default=0)
    bus_start_at_2 = models.DateTimeField( null=True ,blank=True)
  
    access_bus_3 = models.BooleanField( default=False ,  verbose_name=" access point 3 by bus")
    access_bus_name_3= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name")
    access_bus_price_3= models.DecimalField(max_digits=6 , decimal_places=2  , verbose_name="price" , null=True ,blank=True,default=0)
    bus_start_at_3 = models.DateTimeField( null=True ,blank=True)

    access_bus_4= models.BooleanField( default=False ,  verbose_name=" access point 4 by bus")
    access_bus_name_4= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name" )
    access_bus_price_4= models.DecimalField(max_digits=6 , decimal_places=2 , verbose_name="price" , null=True ,blank=True,default=0)
    bus_start_at_4 = models.DateTimeField( null=True ,blank=True)
    
    access_bus_5= models.BooleanField( default=False ,  verbose_name=" access point 5 by bus")
    access_bus_name_5= models.CharField(max_length=150 , null=True ,blank=True , default ="none" ,verbose_name="name" )
    access_bus_price_5= models.DecimalField(max_digits=6 , decimal_places=2 , verbose_name="price" , null=True ,blank=True,default=0)
    bus_start_at_5 = models.DateTimeField( null=True ,blank=True)
 
    class Meta:
     verbose_name = 'Trip Features'
     verbose_name_plural = 'Trip Features'
     ordering = ['name']
    def __str__(self):
        return str(self.name)
    

 

@receiver(models.signals.pre_delete, sender = Trip_features)

def dell(sender , instance , using ,  **kwargs):
    
 if instance.img1:
     current_path =instance.img1.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
         
 if instance.img2:
     current_path =instance.img2.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
 
 if instance.img3:
     current_path =instance.img3.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
 
 if instance.img4:
     current_path =instance.img4.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)