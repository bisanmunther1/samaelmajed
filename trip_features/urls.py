from django.urls import path
from . import views

urlpatterns = [
    path('<str:name>/' , views.get_features , name='get_features'),
]
