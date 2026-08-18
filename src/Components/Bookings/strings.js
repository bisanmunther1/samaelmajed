// Every user-facing string for FR-43 (capacity) and FR-40 (cancellation), in
// one module, matching FR-38 / FR-39 / FR-45 so FR-44 can swap them together.

export const BOOKING_STRINGS = {
  // seats
  seats_label: "عدد المسافرين",
  seats_remaining: (remaining) => `المقاعد المتبقية: ${remaining}`,
  seats_sold_out: "مكتمل الحجز",
  seats_loading: "جارٍ التحقق من المقاعد…",

  // cancellation
  cancel_action: "إلغاء الحجز",
  cancel_title: "تأكيد إلغاء الحجز",
  cancel_confirm: "تأكيد الإلغاء",
  cancel_dismiss: "تراجع",
  cancel_reason_label: "سبب الإلغاء (اختياري)",
  cancel_reason_placeholder: "أخبرنا لماذا تلغي الحجز…",

  refund_preview: "المبلغ المسترد",
  refund_tier_full: "استرداد كامل (أكثر من 7 أيام على الرحلة)",
  refund_tier_partial: "استرداد 50% (من 3 إلى 7 أيام على الرحلة)",
  refund_tier_none: "لا يوجد استرداد (أقل من 3 أيام على الرحلة)",

  days_until: (days) => `${days} يوم حتى موعد الرحلة`,

  // booking row state
  status_cancelled: "ملغى",
  refund_status_pending: "الاسترداد قيد المعالجة",
  refund_status_completed: "تم الاسترداد",
  refund_status_not_applicable: "لا يوجد استرداد",

  cancelled_success: "تم إلغاء الحجز.",
  generic_error: "تعذّر إتمام العملية، حاول مرة أخرى.",
  login_required: "يرجى تسجيل الدخول.",
};

// Server codes from profiles/errors.py -> Arabic copy. The server already sends
// an Arabic `detail`; this is the fallback and the one place to re-word a rule.
export const BOOKING_ERROR_MESSAGES = {
  no_seats_available: "لم يتبقَ عدد كافٍ من المقاعد لهذا التاريخ.",
  invalid_seats: "عدد المسافرين يجب أن يكون رقماً أكبر من صفر.",
  booking_not_found: "الحجز غير موجود.",
  booking_already_cancelled: "تم إلغاء هذا الحجز مسبقاً.",
  trip_already_departed: "لا يمكن إلغاء حجز لرحلة انطلقت بالفعل.",
  trip_not_found: "الرحلة المطلوبة غير موجودة.",
  trip_not_available: "هذه الرحلة غير متاحة للحجز حالياً.",
  hotel_not_found: "الفندق المطلوب غير موجود.",
};

export const REFUND_TIER_LABELS = {
  full: BOOKING_STRINGS.refund_tier_full,
  partial: BOOKING_STRINGS.refund_tier_partial,
  none: BOOKING_STRINGS.refund_tier_none,
};

export const REFUND_STATUS_LABELS = {
  pending: BOOKING_STRINGS.refund_status_pending,
  completed: BOOKING_STRINGS.refund_status_completed,
  not_applicable: BOOKING_STRINGS.refund_status_not_applicable,
};
