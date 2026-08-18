"""Stable error codes for the booking endpoints, following the FR-38 convention
in reviews/errors.py: every rejection is `{"detail": "<arabic>", "code": "<code>"}`
so a client can branch on the code and still have something to show if it does
not recognise it.

Codes are part of the API contract — rename them only with the frontend.
"""

TRIP_NOT_FOUND = 'trip_not_found'
TRIP_NOT_AVAILABLE = 'trip_not_available'
HOTEL_NOT_FOUND = 'hotel_not_found'

# FR-43 capacity
NO_SEATS_AVAILABLE = 'no_seats_available'
INVALID_SEATS = 'invalid_seats'

# FR-40 cancellation
BOOKING_NOT_FOUND = 'booking_not_found'
BOOKING_ALREADY_CANCELLED = 'booking_already_cancelled'
TRIP_ALREADY_DEPARTED = 'trip_already_departed'

MESSAGES = {
    TRIP_NOT_FOUND: 'الرحلة المطلوبة غير موجودة.',
    TRIP_NOT_AVAILABLE: 'هذه الرحلة غير متاحة للحجز حالياً.',
    HOTEL_NOT_FOUND: 'الفندق المطلوب غير موجود.',

    NO_SEATS_AVAILABLE: 'لم يتبقَ سوى {remaining} مقعد لهذا التاريخ.',
    INVALID_SEATS: 'عدد المسافرين يجب أن يكون رقماً أكبر من صفر.',

    BOOKING_NOT_FOUND: 'الحجز غير موجود.',
    BOOKING_ALREADY_CANCELLED: 'تم إلغاء هذا الحجز مسبقاً.',
    TRIP_ALREADY_DEPARTED: 'لا يمكن إلغاء حجز لرحلة انطلقت بالفعل.',
}


class BookingError(Exception):
    """A booking action that cannot proceed, with the reason."""

    def __init__(self, code, **params):
        self.code = code
        self.detail = MESSAGES[code].format(**params)
        super().__init__(self.detail)

    @property
    def payload(self):
        return {'detail': self.detail, 'code': self.code}


def booking_error(code, **params):
    """The response body for one of the codes above. `params` fills in any
    placeholder in the message (e.g. how many seats remain)."""
    return {'detail': MESSAGES[code].format(**params), 'code': code}
