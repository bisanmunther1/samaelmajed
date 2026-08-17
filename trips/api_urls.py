"""Routes mounted under /api/trips/ — the FR-39 additions, kept apart from the
project's original /trips/ paths so those stay exactly as they were."""

from django.urls import path

from . import views

urlpatterns = [
    path('filter-options/', views.filter_options, name='trip-filter-options'),
]
