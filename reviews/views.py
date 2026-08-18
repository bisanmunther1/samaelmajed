from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from profiles.models import STATUS_CANCELLED, Trip_per_user

from . import errors
from .errors import find_coded_error
from .models import MAX_RATING, MIN_RATING, Review
from .pagination import ReviewsPagination
from .permissions import IsAuthorOrStaff
from .serializers import PendingReviewSerializer, ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    """FR-38 — reviews and ratings.

    Reading approved reviews is public; writing needs a JWT. The business
    rules that decide whether a review may be written at all live in
    ReviewSerializer, not here.
    """

    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrStaff]
    pagination_class = ReviewsPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ['created_at', 'rating']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def handle_exception(self, exc):
        response = super().handle_exception(exc)

        # Collapse our own coded rejections into a single flat
        # `{detail, code}` body, whichever validation hook raised them.
        if isinstance(exc, ValidationError):
            coded = find_coded_error(response.data)
            if coded is not None:
                response.data = coded

        return response

    def get_queryset(self):
        # select_related keeps the list endpoint at one query for the page:
        # user + profile feed user_display_name, trip/hotel feed target_name.
        queryset = Review.objects.select_related('user', 'user__profile', 'trip', 'hotel')

        if self.action == 'list':
            return _filter_by_target(queryset.filter(is_approved=True), self.request)

        if self.action == 'my':
            return queryset.filter(user=self.request.user)

        # Detail routes stay unfiltered so an author can still reach — and
        # delete — a review that staff have hidden.
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def summary(self, request):
        """`{average, count, distribution: {1..5}}` for one trip or hotel."""
        target_id, target_field = _read_target_params(request)
        if target_field is None:
            return Response(
                {'detail': errors.MESSAGES[errors.TARGET_REQUIRED], 'code': errors.TARGET_REQUIRED},
                status=400,
            )

        reviews = Review.objects.filter(is_approved=True, **{target_field: target_id})

        totals = reviews.aggregate(average=Avg('rating'), count=Count('pk'))
        distribution = {str(value): 0 for value in range(MIN_RATING, MAX_RATING + 1)}
        for row in reviews.values('rating').annotate(total=Count('pk')):
            distribution[str(row['rating'])] = row['total']

        return Response({
            'average': round(totals['average'], 2) if totals['average'] is not None else 0,
            'count': totals['count'] or 0,
            'distribution': distribution,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my(self, request):
        """Every review the current user has written, approved or not."""
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)

        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def pending(self, request):
        """Every target the user still owes a review on — one entry per
        outstanding trip or hotel, not per booking.

        A booking qualifies when it is paid, its trip/stay is over, and that
        particular half has not been reviewed yet; a booking covering both a
        trip and a hotel therefore yields two entries until both are done.
        """
        today = timezone.localdate()

        bookings = list(
            Trip_per_user.objects
            .filter(username__user=request.user, is_paid=True)
            .exclude(status=STATUS_CANCELLED)
            .select_related('trip', 'hotel')
            .order_by('-trip_date', '-pk')
        )

        # Reviewed targets, keyed by (booking, target) so reviewing the trip
        # never hides the hotel — the defect this replaced.
        reviewed = Review.objects.filter(user=request.user).values_list(
            'booking_id', 'trip_id', 'hotel_id',
        )
        reviewed_trips = {(booking_id, trip_id) for booking_id, trip_id, _ in reviewed if trip_id}
        reviewed_hotels = {(booking_id, hotel_id) for booking_id, _, hotel_id in reviewed if hotel_id}

        # The foreign key is its own existence check — a linked trip or hotel is
        # guaranteed to be a real catalogue record, so the name-lookup pass this
        # used to need is gone along with the two queries it cost.
        rows = []
        for booking in bookings:
            trip_ready = (
                booking.trip_id is not None
                and booking.trip_date is not None
                and booking.trip_date < today
                and (booking.pk, booking.trip_id) not in reviewed_trips
            )
            hotel_ready = (
                booking.hotel_id is not None
                and booking.hotel_reserve_date is not None
                and booking.hotel_reserve_date < today
                and (booking.pk, booking.hotel_id) not in reviewed_hotels
            )

            if trip_ready:
                rows.append({
                    'booking': booking.pk,
                    'target_type': 'trip',
                    'target_id': booking.trip_id,
                    'target_name': booking.trip.name,
                    'target_date': booking.trip_date,
                    'price': booking.price,
                })

            if hotel_ready:
                rows.append({
                    'booking': booking.pk,
                    'target_type': 'hotel',
                    'target_id': booking.hotel_id,
                    'target_name': booking.hotel.name,
                    'target_date': booking.hotel_reserve_date,
                    'price': booking.price,
                })

        return Response(PendingReviewSerializer(rows, many=True).data)


def _read_target_params(request):
    """Reads `?trip=` / `?hotel=` and returns (value, queryset field name)."""
    trip = request.query_params.get('trip')
    if trip:
        return trip, 'trip_id'

    hotel = request.query_params.get('hotel')
    if hotel:
        return hotel, 'hotel_id'

    return None, None


def _filter_by_target(queryset, request):
    target_id, target_field = _read_target_params(request)
    if target_field is None:
        return queryset
    return queryset.filter(**{target_field: target_id})
