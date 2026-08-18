from django.conf import settings
from django.db import models

HOTEL_MANAGER = 'hotel_manager'
TOUR_OPERATOR = 'tour_operator'

PARTNER_TYPES = [
    (HOTEL_MANAGER, 'Hotel manager'),
    (TOUR_OPERATOR, 'Tour operator'),
]


class Partner(models.Model):
    """A business that lists on the platform.

    `is_approved` is the gate: an unapproved partner can sign in and see their
    pending state, and nothing else. Only an admin flips it.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='partner', verbose_name='user',
    )
    business_name = models.CharField(max_length=255, verbose_name='business name')
    contact_phone = models.CharField(max_length=30, blank=True, verbose_name='contact phone')
    contact_email = models.EmailField(blank=True, verbose_name='contact email')

    partner_type = models.CharField(
        max_length=20, choices=PARTNER_TYPES, default=TOUR_OPERATOR,
        verbose_name='partner type',
    )
    is_approved = models.BooleanField(default=False, verbose_name='approved')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='created at')

    class Meta:
        verbose_name = 'Partner'
        verbose_name_plural = 'Partners'
        ordering = ['-created_at']

    def __str__(self):
        return self.business_name

    @property
    def manages_hotels(self):
        return self.partner_type == HOTEL_MANAGER

    @property
    def manages_trips(self):
        return self.partner_type == TOUR_OPERATOR
