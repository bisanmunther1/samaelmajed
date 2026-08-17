from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from hotels.models import Hotels
from profiles.models import Trip_per_user
from trips.models import Trips

# A review may be edited by its author for this many days after it was written.
EDIT_WINDOW_DAYS = 14

MAX_COMMENT_LENGTH = 1000

MIN_RATING = 1
MAX_RATING = 5


class Review(models.Model):
    """A rating (1-5) plus optional comment that a user leaves on the trip or
    the hotel of one of their own completed bookings.

    Exactly one of `trip` / `hotel` is set — enforced both by the serializer
    and by a database CheckConstraint below.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews',
        verbose_name='user',
    )
    booking = models.ForeignKey(
        Trip_per_user, on_delete=models.CASCADE, related_name='reviews',
        verbose_name='booking',
    )
    trip = models.ForeignKey(
        Trips, on_delete=models.CASCADE, related_name='reviews',
        null=True, blank=True, verbose_name='trip',
    )
    hotel = models.ForeignKey(
        Hotels, on_delete=models.CASCADE, related_name='reviews',
        null=True, blank=True, verbose_name='hotel',
    )

    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(MIN_RATING), MaxValueValidator(MAX_RATING)],
        verbose_name='rating',
    )
    comment = models.TextField(
        blank=True, max_length=MAX_COMMENT_LENGTH, verbose_name='comment',
    )
    # Reviews are visible as soon as they are written; staff un-tick this to
    # hide an abusive one, which also removes it from the aggregates.
    is_approved = models.BooleanField(default=True, verbose_name='approved')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='created at')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='updated at')

    class Meta:
        verbose_name = 'Review'
        verbose_name_plural = 'Reviews'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(trip__isnull=False, hotel__isnull=True)
                    | models.Q(trip__isnull=True, hotel__isnull=False)
                ),
                name='review_target_is_exactly_one_of_trip_or_hotel',
            ),
            # One review per target per booking — not one per booking. A
            # booking that covers both a trip and a hotel earns two reviews,
            # so the two constraints are partial (SQLite partial indexes).
            models.UniqueConstraint(
                fields=['user', 'booking', 'trip'],
                condition=models.Q(trip__isnull=False),
                name='unique_trip_review_per_user_and_booking',
            ),
            models.UniqueConstraint(
                fields=['user', 'booking', 'hotel'],
                condition=models.Q(hotel__isnull=False),
                name='unique_hotel_review_per_user_and_booking',
            ),
        ]

    def __str__(self):
        return f'{self.user} — {self.target_name} ({self.rating}/5)'

    @property
    def target(self):
        """The reviewed object: a Trips or a Hotels instance."""
        return self.trip if self.trip_id else self.hotel

    @property
    def target_type(self):
        return 'trip' if self.trip_id else 'hotel'

    @property
    def target_id(self):
        """Both Trips and Hotels use their name as the primary key."""
        return self.trip_id if self.trip_id else self.hotel_id

    @property
    def target_name(self):
        return self.target_id or '—'

    @property
    def edit_deadline(self):
        return self.created_at + timedelta(days=EDIT_WINDOW_DAYS)

    @property
    def is_within_edit_window(self):
        if self.created_at is None:
            return True
        return timezone.now() <= self.edit_deadline
