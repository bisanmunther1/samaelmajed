"""FR-40 — the cancellation refund policy, in one place.

Change the thresholds or the rates here and every endpoint, preview and test
follows. Nothing else in the codebase should hardcode a refund percentage.
"""

from decimal import ROUND_HALF_UP, Decimal

TIER_FULL = 'full'
TIER_PARTIAL = 'partial'
TIER_NONE = 'none'

# Days between the cancellation and the departure date.
FULL_REFUND_ABOVE_DAYS = 7      # strictly more than this -> full refund
PARTIAL_REFUND_FROM_DAYS = 3    # this many days or more (but <= 7) -> half

REFUND_RATES = {
    TIER_FULL: Decimal('1.00'),
    TIER_PARTIAL: Decimal('0.50'),
    TIER_NONE: Decimal('0.00'),
}

TWO_PLACES = Decimal('0.01')


def refund_tier(days_until_departure):
    if days_until_departure > FULL_REFUND_ABOVE_DAYS:
        return TIER_FULL
    if days_until_departure >= PARTIAL_REFUND_FROM_DAYS:
        return TIER_PARTIAL
    return TIER_NONE


def refund_rate(tier):
    return REFUND_RATES[tier]


def refund_amount(price, days_until_departure):
    """The refund on `price` for a cancellation this many days out."""
    tier = refund_tier(days_until_departure)
    amount = (price or Decimal('0')) * refund_rate(tier)
    return tier, Decimal(amount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
