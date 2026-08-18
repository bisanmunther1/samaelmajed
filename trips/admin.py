from django.contrib import admin
from .models import TripAvailability, Trips


#admin.site.register(Trips)
# Register your models here.


class Search(admin.ModelAdmin):
    search_fields=('name','place')
    list_display = ['name' , 'price' , 'rate' , 'discount','type' , 'available' ,'Net_Profit']
    list_editable = ['price','rate','type','discount','available']
    list_filter =['type' ,'name']

    def get_readonly_fields(self, request, obj=None):
        # `name` is the primary key. Editing it does not rename the trip — it
        # inserts a second row and strands every booking and review pointing at
        # the old one. Locked on change, still free to set on add. The real
        # remedy is a surrogate primary key; see the note on Trips.name.
        if obj is None:
            return super().get_readonly_fields(request, obj)
        return list(super().get_readonly_fields(request, obj)) + ['name']



admin.site.register(Trips,Search)

@admin.register(TripAvailability)
class TripAvailabilityAdmin(admin.ModelAdmin):
    list_display = ['trip', 'date', 'total_seats', 'booked_seats', 'remaining_seats']
    list_editable = ['total_seats']
    list_filter = ['trip', 'date']
    search_fields = ['trip__name']
    date_hierarchy = 'date'
    ordering = ['trip', 'date']
    list_select_related = ['trip']
    # Maintained by the booking and cancellation flows; editing it by hand
    # would desync the seat pool from the bookings that justify it.
    readonly_fields = ['booked_seats']

    @admin.display(description='remaining')
    def remaining_seats(self, availability):
        return availability.remaining_seats
