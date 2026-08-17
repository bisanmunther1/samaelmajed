jest.mock('./reviewsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../ui/Toast/ToastContext';
import ReviewForm from './ReviewForm';
import { create_review, review_error_message, update_review } from './reviewsApi';

function renderForm(props = {}) {
  return render(
    <ToastProvider>
      <ReviewForm booking={1} targetType="trip" targetId="Cairo Trip" {...props} />
    </ToastProvider>
  );
}

function pickStars(count) {
  fireEvent.click(screen.getByRole('radio', { name: `${count} من 5 نجوم` }));
}

beforeEach(() => {
  jest.clearAllMocks();
  review_error_message.mockReturnValue('حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.');
});

test('shows a live character counter for the comment', () => {
  renderForm();

  expect(screen.getByText('0 / 1000 حرف')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('تعليقك (اختياري)'), { target: { value: 'رحلة جميلة' } });

  expect(screen.getByText('10 / 1000 حرف')).toBeInTheDocument();
});

test('refuses to submit without a rating and says why', async () => {
  renderForm();

  fireEvent.click(screen.getByRole('button', { name: 'إرسال المراجعة' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('يرجى اختيار تقييم من 1 إلى 5 نجوم.');
  expect(create_review).not.toHaveBeenCalled();
});

test('submits the rating and comment once a rating is chosen', async () => {
  create_review.mockResolvedValue({ id: 7 });
  const handleSaved = jest.fn();
  renderForm({ onSaved: handleSaved });

  pickStars(4);
  fireEvent.change(screen.getByLabelText('تعليقك (اختياري)'), { target: { value: 'ممتازة' } });
  fireEvent.click(screen.getByRole('button', { name: 'إرسال المراجعة' }));

  await waitFor(() => expect(create_review).toHaveBeenCalledWith({
    booking: 1, targetType: 'trip', targetId: 'Cairo Trip', rating: 4, comment: 'ممتازة',
  }));
  await waitFor(() => expect(handleSaved).toHaveBeenCalled());
});

test('disables the submit button while the request is in flight', async () => {
  let resolve_create;
  create_review.mockReturnValue(new Promise((resolve) => { resolve_create = resolve; }));
  renderForm();

  pickStars(5);
  const submit = screen.getByRole('button', { name: 'إرسال المراجعة' });
  fireEvent.click(submit);

  await waitFor(() => expect(submit).toBeDisabled());

  resolve_create({ id: 1 });
  await waitFor(() => expect(submit).not.toBeDisabled());
});

test('surfaces a server rejection inline', async () => {
  create_review.mockRejectedValue({ response: { status: 400, data: { code: 'duplicate_trip_review' } } });
  review_error_message.mockReturnValue('لقد قمت بتقييم هذه الرحلة مسبقاً.');
  renderForm();

  pickStars(3);
  fireEvent.click(screen.getByRole('button', { name: 'إرسال المراجعة' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('لقد قمت بتقييم هذه الرحلة مسبقاً.');
});

test('renders the unpaid-booking rejection inline', async () => {
  create_review.mockRejectedValue({ response: { status: 400, data: { code: 'booking_not_completed' } } });
  review_error_message.mockReturnValue('لا يمكن التقييم قبل إتمام دفع الحجز.');
  renderForm();

  pickStars(4);
  fireEvent.click(screen.getByRole('button', { name: 'إرسال المراجعة' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('لا يمكن التقييم قبل إتمام دفع الحجز.');
});

test('prompts for login rather than crashing on a 401', async () => {
  const unauthorised = new Error('login required');
  unauthorised.requires_login = true;
  create_review.mockRejectedValue(unauthorised);
  review_error_message.mockReturnValue('يرجى تسجيل الدخول لكتابة مراجعة.');
  renderForm();

  pickStars(3);
  fireEvent.click(screen.getByRole('button', { name: 'إرسال المراجعة' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('يرجى تسجيل الدخول لكتابة مراجعة.');
});

test('edit mode starts from the existing review and patches it', async () => {
  update_review.mockResolvedValue({ id: 9, rating: 2 });
  renderForm({ review: { id: 9, rating: 5, comment: 'كانت جيدة' }, onCancel: jest.fn() });

  expect(screen.getByLabelText('تعليقك (اختياري)')).toHaveValue('كانت جيدة');
  expect(screen.getByRole('radio', { name: '5 من 5 نجوم' })).toBeChecked();

  pickStars(2);
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديل' }));

  await waitFor(() => expect(update_review).toHaveBeenCalledWith({
    id: 9, rating: 2, comment: 'كانت جيدة',
  }));
  expect(create_review).not.toHaveBeenCalled();
});

test('a cancel button appears only when onCancel is given', () => {
  const { rerender } = renderForm();
  expect(screen.queryByRole('button', { name: 'إلغاء' })).not.toBeInTheDocument();

  rerender(
    <ToastProvider>
      <ReviewForm booking={1} targetType="trip" targetId="Cairo Trip" onCancel={jest.fn()} />
    </ToastProvider>
  );
  expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
});
