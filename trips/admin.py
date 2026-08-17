from django.contrib import admin
from .models import Trips  


#admin.site.register(Trips)
# Register your models here.


class Search(admin.ModelAdmin):
    search_fields=('name','place')
    list_display = ['name' , 'price' , 'rate' , 'discount','type' , 'available' ,'Net_Profit']
    list_editable = ['price','rate','type','discount','available']
    list_filter =['type' ,'name']



admin.site.register(Trips,Search)