from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from trips.models import Trips

from .errors import PromoCodeError
from .serializers import ActivePromoCodeSerializer
from .services import active_promo_codes, parse_amount, validate_promo_code


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_code(request):
    """Dry run. Prices a code for a would-be booking and changes nothing —
    no usage row, no counter increment. Authenticated because the per-user
    limit is one of the things being checked.
    """
    data = request.data

    trip_name = data.get('trip')
    trip = Trips.objects.filter(name=trip_name).first() if trip_name else None

    try:
        amount = parse_amount(data.get('amount'))
        promo, discount = validate_promo_code(
            code=data.get('code'),
            amount=amount,
            user=request.user,
            trip=trip,
        )
    except PromoCodeError as error:
        return Response(error.payload, status=400)

    return Response({
        'valid': True,
        'code': promo.code,
        'description': promo.description,
        'discount_amount': discount,
        'final_amount': amount - discount,
    }, status=200)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_active_codes(request):
    """Publicly advertisable offers — see services.active_promo_codes for what
    is excluded and why."""
    codes = active_promo_codes()
    return Response(ActivePromoCodeSerializer(codes, many=True).data, status=200)
