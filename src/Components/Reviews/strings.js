// Every user-facing string for FR-38 lives here, in one module, so FR-44
// (bilingual support) can swap the whole set at once. Nothing in the Reviews
// components may inline Arabic copy in JSX.

export const REVIEW_STRINGS = {
  // section headings
  section_title: "التقييمات والمراجعات",
  list_title: "آراء المسافرين",
  form_title: "اكتب مراجعتك",
  pending_title: "بانتظار تقييمك",

  // star rating
  stars_label: "التقييم بالنجوم",
  star_option: (value) => `${value} من 5 نجوم`,
  stars_out_of: (value) => `${value} من 5`,
  rating_value: (value) => `${value}`,

  // summary
  reviews_count: (count) => {
    if (count === 0) return "لا توجد مراجعات";
    if (count === 1) return "مراجعة واحدة";
    if (count === 2) return "مراجعتان";
    if (count <= 10) return `${count} مراجعات`;
    return `${count} مراجعة`;
  },
  distribution_row: (stars) => `${stars} نجوم`,

  // list
  sort_label: "الترتيب حسب",
  sort_newest: "الأحدث",
  sort_highest: "الأعلى تقييماً",
  sort_lowest: "الأقل تقييماً",
  empty_title: "لا توجد مراجعات بعد",
  empty_message: "كن أول من يشارك تجربته.",
  load_error: "تعذّر تحميل المراجعات.",
  previous_page: "السابق",
  next_page: "التالي",
  page_position: (page, total) => `صفحة ${page} من ${total}`,
  edited_marker: "(مُعدّلة)",

  // form
  comment_label: "تعليقك (اختياري)",
  comment_placeholder: "شاركنا تفاصيل تجربتك…",
  characters_left: (used, max) => `${used} / ${max} حرف`,
  submit: "إرسال المراجعة",
  submit_edit: "حفظ التعديل",
  cancel: "إلغاء",
  edit: "تعديل",
  delete: "حذف",
  delete_confirm: "هل تريد حذف مراجعتك؟",
  rating_required: "يرجى اختيار تقييم من 1 إلى 5 نجوم.",
  comment_too_long_client: "التعليق يجب ألا يتجاوز 1000 حرف.",

  // outcomes
  created: "شكراً لك، تم نشر مراجعتك.",
  updated: "تم تحديث مراجعتك.",
  deleted: "تم حذف مراجعتك.",
  generic_error: "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.",
  login_required: "يرجى تسجيل الدخول لكتابة مراجعة.",

  // pending prompt — one call to action per outstanding target, so a booking
  // covering a trip and a hotel shows both until each is reviewed.
  rate_your_trip: "قيّم رحلتك",
  rate_your_stay: "قيّم إقامتك",
  pending_hint: "شاركنا رأيك في الرحلات التي أنهيتها.",
  pending_date: (date) => `بتاريخ ${date}`,
};

// Server error codes → Arabic copy. The server already sends an Arabic
// `detail`; this map is the fallback when a response arrives without one, and
// the single place to re-word a rule for the user.
export const REVIEW_ERROR_MESSAGES = {
  target_required: "يجب تحديد الرحلة أو الفندق المراد تقييمه.",
  target_ambiguous: "لا يمكن تقييم رحلة وفندق في مراجعة واحدة، اختر واحداً فقط.",
  target_mismatch: "العنصر الذي تحاول تقييمه لا يطابق الحجز المحدد.",
  booking_not_owned: "هذا الحجز لا يخصّك، لا يمكنك تقييمه.",
  booking_not_completed: "لا يمكن التقييم قبل إتمام دفع الحجز.",
  trip_not_finished: "لا يمكنك تقييم الرحلة قبل انتهائها.",
  hotel_stay_not_finished: "لا يمكنك تقييم الفندق قبل انتهاء إقامتك.",
  duplicate_trip_review: "لقد قمت بتقييم هذه الرحلة مسبقاً.",
  duplicate_hotel_review: "لقد قمت بتقييم هذا الفندق مسبقاً.",
  invalid_rating: "التقييم يجب أن يكون رقماً بين 1 و 5.",
  comment_too_long: "التعليق يجب ألا يتجاوز 1000 حرف.",
  not_review_author: "يمكنك تعديل مراجعتك أنت فقط.",
  edit_window_expired: "انتهت مهلة تعديل المراجعة (14 يوماً من تاريخ كتابتها).",
};

export const MAX_COMMENT_LENGTH = 1000;

export const SORT_OPTIONS = [
  { value: "-created_at", label: REVIEW_STRINGS.sort_newest },
  { value: "-rating", label: REVIEW_STRINGS.sort_highest },
  { value: "rating", label: REVIEW_STRINGS.sort_lowest },
];
