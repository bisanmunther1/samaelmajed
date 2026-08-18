from django.utils import timezone
from rest_framework import serializers

from . import errors
from .errors import review_error
from .models import MAX_COMMENT_LENGTH, MAX_RATING, MIN_RATING, Review

# Fields that describe *what* is being reviewed. They are settled at creation
# time and locked afterwards — an edit may only change the rating and comment.
TARGET_FIELDS = ('booking', 'trip', 'hotel')


class ReviewSerializer(serializers.ModelSerializer):
    """Holds every FR-38 business rule.

    The rules deliberately live here rather than in the view so that the same
    checks apply however a review is created (API, tests, future admin flows).
    """

    rating = serializers.IntegerField()
    comment = serializers.CharField(required=False, allow_blank=True, default='')

    user_display_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()
    target_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            'id', 'booking', 'trip', 'hotel',
            'rating', 'comment', 'created_at', 'updated_at',
            'user_display_name', 'can_edit', 'can_delete',
            'target_type', 'target_id', 'target_name',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_fields(self):
        fields = super().get_fields()
        # On an edit the target is fixed: you cannot move a review from one
        # trip (or booking) to another.
        if self.instance is not None:
            for name in TARGET_FIELDS:
                fields[name].read_only = True
        return fields

    # ---- output ---------------------------------------------------------

    def get_user_display_name(self, review):
        """The reviewer's name for public display — never their email."""
        profile = getattr(review.user, 'profile', None)
        if profile is not None:
            full_name = f'{profile.first_name or ""} {profile.last_name or ""}'.strip()
            if full_name:
                return full_name

        return review.user.get_full_name().strip() or review.user.username

    def _request_user(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            return user
        return None

    def get_can_edit(self, review):
        user = self._request_user()
        return bool(user and review.user_id == user.pk and review.is_within_edit_window)

    def get_can_delete(self, review):
        user = self._request_user()
        return bool(user and (review.user_id == user.pk or user.is_staff))

    def get_target_type(self, review):
        return review.target_type

    def get_target_id(self, review):
        return review.target_id

    def get_target_name(self, review):
        return review.target_name

    # ---- field-level validation ----------------------------------------

    def validate_rating(self, value):
        if value < MIN_RATING or value > MAX_RATING:
            raise review_error(errors.INVALID_RATING)
        return value

    def validate_comment(self, value):
        if value and len(value) > MAX_COMMENT_LENGTH:
            raise review_error(errors.COMMENT_TOO_LONG)
        return value

    # ---- business rules -------------------------------------------------

    def validate(self, attrs):
        if self.instance is not None:
            self._validate_edit(self.instance)
        else:
            self._validate_create(attrs)
        return attrs

    def _validate_edit(self, review):
        # Rule 5 — the author only, and only inside the 14-day window.
        user = self._request_user()
        if user is None or review.user_id != user.pk:
            raise review_error(errors.NOT_REVIEW_AUTHOR)
        if not review.is_within_edit_window:
            raise review_error(errors.EDIT_WINDOW_EXPIRED)

    def _validate_create(self, attrs):
        user = self._request_user()
        booking = attrs.get('booking')
        trip = attrs.get('trip')
        hotel = attrs.get('hotel')

        # Exactly one target.
        if trip is None and hotel is None:
            raise review_error(errors.TARGET_REQUIRED)
        if trip is not None and hotel is not None:
            raise review_error(errors.TARGET_AMBIGUOUS)

        # Rule 1 — the booking must be the reviewer's own.
        if user is None or booking.username.user_id != user.pk:
            raise review_error(errors.BOOKING_NOT_OWNED)

        # Rule 2 — it must be paid/completed.
        if not booking.is_paid:
            raise review_error(errors.BOOKING_NOT_COMPLETED)

        # A cancelled trip was never taken, so there is nothing to review.
        # Reviews written before a cancellation are deliberately left alone —
        # deleting somebody's words is not this feature's business.
        if booking.is_cancelled:
            raise review_error(errors.BOOKING_CANCELLED)

        today = timezone.localdate()

        # The duplicate checks below are per target, not per booking: a booking
        # covering both a trip and a hotel earns one review of each. They mirror
        # the two partial UniqueConstraints, so the client gets a coded 400
        # rather than an IntegrityError.
        if trip is not None:
            # Rule 3 — the trip must be the one this booking is for. A real
            # foreign-key comparison: before the FK conversion this was a string
            # match against a free-text column, so a renamed or mistyped trip
            # name silently failed to match.
            if booking.trip_id != trip.pk:
                raise review_error(errors.TARGET_MISMATCH)
            # Rule 4 — the trip must already be over. Trip_per_user has no end
            # date, so the (start) trip_date is what "finished" is measured on.
            if booking.trip_date is None or booking.trip_date >= today:
                raise review_error(errors.TRIP_NOT_FINISHED)
            if Review.objects.filter(user=user, booking=booking, trip=trip).exists():
                raise review_error(errors.DUPLICATE_TRIP_REVIEW)
        else:
            if booking.hotel_id != hotel.pk:
                raise review_error(errors.TARGET_MISMATCH)
            if booking.hotel_reserve_date is None or booking.hotel_reserve_date >= today:
                raise review_error(errors.HOTEL_STAY_NOT_FINISHED)
            if Review.objects.filter(user=user, booking=booking, hotel=hotel).exists():
                raise review_error(errors.DUPLICATE_HOTEL_REVIEW)


class PendingReviewSerializer(serializers.Serializer):
    """One *outstanding target* the user still owes a review on — what drives
    the "قيّم رحلتك" prompt.

    A booking covering both a trip and a hotel yields two of these, and drops to
    one once either half is reviewed. `target_date` is the date that made this
    target eligible (the trip date, or the hotel check-in date).
    """

    booking = serializers.IntegerField()
    target_type = serializers.ChoiceField(choices=['trip', 'hotel'])
    target_id = serializers.CharField()
    target_name = serializers.CharField()
    target_date = serializers.DateField(allow_null=True)
    price = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)
