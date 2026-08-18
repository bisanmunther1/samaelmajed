"""Stable codes for FR-45, following the FR-38 convention: every rejection is
`{"detail": "<arabic>", "code": "<stable code>"}`.

Codes are part of the API contract — rename them only with the frontend.
"""

PROMO_NOT_FOUND = 'promo_not_found'
PROMO_INACTIVE = 'promo_inactive'
PROMO_NOT_IN_WINDOW = 'promo_not_in_window'
PROMO_USAGE_LIMIT_REACHED = 'promo_usage_limit_reached'
PROMO_USER_LIMIT_REACHED = 'promo_user_limit_reached'
PROMO_MIN_AMOUNT_NOT_MET = 'promo_min_amount_not_met'
PROMO_TRIP_NOT_ELIGIBLE = 'promo_trip_not_eligible'
PROMO_INVALID_AMOUNT = 'promo_invalid_amount'

MESSAGES = {
    PROMO_NOT_FOUND: 'كود الخصم غير صحيح.',
    PROMO_INACTIVE: 'كود الخصم غير مُفعّل.',
    PROMO_NOT_IN_WINDOW: 'كود الخصم غير صالح في هذا التاريخ.',
    PROMO_USAGE_LIMIT_REACHED: 'تم استنفاد هذا الكود.',
    PROMO_USER_LIMIT_REACHED: 'لقد استخدمت هذا الكود من قبل.',
    PROMO_MIN_AMOUNT_NOT_MET: 'قيمة الحجز أقل من الحد الأدنى المطلوب لهذا الكود.',
    PROMO_TRIP_NOT_ELIGIBLE: 'هذا الكود لا ينطبق على هذه الرحلة.',
    PROMO_INVALID_AMOUNT: 'قيمة الحجز غير صحيحة.',
}


class PromoCodeError(Exception):
    """A promo code that cannot be applied, with the reason."""

    def __init__(self, code):
        self.code = code
        self.detail = MESSAGES[code]
        super().__init__(self.detail)

    @property
    def payload(self):
        return {'detail': self.detail, 'code': self.code}
