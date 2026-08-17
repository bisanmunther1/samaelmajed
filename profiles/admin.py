from django.contrib import admin
from .models import Profile   , Trip_per_user

 
class Search(admin.ModelAdmin):
 
    list_filter =['username' ,'email']
    list_display = ['username' ,'email','first_name' , 'last_name','phone' ]

admin.site.register(Profile,Search)
admin.site.register(Trip_per_user )