from rest_framework import serializers

from hotels.models import Hotels
from trips.models import Trips

from .models import Partner


class PartnerSerializer(serializers.ModelSerializer):
    """The partner's own profile. `is_approved`, `user` and `partner_type` are
    read-only here: approval is an admin decision, and letting a partner PATCH
    either would be privilege escalation."""

    role = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = [
            'id', 'business_name', 'contact_phone', 'contact_email',
            'partner_type', 'is_approved', 'created_at', 'role',
        ]
        read_only_fields = ['id', 'is_approved', 'partner_type', 'created_at']

    def get_role(self, partner):
        profile = getattr(partner.user, 'profile', None)
        return profile.role if profile is not None else 'customer'


class PartnerRegistrationSerializer(serializers.ModelSerializer):
    """Applying to become a partner. `is_approved` is deliberately absent —
    it cannot be set from the request at all."""

    class Meta:
        model = Partner
        fields = ['business_name', 'contact_phone', 'contact_email', 'partner_type']

    def validate_business_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('A business name is required.')
        return value.strip()


class PartnerTripSerializer(serializers.ModelSerializer):
    """A tour operator's trip. `partner` is not writable: ownership is set from
    the authenticated caller, never from the payload."""

    class Meta:
        model = Trips
        fields = [
            'name', 'place', 'price', 'rate', 'num', 'discount', 'desc',
            'type', 'available', 'capacity', 'average_rating', 'reviews_count',
        ]
        read_only_fields = ['average_rating', 'reviews_count', 'num']


class PartnerHotelSerializer(serializers.ModelSerializer):
    """A hotel manager's hotel. `trip_name` is the Trip_features parent the
    schema requires; it is resolved in the view from a trip name."""

    class Meta:
        model = Hotels
        fields = [
            'name', 'price', 'rate', 'wifi', 'pool', 'restaurant',
            'car_parking', 'air_conditioning', 'room_services', 'beachfront',
            'gym', 'cinema', 'average_rating', 'reviews_count',
        ]
        read_only_fields = ['average_rating', 'reviews_count']


class PartnerBookingSerializer(serializers.Serializer):
    """A booking on one of the partner's listings. Read-only, and deliberately
    narrow: a partner sees what they need to service the booking, not the
    customer's full profile."""

    id = serializers.IntegerField()
    customer = serializers.CharField()
    trip = serializers.CharField(allow_null=True)
    hotel = serializers.CharField(allow_null=True)
    trip_date = serializers.DateField(allow_null=True)
    hotel_reserve_date = serializers.DateField(allow_null=True)
    seats = serializers.IntegerField()
    price = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)
    status = serializers.CharField()
    is_paid = serializers.BooleanField()
