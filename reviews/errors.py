"""Stable machine-readable error codes for FR-38, with their Arabic copy.

Every rejection the review serializer raises is emitted as
`{"detail": "<arabic message>", "code": "<stable code>"}` so the React layer can
branch on the code and still have something to show if it does not recognise it.
Codes are part of the API contract — rename them only with the frontend.
"""

from rest_framework import serializers

TARGET_REQUIRED = 'target_required'
TARGET_AMBIGUOUS = 'target_ambiguous'
TARGET_MISMATCH = 'target_mismatch'
BOOKING_NOT_OWNED = 'booking_not_owned'
BOOKING_NOT_COMPLETED = 'booking_not_completed'
BOOKING_CANCELLED = 'booking_cancelled'
TRIP_NOT_FINISHED = 'trip_not_finished'
HOTEL_STAY_NOT_FINISHED = 'hotel_stay_not_finished'
DUPLICATE_TRIP_REVIEW = 'duplicate_trip_review'
DUPLICATE_HOTEL_REVIEW = 'duplicate_hotel_review'
INVALID_RATING = 'invalid_rating'
COMMENT_TOO_LONG = 'comment_too_long'
NOT_REVIEW_AUTHOR = 'not_review_author'
EDIT_WINDOW_EXPIRED = 'edit_window_expired'

MESSAGES = {
    TARGET_REQUIRED: 'يجب تحديد الرحلة أو الفندق المراد تقييمه.',
    TARGET_AMBIGUOUS: 'لا يمكن تقييم رحلة وفندق في مراجعة واحدة، اختر واحداً فقط.',
    TARGET_MISMATCH: 'العنصر الذي تحاول تقييمه لا يطابق الحجز المحدد.',
    BOOKING_NOT_OWNED: 'هذا الحجز لا يخصّك، لا يمكنك تقييمه.',
    BOOKING_NOT_COMPLETED: 'لا يمكن التقييم قبل إتمام دفع الحجز.',
    BOOKING_CANCELLED: 'لا يمكن تقييم حجز تم إلغاؤه.',
    TRIP_NOT_FINISHED: 'لا يمكنك تقييم الرحلة قبل انتهائها.',
    HOTEL_STAY_NOT_FINISHED: 'لا يمكنك تقييم الفندق قبل انتهاء إقامتك.',
    DUPLICATE_TRIP_REVIEW: 'لقد قمت بتقييم هذه الرحلة مسبقاً.',
    DUPLICATE_HOTEL_REVIEW: 'لقد قمت بتقييم هذا الفندق مسبقاً.',
    INVALID_RATING: 'التقييم يجب أن يكون رقماً بين 1 و 5.',
    COMMENT_TOO_LONG: 'التعليق يجب ألا يتجاوز 1000 حرف.',
    NOT_REVIEW_AUTHOR: 'يمكنك تعديل مراجعتك أنت فقط.',
    EDIT_WINDOW_EXPIRED: 'انتهت مهلة تعديل المراجعة (14 يوماً من تاريخ كتابتها).',
}


def review_error(code):
    """Builds the ValidationError for one of the codes above."""
    return serializers.ValidationError({'detail': MESSAGES[code], 'code': code}, code=code)


def find_coded_error(data):
    """Digs the `{detail, code}` payload back out of a DRF error response.

    DRF renders the two kinds of rejection differently — an error from
    `validate()` comes back with its values wrapped in lists, while one from
    `validate_<field>()` comes back nested under the field name. Both carry the
    same payload, so this unwraps either into one flat object and the frontend
    only ever has to read `response.data.code`.

    Returns None for errors we did not raise (a missing required field, say),
    which are left in DRF's own shape.
    """
    if isinstance(data, dict):
        detail = data.get('detail')
        code = data.get('code')
        if detail is not None and code is not None:
            detail = detail[0] if isinstance(detail, list) and detail else detail
            code = code[0] if isinstance(code, list) and code else code
            if str(code) in MESSAGES:
                return {'detail': str(detail), 'code': str(code)}

        for value in data.values():
            found = find_coded_error(value)
            if found is not None:
                return found

    elif isinstance(data, list):
        for value in data:
            found = find_coded_error(value)
            if found is not None:
                return found

    return None
