from django.urls import path

from . import views

urlpatterns = [
    path('register/', views.PartnerRegister.as_view(), name='partner-register'),
    path('me/', views.PartnerMe.as_view(), name='partner-me'),
    path('listings/', views.PartnerListings.as_view(), name='partner-listings'),
    path('listings/<str:listing_id>/', views.PartnerListingDetail.as_view(),
         name='partner-listing-detail'),
    path('bookings/', views.partner_bookings, name='partner-bookings'),
    path('dashboard/', views.partner_dashboard, name='partner-dashboard'),
]
