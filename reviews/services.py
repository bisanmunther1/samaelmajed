"""Recomputation of the denormalized rating aggregates on Trips / Hotels.

Only approved reviews count. Everything here writes with `.update()` so that
saving a review never triggers a full save of the trip or the hotel (their
pre_delete image cleanup and admin-entered `rate` stay untouched).
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Avg, Count

from hotels.models import Hotels
from trips.models import Trips

TWO_PLACES = Decimal('0.01')


def _aggregate(reviews):
    result = reviews.filter(is_approved=True).aggregate(
        average=Avg('rating'), count=Count('pk'),
    )
    count = result['count'] or 0
    average = Decimal(result['average'] or 0).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    return average, count


def recalculate_trip_rating(trip_id):
    """Recomputes the aggregates for one trip (identified by its name/pk)."""
    from .models import Review

    if not trip_id:
        return None

    average, count = _aggregate(Review.objects.filter(trip_id=trip_id))
    Trips.objects.filter(pk=trip_id).update(average_rating=average, reviews_count=count)
    return average, count


def recalculate_hotel_rating(hotel_id):
    """Recomputes the aggregates for one hotel (identified by its name/pk)."""
    from .models import Review

    if not hotel_id:
        return None

    average, count = _aggregate(Review.objects.filter(hotel_id=hotel_id))
    Hotels.objects.filter(pk=hotel_id).update(average_rating=average, reviews_count=count)
    return average, count


def recalculate_all_ratings():
    """Backfill/repair every trip and hotel. Returns how many rows were touched."""
    trips_updated = 0
    for trip_id in Trips.objects.values_list('pk', flat=True):
        recalculate_trip_rating(trip_id)
        trips_updated += 1

    hotels_updated = 0
    for hotel_id in Hotels.objects.values_list('pk', flat=True):
        recalculate_hotel_rating(hotel_id)
        hotels_updated += 1

    return trips_updated, hotels_updated
