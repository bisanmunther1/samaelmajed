import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar";
import en from "./en";

export const STORAGE_KEY = "language";
export const DEFAULT_LANGUAGE = "ar";
export const LANGUAGES = ["ar", "en"];

const NAMESPACES = [
  "common", "auth", "profile", "gallery", "discount", "reserve",
  "reviews", "filters", "promotions", "bookings", "partner", "errors",
];

export function stored_language() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  } catch (error) {
    // Storage can be unavailable (private mode, disabled cookies); the default
    // language is a fine answer and must never take the app down.
    return DEFAULT_LANGUAGE;
  }
}

/** Puts `lang` and `dir` on <html> so one stylesheet serves both directions. */
export function apply_document_direction(language) {
  const direction = language === "ar" ? "rtl" : "ltr";

  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("lang", language);
    document.documentElement.setAttribute("dir", direction);
  }

  return direction;
}

i18n.use(initReactI18next).init({
  resources: { ar: { ...ar }, en: { ...en } },
  lng: stored_language(),
  // Arabic is the source language, so it is also the fallback: a key missing
  // from en.js shows Arabic rather than the raw key.
  fallbackLng: DEFAULT_LANGUAGE,
  ns: NAMESPACES,
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnNull: false,
});

apply_document_direction(i18n.language);

/** Switches language, persists the choice and flips the document direction. */
export function set_language(language) {
  if (!LANGUAGES.includes(language)) return;

  i18n.changeLanguage(language);
  apply_document_direction(language);

  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch (error) {
    // A non-persisted switch still works for this session.
  }
}

export function current_language() {
  return LANGUAGES.includes(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

export function is_rtl() {
  return current_language() === "ar";
}

/** `t` outside a component — used by the strings shims and the API layers. */
export function translate(key, options) {
  return i18n.t(key, options);
}

export default i18n;
