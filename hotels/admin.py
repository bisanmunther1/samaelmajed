from django.contrib import admin

from .models import Hotels


class HotelsAdmin(admin.ModelAdmin):
    list_display = ['name', 'trip_name', 'price', 'rate', 'average_rating', 'reviews_count']
    list_filter = ['trip_name']
    # Required for the autocomplete widget on the booking admin's hotel field.
    search_fields = ['name']
    list_select_related = ['trip_name']

    def get_readonly_fields(self, request, obj=None):
        # `name` is the primary key. Editing it does not rename the hotel — it
        # inserts a second row and strands every booking and review pointing at
        # the old one. Locked on change, still free to set on add. The real
        # remedy is a surrogate primary key; see the note on Hotels.name.
        if obj is None:
            return super().get_readonly_fields(request, obj)
        return list(super().get_readonly_fields(request, obj)) + ['name']


admin.site.register(Hotels, HotelsAdmin)
