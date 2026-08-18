from django.urls import path

from . import views

urlpatterns = [
    path('validate/', views.validate_code, name='promo-validate'),
    path('active/', views.list_active_codes, name='promo-active'),
]
