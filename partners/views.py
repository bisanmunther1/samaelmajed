"""FR-46 partner endpoints.

Every listing/booking query starts from the caller's own Partner row, so
scoping is structural rather than a filter someone can forget: there is no code
path here that reads a listing without `partner=<caller>` in the queryset.
"""

from django.db.models import Avg, ProtectedError
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from hotels.models import Hotels
from profiles.models import STATUS_CANCELLED, Profile, Trip_per_user
from trip_features.models import Trip_features
from trips.models import Trips

from . import errors
from .errors import PartnerError, partner_error
from .models import Partner
from .permissions import IsApprovedPartner, partner_for
from .serializers import (
    PartnerBookingSerializer, PartnerHotelSerializer, PartnerRegistrationSerializer,
    PartnerSerializer, PartnerTripSerializer,
)


def listing_model_for(partner):
    return Hotels if partner.manages_hotels else Trips


def serializer_for(partner):
    return PartnerHotelSerializer if partner.manages_hotels else PartnerTripSerializer


def own_listings(partner):
    """The only queryset any partner endpoint may read listings through."""
    return listing_model_for(partner).objects.filter(partner=partner)


class PartnerRegister(APIView):
    """Apply to become a partner. Any signed-in customer may apply; approval is
    a separate, admin-only step."""

    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        if Partner.objects.filter(user=request.user).exists():
            return Response(partner_error(errors.ALREADY_A_PARTNER), status=400)

        serializer = PartnerRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(partner_error(errors.BUSINESS_NAME_REQUIRED), status=400)

        partner = serializer.save(user=request.user, is_approved=False)

        # The account is a partner from now on, but an unapproved one.
        Profile.objects.filter(user=request.user).update(role='partner')

        return Response(PartnerSerializer(partner).data, status=201)


