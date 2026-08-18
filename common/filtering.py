"""FR-39 — shared query-parameter filtering for the trip and hotel listings.

Lives outside any one app because both `trips` and `hotels` filter on the same
shapes (price range, review aggregates, ordering) and neither should have to
import from the other.

Two rules the callers rely on:
  * Applying no recognised parameters returns the queryset untouched, so a
    request without filters behaves exactly as it did before FR-39.
  * Unknown parameters are ignored; a *recognised* parameter carrying an
    unusable value raises FilterError, which the view turns into a coded 400.

Error bodies follow the FR-38 convention: {"detail": "<arabic>", "code": "<code>"}.
"""

from decimal import Decimal, InvalidOperation

from django.db.models import Q

from trips.pricing import compute_final_price

INVALID_PRICE = 'invalid_price'
INVALID_PRICE_RANGE = 'invalid_price_range'
INVALID_RATING = 'invalid_rating'
INVALID_ORDERING = 'invalid_ordering'
INVALID_BOOLEAN = 'invalid_boolean'

MESSAGES = {
    INVALID_PRICE: 'قيمة السعر يجب أن تكون رقماً موجباً.',
    INVALID_PRICE_RANGE: 'الحد الأدنى للسعر يجب ألا يتجاوز الحد الأعلى.',
    INVALID_RATING: 'التقييم يجب أن يكون رقماً بين 0 و 5.',
    INVALID_ORDERING: 'قيمة الترتيب غير مدعومة.',
    INVALID_BOOLEAN: 'قيمة الحقل يجب أن تكون true أو false.',
}

MAX_RATING = Decimal('5')

# Whitelisted so `ordering` can never reach the ORM as arbitrary user input.
# `-name`, `-num` and `-rate` carry over the sorts the retired Gallery filter
# panel offered (reverse alphabetical, most-visited, and the editorial rating)
# so removing it cost no capability.
TRIP_ORDERING = {
    'price', '-price', '-average_rating', '-reviews_count',
    'name', '-name', '-num', '-rate',
}
HOTEL_ORDERING = {'price', '-price', '-average_rating', '-reviews_count', 'name'}

TRUE_VALUES = {'true', '1', 'yes'}
FALSE_VALUES = {'false', '0', 'no'}


class FilterError(Exception):
    """A recognised parameter carrying an unusable value."""

    def __init__(self, code):
        self.code = code
        self.detail = MESSAGES[code]
        super().__init__(self.detail)

    @property
    def payload(self):
        return {'detail': self.detail, 'code': self.code}


def _blank(value):
    return value is None or str(value).strip() == ''


def parse_price(value):
    try:
        price = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise FilterError(INVALID_PRICE)
    if price < 0:
        raise FilterError(INVALID_PRICE)
    return price


def parse_rating(value):
    try:
        rating = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise FilterError(INVALID_RATING)
    if rating < 0 or rating > MAX_RATING:
        raise FilterError(INVALID_RATING)
    return rating


def parse_boolean(value):
    text = str(value).strip().lower()
    if text in TRUE_VALUES:
        return True
    if text in FALSE_VALUES:
        return False
    raise FilterError(INVALID_BOOLEAN)


def parse_ordering(value, allowed):
    ordering = str(value).strip()
    if ordering not in allowed:
        raise FilterError(INVALID_ORDERING)
    return ordering


def _parse_price_bounds(params):
    minimum = params.get('min_price')
    maximum = params.get('max_price')

    parsed_min = None if _blank(minimum) else parse_price(minimum)
    parsed_max = None if _blank(maximum) else parse_price(maximum)

    if parsed_min is not None and parsed_max is not None and parsed_min > parsed_max:
        raise FilterError(INVALID_PRICE_RANGE)

    return parsed_min, parsed_max


def _apply_price_range(queryset, params):
    """Hotels carry no discount, so the listed `price` is what a customer
    sees -- filter on it directly."""
    parsed_min, parsed_max = _parse_price_bounds(params)

    if parsed_min is not None:
        queryset = queryset.filter(price__gte=parsed_min)
    if parsed_max is not None:
        queryset = queryset.filter(price__lte=parsed_max)

    return queryset


def _apply_trip_price_range(queryset, params):
    """Trips display `final_price` (their `price` after `discount`), so a
    price filter has to bound the same number the card shows -- not the raw
    `price` a discount may sit well below. Reuses trips/pricing.py's
    `compute_final_price` rather than re-deriving the discount math here, so
    the two can never drift apart.
    """
    parsed_min, parsed_max = _parse_price_bounds(params)

    if parsed_min is None and parsed_max is None:
        return queryset

    matching_names = [
        trip.name for trip in queryset.only('name', 'price', 'discount')
        if _within_bounds(compute_final_price(trip.price, trip.discount), parsed_min, parsed_max)
    ]
    return queryset.filter(name__in=matching_names)


def _within_bounds(value, minimum, maximum):
    if minimum is not None and value < minimum:
        return False
    if maximum is not None and value > maximum:
        return False
    return True


def _apply_min_rating(queryset, params):
    value = params.get('min_rating')
    if _blank(value):
        return queryset
    # The FR-38 aggregate, not the editorial `rate` column.
    return queryset.filter(average_rating__gte=parse_rating(value))


def apply_trip_filters(queryset, params):
    search = params.get('search')
    if not _blank(search):
        term = search.strip()
        queryset = queryset.filter(Q(name__icontains=term) | Q(place__icontains=term))

    place = params.get('place')
    if not _blank(place):
        queryset = queryset.filter(place=place.strip())

    queryset = _apply_trip_price_range(queryset, params)
    queryset = _apply_min_rating(queryset, params)

    available = params.get('available')
    if not _blank(available):
        queryset = queryset.filter(available=parse_boolean(available))

    ordering = params.get('ordering')
    if not _blank(ordering):
        queryset = queryset.order_by(parse_ordering(ordering, TRIP_ORDERING))

    return queryset


def apply_hotel_filters(queryset, params):
    search = params.get('search')
    if not _blank(search):
        # Hotel name only. Hotels carry no destination of their own, and their
        # trip is three joins away (Hotels -> Trip_features -> Trips.name),
        # which is not what "search the listing" should mean here.
        queryset = queryset.filter(name__icontains=search.strip())

    queryset = _apply_price_range(queryset, params)
    queryset = _apply_min_rating(queryset, params)

    ordering = params.get('ordering')
    if not _blank(ordering):
        queryset = queryset.order_by(parse_ordering(ordering, HOTEL_ORDERING))

    return queryset


def has_any(params, names):
    """True when the request carries at least one of `names` with a value."""
    return any(not _blank(params.get(name)) for name in names)
