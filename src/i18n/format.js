// Locale-aware date and number formatting.
//
// Arabic uses the ar-EG locale with Latin digits (`nu-latn`): the catalogue,
// prices and seat counts are all written in Latin digits elsewhere in the app,
// and switching only these to Arabic-Indic numerals would look like a bug
// rather than a feature.

import { current_language } from "./index";

const LOCALES = {
  ar: "ar-EG-u-nu-latn",
  en: "en-GB",
};

function locale_for(language) {
  return LOCALES[language || current_language()] || LOCALES.ar;
}

/** A date (Date or ISO string) in the active locale. Falsy input passes through. */
export function format_date(value, options) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(locale_for(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

/** A number in the active locale. Non-numeric input passes through unchanged. */
export function format_number(value, options) {
  if (value === null || value === undefined || value === "") return "";

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);

  return new Intl.NumberFormat(locale_for(), options).format(numeric);
}
