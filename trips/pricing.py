"""The single place a trip's catalog price and discount badge agree.

`Trips.discount` is a percentage off `Trips.price`; `final_price` is the
number that percentage actually implies. Every endpoint that lists trips for
a card (send_trip_cards, trending_places, discounted_places) computes it
through `compute_final_price` so the price shown next to the discount badge
can never drift from the badge itself.

This is deliberately NOT the price the booking endpoint charges — bookings
are priced from the chosen transport + hotel (see profiles/views.py), which
never reads `Trips.price`/`Trips.discount`. `final_price` only keeps the
catalog card internally consistent with its own badge.
"""

from decimal import ROUND_HALF_UP, Decimal

HUNDRED = Decimal('100')
WHOLE = Decimal('1')


def compute_final_price(price, discount):
    price = Decimal(price)
    discount = Decimal(discount or 0)
    final = price - (price * discount / HUNDRED)
    return final.quantize(WHOLE, rounding=ROUND_HALF_UP)
