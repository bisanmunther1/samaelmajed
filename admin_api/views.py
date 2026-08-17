from django.contrib.auth.models import User, Group, Permission
from rest_framework import viewsets, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from trips.models import Trips
from hotels.models import Hotels
from trip_features.models import Trip_features
from profiles.models import Profile, Trip_per_user

from .permissions import IsStaffUser, IsSuperUser
from .serializers import (
    TripsSerializer, HotelsSerializer, TripFeaturesSerializer,
    ProfileSerializer, BookingSerializer, UserSerializer,
    GroupSerializer, PermissionSerializer, OutstandingTokenSerializer,
)


class MeView(APIView):
    """Who-am-I check for the React admin's route guard — lets it confirm
    staff/superuser status on app load from a stored token, without
    re-decoding the JWT client-side."""
    permission_classes = [IsStaffUser]

    def get(self, request):
        user = request.user
        return Response({
            'username': user.username,
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        })


class TripsViewSet(viewsets.ModelViewSet):
    queryset = Trips.objects.all()
    serializer_class = TripsSerializer
    permission_classes = [IsStaffUser]


class HotelsViewSet(viewsets.ModelViewSet):
    queryset = Hotels.objects.all()
    serializer_class = HotelsSerializer
    permission_classes = [IsStaffUser]


class TripFeaturesViewSet(viewsets.ModelViewSet):
    queryset = Trip_features.objects.all()
    serializer_class = TripFeaturesSerializer
    permission_classes = [IsStaffUser]


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsStaffUser]


class BookingViewSet(viewsets.ModelViewSet):
    queryset = Trip_per_user.objects.all()
    serializer_class = BookingSerializer
    permission_classes = [IsStaffUser]


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsSuperUser]


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by('name')
    serializer_class = GroupSerializer
    permission_classes = [IsSuperUser]


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related('content_type').order_by(
        'content_type__app_label', 'codename'
    )
    serializer_class = PermissionSerializer
    permission_classes = [IsSuperUser]


class TokenBlacklistViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OutstandingToken.objects.select_related('user').order_by('-created_at')
    serializer_class = OutstandingTokenSerializer
    permission_classes = [IsSuperUser]

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        token = self.get_object()
        BlacklistedToken.objects.get_or_create(token=token)
        return Response({'status': 'blacklisted'})
