from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('trips', views.TripsViewSet, basename='admin-trips')
router.register('hotels', views.HotelsViewSet, basename='admin-hotels')
router.register('trip-features', views.TripFeaturesViewSet, basename='admin-trip-features')
router.register('profiles', views.ProfileViewSet, basename='admin-profiles')
router.register('bookings', views.BookingViewSet, basename='admin-bookings')
router.register('users', views.UserViewSet, basename='admin-users')
router.register('groups', views.GroupViewSet, basename='admin-groups')
router.register('permissions', views.PermissionViewSet, basename='admin-permissions')
router.register('token-blacklist', views.TokenBlacklistViewSet, basename='admin-token-blacklist')

urlpatterns = [
    path('me/', views.MeView.as_view(), name='admin-api-me'),
    path('', include(router.urls)),
]
