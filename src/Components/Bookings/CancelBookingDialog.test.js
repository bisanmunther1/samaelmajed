jest.mock('./bookingsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CancelBookingDialog from './CancelBookingDialog';
import {
  booking_error_message, cancel_booking, fetch_cancellation_preview,
} from './bookingsApi';

const BOOKING = { id: 7, trip_name: 'Cairo Trip', trip_date: '2026-12-01', price: '200.00' };

const FULL_PREVIEW = {
  booking: 7, price: '200.00', days_until_departure: 20,
  refund_tier: 'full', refund_rate: '1.00', refund_amount: '200.00', can_cancel: true,
};

function renderDialog(props = {}) {
  return render(
    <CancelBookingDialog
      booking={BOOKING}
      isOpen
      onClose={jest.fn()}
      onCancelled={jest.fn()}
      {...props}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  booking_error_message.mockReturnValue('تعذّر إتمام العملية، حاول مرة أخرى.');
  fetch_cancellation_preview.mockResolvedValue(FULL_PREVIEW);
  cancel_booking.mockResolvedValue({
    booking: 7, status: 'cancelled', refund_amount: '200.00', refund_status: 'pending',
  });
});

test('shows the refund the server previewed, with its policy tier', async () => {
  renderDialog();

  expect(await screen.findByText('200.00$')).toBeInTheDocument();
  expect(screen.getByText('استرداد كامل (أكثر من 7 أيام على الرحلة)')).toBeInTheDocument();
  expect(screen.getByText('20 يوم حتى موعد الرحلة')).toBeInTheDocument();
  expect(fetch_cancellation_preview).toHaveBeenCalledWith(7);
});

test('shows the half-refund tier when that is what applies', async () => {
  fetch_cancellation_preview.mockResolvedValue({
    ...FULL_PREVIEW, days_until_departure: 5, refund_tier: 'partial', refund_amount: '100.00',
  });
  renderDialog();

  expect(await screen.findByText('100.00$')).toBeInTheDocument();
  expect(screen.getByText('استرداد 50% (من 3 إلى 7 أيام على الرحلة)')).toBeInTheDocument();
});

test('shows the no-refund tier close to departure', async () => {
  fetch_cancellation_preview.mockResolvedValue({
    ...FULL_PREVIEW, days_until_departure: 1, refund_tier: 'none', refund_amount: '0.00',
  });
  renderDialog();

  expect(await screen.findByText('0.00$')).toBeInTheDocument();
  expect(screen.getByText('لا يوجد استرداد (أقل من 3 أيام على الرحلة)')).toBeInTheDocument();
});

test('confirming sends the reason and reports the result upward', async () => {
  const handleCancelled = jest.fn();
  const handleClose = jest.fn();
  renderDialog({ onCancelled: handleCancelled, onClose: handleClose });
  await screen.findByText('200.00$');

  fireEvent.change(screen.getByLabelText('سبب الإلغاء (اختياري)'), {
    target: { value: 'ظرف طارئ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإلغاء' }));

  await waitFor(() => expect(cancel_booking).toHaveBeenCalledWith({
    bookingId: 7, reason: 'ظرف طارئ',
  }));
  await waitFor(() => expect(handleCancelled).toHaveBeenCalled());
  expect(handleClose).toHaveBeenCalled();
});

test('a server rejection is shown inline and the dialog stays open', async () => {
  cancel_booking.mockRejectedValue({
    response: { status: 400, data: { code: 'trip_already_departed' } },
  });
  booking_error_message.mockReturnValue('لا يمكن إلغاء حجز لرحلة انطلقت بالفعل.');
  const handleClose = jest.fn();
  renderDialog({ onClose: handleClose });
  await screen.findByText('200.00$');

  fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإلغاء' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('لا يمكن إلغاء حجز لرحلة انطلقت بالفعل.');
  expect(handleClose).not.toHaveBeenCalled();
});

test('confirming is refused when the server says the booking cannot be cancelled', async () => {
  fetch_cancellation_preview.mockResolvedValue({ ...FULL_PREVIEW, can_cancel: false });
  renderDialog();
  await screen.findByText('200.00$');

  expect(screen.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeDisabled();
});

test('a failed preview surfaces the error instead of an empty dialog', async () => {
  fetch_cancellation_preview.mockRejectedValue(new Error('network'));
  renderDialog();

  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
