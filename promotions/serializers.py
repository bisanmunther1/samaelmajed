from rest_framework import serializers

from .models import PromoCode


class ActivePromoCodeSerializer(serializers.ModelSerializer):
    """The public "current offers" shape. Deliberately withholds the usage
    counters — how close a code is to exhaustion is not customers' business."""

    class Meta:
        model = PromoCode
        fields = [
            'code', 'description', 'discount_type', 'discount_value',
            'max_discount', 'min_booking_amount', 'valid_until',
        ]
