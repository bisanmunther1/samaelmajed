"""Routes mounted under /api/bookings/ — the FR-40 cancellation endpoints,
kept apart from the project's original /profile/ paths."""

from django.urls import path

from . import views

urlpatterns = [
    path('<int:booking_id>/cancellation-preview/',
         views.BookingCancellationPreview.as_view(), name='booking-cancellation-preview'),
    path('<int:booking_id>/cancel/',
         views.BookingCancel.as_view(), name='booking-cancel'),
]
