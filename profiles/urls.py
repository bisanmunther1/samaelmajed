from django.urls import path
from . import views
from .views import Update_data  ,Update_profile_data
urlpatterns = [
   path('get/<str:name>/' ,views.send_data ),
   path('get_profile_data/<str:name>/' ,views.send_profile_data ),
   path('send/' ,Update_data.as_view()),
   path('update_profile/',Update_profile_data.as_view())
]
