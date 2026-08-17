// Every user-facing string for FR-39 lives here, in one module, mirroring
// FR-38's src/Components/Reviews/strings.js so FR-44 can swap both at once.

export const FILTER_STRINGS = {
  title: "البحث المتقدم",

  search_label: "ابحث",
  search_placeholder: "اسم الرحلة أو الوجهة…",

  place_label: "الوجهة",
  place_any: "كل الوجهات",

  price_label: "نطاق السعر",
  min_price_placeholder: "من",
  max_price_placeholder: "إلى",

  rating_label: "أقل تقييم",
  rating_any: "أي تقييم",

  sort_label: "ترتيب حسب",

  reset: "مسح الفلاتر",

  results_count: (count) => `عدد النتائج: ${count}`,

  empty_title: "لا توجد رحلات مطابقة",
  empty_message: "جرّب توسيع نطاق البحث أو مسح الفلاتر.",

  // Surfaced when the server rejects a filter value.
  invalid_filters: "تعذّر تطبيق الفلاتر، تحقّق من القيم المدخلة.",
};

// Server codes from common/filtering.py -> Arabic copy. The server already
// sends an Arabic `detail`; this is the fallback and the single place to
// re-word a rule for the user.
export const FILTER_ERROR_MESSAGES = {
  invalid_price: "قيمة السعر يجب أن تكون رقماً موجباً.",
  invalid_price_range: "الحد الأدنى للسعر يجب ألا يتجاوز الحد الأعلى.",
  invalid_rating: "التقييم يجب أن يكون رقماً بين 0 و 5.",
  invalid_ordering: "قيمة الترتيب غير مدعومة.",
  invalid_boolean: "قيمة الحقل يجب أن تكون true أو false.",
};

// Values match the `ordering` whitelist in common/filtering.py.
export const SORT_OPTIONS = [
  { value: "", label: "الافتراضي" },
  { value: "price", label: "السعر: من الأقل" },
  { value: "-price", label: "السعر: من الأعلى" },
  { value: "-average_rating", label: "الأعلى حسب مراجعات الزوار" },
  { value: "-rate", label: "الأعلى حسب تقييم الموقع" },
  { value: "-reviews_count", label: "الأكثر مراجعات" },
  { value: "-num", label: "الأكثر زيارة" },
  { value: "name", label: "الاسم: أ إلى ي" },
  { value: "-name", label: "الاسم: ي إلى أ" },
];

// The query-string keys. Shared by the FilterBar and the results grid so the
// two can never drift apart.
export const FILTER_KEYS = ["search", "place", "min_price", "max_price", "min_rating", "ordering"];
