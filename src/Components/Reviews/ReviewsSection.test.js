jest.mock('./reviewsApi');

import { render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../ui/Toast/ToastContext';
import ReviewsSection from './ReviewsSection';
import { fetch_pending_reviews, fetch_reviews, fetch_summary, is_logged_in } from './reviewsApi';

const HOTEL_ENTRY = {
  booking: 3, target_type: 'hotel', target_id: 'Nile Hotel',
  target_name: 'Nile Hotel', target_date: '2026-01-06', price: '150.00',
};

const TRIP_ENTRY = {
  booking: 3, target_type: 'trip', target_id: 'Cairo Trip',
  target_name: 'Cairo Trip', target_date: '2026-01-05', price: '150.00',
};

function renderSection(props = {}) {
  return render(
    <ToastProvider>
      <ReviewsSection targetType="trip" targetId="Cairo Trip" {...props} />
    </ToastProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  is_logged_in.mockReturnValue(true);
  fetch_summary.mockResolvedValue({ average: 4.5, count: 2, distribution: { 4: 1, 5: 1 } });
  fetch_reviews.mockResolvedValue({ count: 0, results: [] });
  fetch_pending_reviews.mockResolvedValue([]);
});

test('renders the summary for the target', async () => {
  renderSection();

  expect(await screen.findByText('4.5')).toBeInTheDocument();
  expect(screen.getByText('مراجعتان')).toBeInTheDocument();
  await waitFor(() => expect(fetch_summary).toHaveBeenCalledWith({
    targetType: 'trip', targetId: 'Cairo Trip',
  }));
});

test('hides the form when the user has no eligible booking for this target', async () => {
  renderSection();

  await screen.findByText('لا توجد مراجعات بعد');
  expect(screen.queryByRole('button', { name: 'إرسال المراجعة' })).not.toBeInTheDocument();
});

test('shows the form when this exact target is still outstanding', async () => {
  fetch_pending_reviews.mockResolvedValue([TRIP_ENTRY]);
  renderSection();

  expect(await screen.findByRole('button', { name: 'إرسال المراجعة' })).toBeInTheDocument();
  expect(screen.getByText('اكتب مراجعتك')).toBeInTheDocument();
});

test('an outstanding hotel on the same booking does not open the trip form', async () => {
  fetch_pending_reviews.mockResolvedValue([HOTEL_ENTRY]);
  renderSection();

  await screen.findByText('لا توجد مراجعات بعد');
  expect(screen.queryByRole('button', { name: 'إرسال المراجعة' })).not.toBeInTheDocument();
});

test('a reviewed hotel does not hide the trip form for the same booking', async () => {
  // The trip is still outstanding, the hotel is gone from /pending/ because it
  // was already reviewed — the trip form must still be offered.
  fetch_pending_reviews.mockResolvedValue([TRIP_ENTRY]);
  renderSection();

  expect(await screen.findByRole('button', { name: 'إرسال المراجعة' })).toBeInTheDocument();
});

test('the hotel section opens its own form from the same pending payload', async () => {
  fetch_pending_reviews.mockResolvedValue([HOTEL_ENTRY]);
  renderSection({ targetType: 'hotel', targetId: 'Nile Hotel' });

  expect(await screen.findByRole('button', { name: 'إرسال المراجعة' })).toBeInTheDocument();
});

test('does not ask for pending targets when logged out', async () => {
  is_logged_in.mockReturnValue(false);
  renderSection();

  await screen.findByText('لا توجد مراجعات بعد');
  expect(fetch_pending_reviews).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'إرسال المراجعة' })).not.toBeInTheDocument();
});
