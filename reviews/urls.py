from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

# Registered at the router root so the endpoints land on /api/reviews/,
# /api/reviews/<id>/, /api/reviews/summary/, /my/ and /pending/.
router = DefaultRouter()
router.register('', views.ReviewViewSet, basename='reviews')

urlpatterns = [
    path('', include(router.urls)),
]
