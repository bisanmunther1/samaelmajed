jest.mock('./reviewsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../ui/Toast/ToastContext';
import ReviewList from './ReviewList';
import { delete_review, fetch_reviews, review_error_message } from './reviewsApi';
import { set_language } from '../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

function page(results, count = results.length) {
  return { count, results };
}

const REVIEW = {
  id: 1, rating: 5, comment: 'رحلة رائعة', user_display_name: 'رنا مراد',
  created_at: '2026-01-05T10:00:00Z', updated_at: '2026-01-05T10:00:00Z',
  can_edit: false, can_delete: false, target_type: 'trip', target_id: 'Cairo Trip',
};

function renderList(props = {}) {
  return render(
    <ToastProvider>
      <ReviewList targetType="trip" targetId="Cairo Trip" {...props} />
    </ToastProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  review_error_message.mockReturnValue('Something unexpected happened. Please try again.');
});

test('shows a skeleton until the first page arrives', () => {
  fetch_reviews.mockReturnValue(new Promise(() => {}));
  const { container } = renderList();

  expect(container.querySelector('.review-list-skeleton')).toBeInTheDocument();
});

test('renders the reviews once loaded', async () => {
  fetch_reviews.mockResolvedValue(page([REVIEW]));
  renderList();

  expect(await screen.findByText('رحلة رائعة')).toBeInTheDocument();
  expect(screen.getByText('رنا مراد')).toBeInTheDocument();
});

test('shows an empty state when there are no reviews', async () => {
  fetch_reviews.mockResolvedValue(page([]));
  renderList();

  expect(await screen.findByText('No reviews yet')).toBeInTheDocument();
});

test('shows an error state with retry when loading fails', async () => {
  fetch_reviews.mockRejectedValue(new Error('network'));
  renderList();

  expect(await screen.findByText("We couldn't load the reviews.")).toBeInTheDocument();

  fetch_reviews.mockResolvedValue(page([REVIEW]));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('رحلة رائعة')).toBeInTheDocument();
});

test('changing the sort control refetches with the new ordering', async () => {
  fetch_reviews.mockResolvedValue(page([REVIEW]));
  renderList();
  await screen.findByText('رحلة رائعة');

  fireEvent.change(screen.getByRole('combobox'), { target: { value: '-rating' } });

  await waitFor(() => expect(fetch_reviews).toHaveBeenLastCalledWith(
    expect.objectContaining({ ordering: '-rating', page: 1 })
  ));
});

test('hides edit and delete for a review that is not the user\'s own', async () => {
  fetch_reviews.mockResolvedValue(page([REVIEW]));
  renderList();
  await screen.findByText('رحلة رائعة');

  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});

test('offers inline editing of the user\'s own review', async () => {
  fetch_reviews.mockResolvedValue(page([{ ...REVIEW, can_edit: true, can_delete: true }]));
  renderList();
  await screen.findByText('رحلة رائعة');

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  expect(screen.getByLabelText('Your comment (optional)')).toHaveValue('رحلة رائعة');
});

test('deletes the review after the confirmation is accepted', async () => {
  fetch_reviews.mockResolvedValue(page([{ ...REVIEW, can_delete: true }]));
  delete_review.mockResolvedValue(undefined);
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  const handleChanged = jest.fn();

  renderList({ onChanged: handleChanged });
  await screen.findByText('رحلة رائعة');

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(delete_review).toHaveBeenCalledWith(1));
  await waitFor(() => expect(handleChanged).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('does not delete when the confirmation is dismissed', async () => {
  fetch_reviews.mockResolvedValue(page([{ ...REVIEW, can_delete: true }]));
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

  renderList();
  await screen.findByText('رحلة رائعة');

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(delete_review).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('pages through the results', async () => {
  fetch_reviews.mockResolvedValue(page([REVIEW], 25));
  renderList();
  await screen.findByText('رحلة رائعة');

  expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  await waitFor(() => expect(fetch_reviews).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2 })
  ));
});

test('shows no pager when everything fits on one page', async () => {
  fetch_reviews.mockResolvedValue(page([REVIEW], 1));
  renderList();
  await screen.findByText('رحلة رائعة');

  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
});
