from django.contrib.auth.models import User, Group, Permission
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from trips.models import Trips
from hotels.models import Hotels
from trip_features.models import Trip_features
from profiles.models import Profile, Trip_per_user


class AdminAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds is_staff/is_superuser/username claims to the existing /token/
    login response so the React admin can gate routes right after login,
    without an extra round trip. Purely additive — regular site users get
    the same access/refresh tokens as before, just with a couple of extra
    claims they don't need to look at."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        return token


class TripsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trips
        fields = '__all__'


class HotelsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hotels
        fields = '__all__'


class TripFeaturesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip_features
        fields = '__all__'


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'
        read_only_fields = ['username', 'joined_at']


class BookingSerializer(serializers.ModelSerializer):
    # trip_name / hotel_name used to be columns on the booking. They are now
    # read through the relations, but stay in the payload under the same keys
    # so the admin's booking table keeps rendering unchanged.
    trip_name = serializers.CharField(source='trip.name', read_only=True, default=None)
    hotel_name = serializers.CharField(source='hotel.name', read_only=True, default=None)

    class Meta:
        model = Trip_per_user
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_staff', 'is_superuser', 'is_active', 'date_joined',
            'last_login', 'groups', 'password',
        ]
        read_only_fields = ['date_joined', 'last_login']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        groups = validated_data.pop('groups', [])
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        if groups:
            user.groups.set(groups)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            if field == 'groups':
                instance.groups.set(value)
                continue
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source='content_type.app_label', read_only=True)
    model = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'app_label', 'model']


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']


class OutstandingTokenSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default=None)
    is_blacklisted = serializers.SerializerMethodField()

    class Meta:
        model = OutstandingToken
        fields = ['id', 'user', 'username', 'jti', 'created_at', 'expires_at', 'is_blacklisted']

    def get_is_blacklisted(self, obj):
        return BlacklistedToken.objects.filter(token=obj).exists()
