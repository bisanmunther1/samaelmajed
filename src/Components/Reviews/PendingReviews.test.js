jest.mock('./reviewsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../ui/Toast/ToastContext';
import PendingReviews from './PendingReviews';
import { fetch_pending_reviews, is_logged_in } from './reviewsApi';

const TRIP_ENTRY = {
  booking: 3, target_type: 'trip', target_id: 'Cairo Trip',
  target_name: 'Cairo Trip', target_date: '2026-01-05', price: '150.00',
};

const HOTEL_ENTRY = {
  booking: 3, target_type: 'hotel', target_id: 'Nile Hotel',
  target_name: 'Nile Hotel', target_date: '2026-01-06', price: '150.00',
};

function renderPending() {
  return render(
    <ToastProvider>
      <PendingReviews />
    </ToastProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  is_logged_in.mockReturnValue(true);
});

test('renders one call to action per outstanding target of the same booking', async () => {
  fetch_pending_reviews.mockResolvedValue([TRIP_ENTRY, HOTEL_ENTRY]);
  renderPending();

  expect(await screen.findByRole('button', { name: 'قيّم رحلتك' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'قيّم إقامتك' })).toBeInTheDocument();
  expect(screen.getByText('Cairo Trip')).toBeInTheDocument();
  expect(screen.getByText('Nile Hotel')).toBeInTheDocument();
});

test('shows only the hotel call to action once the trip has been reviewed', async () => {
  fetch_pending_reviews.mockResolvedValue([HOTEL_ENTRY]);
  renderPending();

  expect(await screen.findByRole('button', { name: 'قيّم إقامتك' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'قيّم رحلتك' })).not.toBeInTheDocument();
});

test('shows the date that made each target eligible', async () => {
  fetch_pending_reviews.mockResolvedValue([TRIP_ENTRY]);
  renderPending();

  expect(await screen.findByText('بتاريخ 2026-01-05')).toBeInTheDocument();
});

test('renders nothing when there is nothing left to review', async () => {
  fetch_pending_reviews.mockResolvedValue([]);
  const { container } = renderPending();

  await waitFor(() => expect(container.querySelector('.pending-reviews')).not.toBeInTheDocument());
});

test('renders nothing for a logged-out visitor and makes no request', async () => {
  is_logged_in.mockReturnValue(false);
  const { container } = renderPending();

  await waitFor(() => expect(container.querySelector('.pending-reviews')).not.toBeInTheDocument());
  expect(fetch_pending_reviews).not.toHaveBeenCalled();
});

test('renders nothing when the pending request fails', async () => {
  fetch_pending_reviews.mockRejectedValue(new Error('network'));
  const { container } = renderPending();

  await waitFor(() => expect(container.querySelector('.pending-reviews')).not.toBeInTheDocument());
});

test('opening a call to action shows the form for that target only', async () => {
  fetch_pending_reviews.mockResolvedValue([TRIP_ENTRY, HOTEL_ENTRY]);
  renderPending();

  fireEvent.click(await screen.findByRole('button', { name: 'قيّم إقامتك' }));

  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAccessibleName('قيّم إقامتك — Nile Hotel');
  expect(screen.getByRole('button', { name: 'إرسال المراجعة' })).toBeInTheDocument();
});
