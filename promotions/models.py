from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from profiles.models import Trip_per_user
from trips.models import Trips

PERCENTAGE = 'percentage'
FIXED = 'fixed'

DISCOUNT_TYPES = [
    (PERCENTAGE, 'Percentage'),
    (FIXED, 'Fixed amount'),
]

MIN_PERCENTAGE = 1
MAX_PERCENTAGE = 100


class PromoCode(models.Model):
    """A redeemable discount. `times_used` is maintained by the booking flow —
    never edit it by hand."""

    code = models.CharField(max_length=20, unique=True, verbose_name='code')
    description = models.CharField(max_length=255, verbose_name='description')

    discount_type = models.CharField(
        max_length=10, choices=DISCOUNT_TYPES, default=PERCENTAGE,
        verbose_name='discount type',
    )
    discount_value = models.DecimalField(
        max_digits=8, decimal_places=2, validators=[MinValueValidator(0)],
        verbose_name='discount value',
    )
    # Only meaningful for a percentage discount: the ceiling it may reach.
    max_discount = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        verbose_name='maximum discount',
    )
    min_booking_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        verbose_name='minimum booking amount',
    )

    valid_from = models.DateTimeField(verbose_name='valid from')
    valid_until = models.DateTimeField(verbose_name='valid until')

    usage_limit = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='total usage limit',
        help_text='Leave empty for unlimited.',
    )
    usage_limit_per_user = models.PositiveIntegerField(
        default=1, verbose_name='usage limit per user',
    )
    times_used = models.PositiveIntegerField(default=0, verbose_name='times used')

    is_active = models.BooleanField(default=True, verbose_name='active')

    # Empty means the code applies to every trip.
    applicable_trips = models.ManyToManyField(
        Trips, blank=True, related_name='promo_codes', verbose_name='applicable trips',
    )

    class Meta:
        verbose_name = 'Promo Code'
        verbose_name_plural = 'Promo Codes'
        ordering = ['-valid_until']
        constraints = [
            # A percentage has to read as a percentage. Fixed amounts are
            # unconstrained beyond the field validator.
            models.CheckConstraint(
                condition=(
                    ~models.Q(discount_type=PERCENTAGE)
                    | models.Q(discount_value__gte=MIN_PERCENTAGE, discount_value__lte=MAX_PERCENTAGE)
                ),
                name='promo_percentage_between_1_and_100',
            ),
            models.CheckConstraint(
                condition=models.Q(valid_until__gt=models.F('valid_from')),
                name='promo_valid_until_after_valid_from',
            ),
        ]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        # Codes are matched case-insensitively by being stored uppercase.
        self.code = (self.code or '').strip().upper()
        return super().save(*args, **kwargs)

    def clean(self):
        errors = {}

        if self.discount_type == PERCENTAGE and self.discount_value is not None:
            if not (MIN_PERCENTAGE <= self.discount_value <= MAX_PERCENTAGE):
                errors['discount_value'] = 'A percentage discount must be between 1 and 100.'

        if self.valid_from and self.valid_until and self.valid_until <= self.valid_from:
            errors['valid_until'] = 'The end of the window must come after its start.'

        if errors:
            raise ValidationError(errors)

    @property
    def is_within_window(self):
        now = timezone.now()
        return self.valid_from <= now <= self.valid_until

    @property
    def has_remaining_uses(self):
        return self.usage_limit is None or self.times_used < self.usage_limit

    @property
    def is_redeemable_now(self):
        return self.is_active and self.is_within_window and self.has_remaining_uses


class PromoCodeUsage(models.Model):
    """One redemption. The unique constraint is what stops a single booking
    from consuming the same code twice."""

    promo_code = models.ForeignKey(
        PromoCode, on_delete=models.CASCADE, related_name='usages', verbose_name='promo code',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='promo_usages', verbose_name='user',
    )
    booking = models.ForeignKey(
        Trip_per_user, on_delete=models.CASCADE,
        related_name='promo_usages', verbose_name='booking',
    )
    discount_amount = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name='discount amount',
    )
    used_at = models.DateTimeField(auto_now_add=True, verbose_name='used at')

    class Meta:
        verbose_name = 'Promo Code Usage'
        verbose_name_plural = 'Promo Code Usages'
        ordering = ['-used_at']
        constraints = [
            models.UniqueConstraint(
                fields=['promo_code', 'booking'], name='unique_promo_use_per_booking',
            ),
        ]

    def __str__(self):
        return f'{self.promo_code_id} — booking {self.booking_id}'
