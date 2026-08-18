"""Stable codes for FR-46, following the FR-38 convention: every rejection is
`{"detail": "<arabic>", "code": "<stable code>"}`."""

NOT_A_PARTNER = 'not_a_partner'
PARTNER_NOT_APPROVED = 'partner_not_approved'
ALREADY_A_PARTNER = 'already_a_partner'
LISTING_NOT_FOUND = 'listing_not_found'
LISTING_HAS_BOOKINGS = 'listing_has_bookings'
BUSINESS_NAME_REQUIRED = 'business_name_required'
TRIP_REQUIRED_FOR_HOTEL = 'trip_required_for_hotel'
TRIP_FEATURES_MISSING = 'trip_features_missing'

MESSAGES = {
    NOT_A_PARTNER: 'هذا الحساب ليس حساب شريك.',
    PARTNER_NOT_APPROVED: 'حساب الشريك قيد المراجعة، لم تتم الموافقة عليه بعد.',
    ALREADY_A_PARTNER: 'لديك طلب شراكة مسجّل بالفعل.',
    LISTING_NOT_FOUND: 'العنصر غير موجود.',
    LISTING_HAS_BOOKINGS: 'لا يمكن حذف عنصر عليه حجوزات قائمة.',
    BUSINESS_NAME_REQUIRED: 'اسم النشاط التجاري مطلوب.',
    TRIP_REQUIRED_FOR_HOTEL: 'يجب تحديد الرحلة التي ينتمي إليها الفندق.',
    TRIP_FEATURES_MISSING: 'الرحلة المحددة لا تحتوي على بيانات تفصيلية، لا يمكن ربط فندق بها.',
}


class PartnerError(Exception):
    def __init__(self, code):
        self.code = code
        self.detail = MESSAGES[code]
        super().__init__(self.detail)

    @property
    def payload(self):
        return {'detail': self.detail, 'code': self.code}


def partner_error(code):
    return {'detail': MESSAGES[code], 'code': code}
