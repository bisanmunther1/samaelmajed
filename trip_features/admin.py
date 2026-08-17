from django.contrib import admin
from .models import Trip_features
# Register your models here.

class Search(admin.ModelAdmin):
    search_fields=('name', )
    list_filter =['name']
 




admin.site.register(Trip_features ,Search)