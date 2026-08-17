from django.contrib import admin
from .models import Profile   , Trip_per_user

 
class Search(admin.ModelAdmin):

    list_filter =['username' ,'email']
    list_display = ['username' ,'email','first_name' , 'last_name','phone' ]


class BookingAdmin(admin.ModelAdmin):
    # is_paid decides whether the booking can be reviewed (FR-38), so it needs
    # to be visible and toggleable straight from the list.
    list_display = ['id', 'username', 'trip', 'trip_date', 'hotel', 'price', 'is_paid']
    list_editable = ['is_paid']
    list_filter = ['is_paid', 'trip_date']
    search_fields = ['username__username', 'trip__name', 'hotel__name']
    # Both are real relations now, so the changelist would otherwise issue a
    # query per row to render the trip and hotel columns.
    list_select_related = ['username', 'trip', 'hotel']
    autocomplete_fields = ['trip', 'hotel']


admin.site.register(Profile,Search)
admin.site.register(Trip_per_user, BookingAdmin)