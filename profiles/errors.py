"""Stable error codes for the booking endpoint, following the FR-38 convention
in reviews/errors.py: every rejection is `{"detail": "<arabic>", "code": "<code>"}`
so a client can branch on the code and still have something to show if it does
not recognise it.

Codes are part of the API contract — rename them only with the frontend.
"""

TRIP_NOT_FOUND = 'trip_not_found'
TRIP_NOT_AVAILABLE = 'trip_not_available'
HOTEL_NOT_FOUND = 'hotel_not_found'

MESSAGES = {
    TRIP_NOT_FOUND: 'الرحلة المطلوبة غير موجودة.',
    TRIP_NOT_AVAILABLE: 'هذه الرحلة غير متاحة للحجز حالياً.',
    HOTEL_NOT_FOUND: 'الفندق المطلوب غير موجود.',
}


def booking_error(code):
    """The response body for one of the codes above."""
    return {'detail': MESSAGES[code], 'code': code}
