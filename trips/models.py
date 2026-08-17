from typing import Any
from django.db import models
from django.dispatch import receiver
import os

class Trips(models.Model):

    category = [
        ('Beach','Beach'),
        ('Nature','Nature'),
        ('City','City')
    ]

    # HAZARD: this is the primary key, so every Trip_features row, Hotels row,
    # booking and review references a trip *by its name*. Changing it through
    # the ORM does not rename the trip — it inserts a second row and strands
    # the references on the old one. The admin locks the field on change to
    # keep that path shut; the real remedy is a surrogate integer primary key
    # with `name` demoted to a unique column.
    name = models.CharField(max_length=150,primary_key=True)

    img = models.ImageField(upload_to='images/' , verbose_name = 'Trip photo')
    place = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=5 , decimal_places=0)
    rate = models.DecimalField(max_digits=2, decimal_places=1)
    num = models.DecimalField(max_digits=5, decimal_places=0, verbose_name='Number of Tourist')
    discount = models.DecimalField(max_digits=2, decimal_places=0)
    desc = models.TextField(verbose_name = 'Description')
    type = models.CharField(max_length=6 , choices = category , default = 'Beach')
    available = models.BooleanField(default = True)

    # Denormalized review aggregates (FR-38). Maintained by the signals in
    # reviews/signals.py — never edit these by hand; run
    # `manage.py recalculate_ratings` to repair them. Deliberately separate
    # from `rate` above, which stays the editorial rating the admin sets and
    # the Gallery filters on.
    average_rating = models.DecimalField(
        max_digits=3, decimal_places=2, default=0,
        editable=False, verbose_name='Average review rating',
    )
    reviews_count = models.PositiveIntegerField(
        default=0, editable=False, verbose_name='Number of reviews',
    )


    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = 'Trip'
        ordering = ['type']

    @property
    def Net_Profit(self):
        profit = 0 
        self.profit = (self.num * self.price * 2) / 100 
        return self.profit 
    
@receiver(models.signals.pre_delete, sender = Trips)

def dell(sender , instance , using ,  **kwargs):
    
 if instance.img:
     current_path =instance.img.path
     if os.path.exists(current_path) and os.path.isfile(current_path):
         os.remove(current_path)
 

 
 