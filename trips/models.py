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


    # FR-43. Seats offered per departure date. Deliberately NOT `num` above:
    # `num` is a running tally of everyone who has ever booked (it is
    # incremented on every booking and drives the "trending" ordering), so it
    # only grows and can never express a ceiling.
    # blank=True so the admin form stays optional: leaving it empty keeps the
    # default. Making it required would have changed the existing trip
    # add/change form contract, which two admin tests rightly pin.
    capacity = models.PositiveIntegerField(
        default=30, blank=True, verbose_name='Seats per departure',
        help_text='Leave empty for the default of 30.',
    )

    # FR-46. NULL means the platform owns this trip: it stays admin-managed and
    # no partner can reach it. Declared by label because partners imports trips.
    partner = models.ForeignKey(
        'partners.Partner', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='trips', verbose_name='owning partner',
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
 

 
 

class TripAvailability(models.Model):
    """Seats offered and taken for one trip on one date.

    Rows are created on demand: the first booking for a date materialises one
    from the trip's `capacity`. That keeps the catalogue free of a row per
    trip per calendar day, at the cost of the availability read endpoint having
    to fall back to the default for dates nobody has booked yet.
    """

    trip = models.ForeignKey(
        Trips, on_delete=models.CASCADE, related_name='availability', verbose_name='trip',
    )
    date = models.DateField(verbose_name='date')
    total_seats = models.PositiveIntegerField(verbose_name='total seats')
    booked_seats = models.PositiveIntegerField(default=0, verbose_name='booked seats')

    class Meta:
        verbose_name = 'Trip Availability'
        verbose_name_plural = 'Trip Availability'
        ordering = ['trip', 'date']
        constraints = [
            models.UniqueConstraint(fields=['trip', 'date'], name='unique_availability_per_trip_date'),
        ]

    def __str__(self):
        return f'{self.trip_id} — {self.date} ({self.booked_seats}/{self.total_seats})'

    @property
    def remaining_seats(self):
        return max(0, self.total_seats - self.booked_seats)

    @property
    def is_sold_out(self):
        return self.remaining_seats == 0
