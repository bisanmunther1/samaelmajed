// Every user-facing string for FR-45, in one module, matching the pattern of
// FR-38 (Reviews) and FR-39 (Filters) so FR-44 can swap them together.

export const PROMO_STRINGS = {
  label: "كود الخصم",
  placeholder: "أدخل كود الخصم",
  apply: "تطبيق",
  remove: "إزالة",

  applied_title: (code) => `تم تطبيق الكود ${code}`,

  summary_original: "السعر الأصلي",
  summary_discount: "الخصم",
  summary_final: "الإجمالي بعد الخصم",

  empty_code: "الرجاء إدخال كود الخصم.",
  generic_error: "تعذّر تطبيق الكود، حاول مرة أخرى.",
  login_required: "يرجى تسجيل الدخول لاستخدام كود الخصم.",
};

// Server codes from promotions/errors.py -> Arabic copy. The server already
// sends an Arabic `detail`; this is the fallback and the one place to re-word
// a rule for the user.
export const PROMO_ERROR_MESSAGES = {
  promo_not_found: "كود الخصم غير صحيح.",
  promo_inactive: "كود الخصم غير مُفعّل.",
  promo_not_in_window: "كود الخصم غير صالح في هذا التاريخ.",
  promo_usage_limit_reached: "تم استنفاد هذا الكود.",
  promo_user_limit_reached: "لقد استخدمت هذا الكود من قبل.",
  promo_min_amount_not_met: "قيمة الحجز أقل من الحد الأدنى المطلوب لهذا الكود.",
  promo_trip_not_eligible: "هذا الكود لا ينطبق على هذه الرحلة.",
  promo_invalid_amount: "قيمة الحجز غير صحيحة.",
};
