import { render, screen } from '@testing-library/react';
import i18n, {
  DEFAULT_LANGUAGE, STORAGE_KEY, apply_document_direction, current_language,
  set_language, stored_language,
} from './index';
import { format_date, format_number } from './format';
import { REVIEW_STRINGS, REVIEW_ERROR_MESSAGES } from '../Components/Reviews/strings';
import { BOOKING_STRINGS } from '../Components/Bookings/strings';
import RatingSummary from '../Components/Reviews/RatingSummary';

afterEach(() => {
  set_language(DEFAULT_LANGUAGE);
});

test('Arabic is the default language and the document is RTL', () => {
  set_language('ar');

  expect(current_language()).toBe('ar');
  expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  expect(document.documentElement.getAttribute('lang')).toBe('ar');
});

test('switching to English flips the document direction', () => {
  set_language('en');

  expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  expect(document.documentElement.getAttribute('lang')).toBe('en');
});

test('switching language changes the visible copy', () => {
  set_language('ar');
  expect(REVIEW_STRINGS.submit).toBe('إرسال المراجعة');

  set_language('en');
  expect(REVIEW_STRINGS.submit).toBe('Submit review');
});

test('interpolated strings translate too', () => {
  set_language('ar');
  expect(BOOKING_STRINGS.seats_remaining(4)).toContain('4');

  set_language('en');
  expect(BOOKING_STRINGS.seats_remaining(4)).toBe('Seats remaining: 4');
});

test('the choice is persisted and restored on load', () => {
  set_language('en');

  expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
  expect(stored_language()).toBe('en');
});

test('an unknown stored language falls back to the default', () => {
  localStorage.setItem(STORAGE_KEY, 'fr');

  expect(stored_language()).toBe(DEFAULT_LANGUAGE);
});

test('a server error code renders in the active language', () => {
  // The backend always sends Arabic; the frontend translates by code.
  set_language('ar');
  expect(REVIEW_ERROR_MESSAGES.duplicate_trip_review).toBe('لقد قمت بتقييم هذه الرحلة مسبقاً.');

  set_language('en');
  expect(REVIEW_ERROR_MESSAGES.duplicate_trip_review).toBe('You have already reviewed this trip.');
});

test('an unrecognised server code falls through to the server message', () => {
  set_language('en');

  // undefined is what makes the API layers fall back to `detail`.
  expect(REVIEW_ERROR_MESSAGES.some_code_we_do_not_know).toBeUndefined();
});

test('a rendered component picks up the active language', () => {
  set_language('en');
  const { unmount } = render(
    <RatingSummary average={4.5} count={2} distribution={{ 4: 1, 5: 1 }} />
  );
  expect(screen.getByText('2 reviews')).toBeInTheDocument();
  unmount();

  set_language('ar');
  render(<RatingSummary average={4.5} count={2} distribution={{ 4: 1, 5: 1 }} />);
  expect(screen.getByText('مراجعتان')).toBeInTheDocument();
});

test('Arabic plural forms are used for review counts', () => {
  set_language('ar');

  expect(REVIEW_STRINGS.reviews_count(0)).toBe('لا توجد مراجعات');
  expect(REVIEW_STRINGS.reviews_count(1)).toBe('مراجعة واحدة');
  expect(REVIEW_STRINGS.reviews_count(2)).toBe('مراجعتان');
});

test('dates and numbers follow the active locale', () => {
  set_language('en');
  const english = format_date('2026-03-05');
  expect(english).toMatch(/2026/);
  expect(format_number(1234.5)).toBe('1,234.5');

  set_language('ar');
  expect(format_date('2026-03-05')).toMatch(/2026/);
});

test('formatting helpers pass unusable input through instead of throwing', () => {
  expect(format_date('')).toBe('');
  expect(format_date('not-a-date')).toBe('not-a-date');
  expect(format_number('abc')).toBe('abc');
  expect(format_number(null)).toBe('');
});

test('apply_document_direction reports the direction it set', () => {
  expect(apply_document_direction('en')).toBe('ltr');
  expect(apply_document_direction('ar')).toBe('rtl');
});

test('i18n exposes both languages', () => {
  expect(Object.keys(i18n.options.resources)).toEqual(expect.arrayContaining(['ar', 'en']));
});