class PartnerMe(APIView):
    """Own profile and approval status. Reachable while unapproved — it is what
    drives the pending-approval screen."""

    permission_classes = (IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        partner = partner_for(request.user)
        if partner is None:
            return Response(partner_error(errors.NOT_A_PARTNER), status=404)

        return Response(PartnerSerializer(partner).data, status=200)

    def patch(self, request, *args, **kwargs):
        partner = partner_for(request.user)
        if partner is None:
            return Response(partner_error(errors.NOT_A_PARTNER), status=404)

        # PartnerSerializer marks is_approved / partner_type read-only, so a
        # partner cannot promote themselves through this route.
        serializer = PartnerSerializer(partner, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(partner_error(errors.BUSINESS_NAME_REQUIRED), status=400)

        serializer.save()
        return Response(serializer.data, status=200)


def _resolve_trip_features(request):
    """Hotels require a Trip_features parent — an existing schema constraint,
    not an FR-46 invention. Resolved from a trip name in the payload."""
    trip_name = request.data.get('trip')
    if not trip_name:
        raise PartnerError(errors.TRIP_REQUIRED_FOR_HOTEL)

    features = Trip_features.objects.filter(name_id=trip_name).first()
    if features is None:
        raise PartnerError(errors.TRIP_FEATURES_MISSING)
    return features


class PartnerListings(APIView):
    """List and create. Scoped to whichever model the partner type manages."""

    permission_classes = (IsAuthenticated, IsApprovedPartner)

    def get(self, request, *args, **kwargs):
        partner = request.partner
        listings = own_listings(partner).order_by('name')
        return Response(serializer_for(partner)(listings, many=True).data, status=200)

    def post(self, request, *args, **kwargs):
        partner = request.partner
        serializer = serializer_for(partner)(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        extra = {'partner': partner}
        if partner.manages_trips:
            # `num` is the running tourist tally and has no model default; a
            # brand-new trip has had none. It is read-only on the serializer so
            # a partner cannot inflate their own popularity ranking.
            extra['num'] = 0
        if partner.manages_hotels:
            try:
                extra['trip_name'] = _resolve_trip_features(request)
            except PartnerError as error:
                return Response(error.payload, status=400)

        listing = serializer.save(**extra)
        return Response(serializer_for(partner)(listing).data, status=201)


class PartnerListingDetail(APIView):
    """Read, edit and delete one listing — only ever the caller's own."""

    permission_classes = (IsAuthenticated, IsApprovedPartner)

    def get_listing(self, request, listing_id):
        # Looked up inside the partner's own queryset, so another partner's id
        # is indistinguishable from one that does not exist.
        return own_listings(request.partner).filter(pk=listing_id).first()

    def get(self, request, listing_id, *args, **kwargs):
        listing = self.get_listing(request, listing_id)
        if listing is None:
            return Response(partner_error(errors.LISTING_NOT_FOUND), status=404)

        return Response(serializer_for(request.partner)(listing).data, status=200)

    def patch(self, request, listing_id, *args, **kwargs):
        listing = self.get_listing(request, listing_id)
        if listing is None:
            return Response(partner_error(errors.LISTING_NOT_FOUND), status=404)

        serializer = serializer_for(request.partner)(listing, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # `partner` is not a serializer field, so ownership cannot be reassigned.
        serializer.save()
        return Response(serializer.data, status=200)

    def delete(self, request, listing_id, *args, **kwargs):
        listing = self.get_listing(request, listing_id)
        if listing is None:
            return Response(partner_error(errors.LISTING_NOT_FOUND), status=404)

        try:
            listing.delete()
        except ProtectedError:
            # Trip_per_user.trip / .hotel are PROTECT: a listing people have
            # booked cannot be deleted out from under their history.
            return Response(partner_error(errors.LISTING_HAS_BOOKINGS), status=409)

        return Response(status=204)


def bookings_for(partner):
    """Bookings on this partner's listings, and nothing else."""
    if partner.manages_hotels:
        return Trip_per_user.objects.filter(hotel__partner=partner)
    return Trip_per_user.objects.filter(trip__partner=partner)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsApprovedPartner])
def partner_bookings(request):
    """Bookings on the caller's listings, filterable by date and status."""
    bookings = bookings_for(request.partner).select_related('username', 'trip', 'hotel')

    status_filter = request.query_params.get('status')
    if status_filter:
        bookings = bookings.filter(status=status_filter)

    date_from = request.query_params.get('from')
    if date_from:
        bookings = bookings.filter(trip_date__gte=date_from)

    date_to = request.query_params.get('to')
    if date_to:
        bookings = bookings.filter(trip_date__lte=date_to)

    rows = [
        {
            'id': booking.pk,
            'customer': booking.username_id,
            'trip': booking.trip_id,
            'hotel': booking.hotel_id,
            'trip_date': booking.trip_date,
            'hotel_reserve_date': booking.hotel_reserve_date,
            'seats': booking.seats,
            'price': booking.price,
            'status': booking.status,
            'is_paid': booking.is_paid,
        }
        for booking in bookings.order_by('-trip_date', '-pk')
    ]

    return Response(PartnerBookingSerializer(rows, many=True).data, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsApprovedPartner])
def partner_dashboard(request):
    """The four headline counts.

    Computed directly rather than through statistics_report.build_statistics:
    that helper takes no queryset and builds from every booking on the
    platform, so scoping it would mean changing its signature and every caller.
    Four counts did not justify that.
    """
    partner = request.partner
    today = timezone.localdate()

    listings = own_listings(partner)
    bookings = bookings_for(partner).exclude(status=STATUS_CANCELLED)

    date_field = 'hotel_reserve_date' if partner.manages_hotels else 'trip_date'
    upcoming = bookings.filter(**{f'{date_field}__gte': today}).count()

    rating = listings.aggregate(average=Avg('average_rating'))['average']

    return Response({
        'listings': listings.count(),
        'upcoming_bookings': upcoming,
        'total_bookings': bookings.count(),
        'average_rating': round(float(rating), 2) if rating is not None else 0,
    }, status=200)
