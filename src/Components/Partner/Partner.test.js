jest.mock('./partnerApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Partner from './Partner';
import { ToastProvider } from '../ui/Toast/ToastContext';
import {
  create_partner_listing, fetch_partner_bookings, fetch_partner_dashboard,
  fetch_partner_listings, fetch_partner_me, is_logged_in, partner_error_message,
} from './partnerApi';

const APPROVED = {
  id: 1, business_name: 'Alpha Tours', partner_type: 'tour_operator',
  is_approved: true, role: 'partner',
};

const PENDING = { ...APPROVED, is_approved: false };

function renderPartner() {
  return render(
    <ToastProvider>
      <Partner />
    </ToastProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  is_logged_in.mockReturnValue(true);
  partner_error_message.mockReturnValue('تعذّر إتمام العملية، حاول مرة أخرى.');
  fetch_partner_me.mockResolvedValue(APPROVED);
  fetch_partner_dashboard.mockResolvedValue({
    listings: 3, upcoming_bookings: 2, total_bookings: 9, average_rating: 4.5,
  });
  fetch_partner_listings.mockResolvedValue([
    { name: 'Alpha Trip', price: '250.00', average_rating: '4.50' },
  ]);
  fetch_partner_bookings.mockResolvedValue([]);
});

test('an approved partner sees their dashboard counts', async () => {
  renderPartner();

  expect(await screen.findByText('Alpha Tours')).toBeInTheDocument();

  // The counts arrive on a second request, after the profile has resolved.
  expect(await screen.findByText('3')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('9')).toBeInTheDocument();
  expect(screen.getByText('4.5')).toBeInTheDocument();
});

test('an unapproved partner sees the pending screen and no tabs', async () => {
  fetch_partner_me.mockResolvedValue(PENDING);
  renderPartner();

  expect(await screen.findByText('حسابك قيد المراجعة')).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'عروضي' })).not.toBeInTheDocument();
  expect(fetch_partner_dashboard).not.toHaveBeenCalled();
});

test('someone who is not a partner gets the registration form', async () => {
  fetch_partner_me.mockResolvedValue(null);
  renderPartner();

  expect(await screen.findByText('التسجيل كشريك')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'إرسال الطلب' })).toBeInTheDocument();
});

test('a logged-out visitor gets the registration form, never partner data', async () => {
  is_logged_in.mockReturnValue(false);
  renderPartner();

  expect(await screen.findByText('التسجيل كشريك')).toBeInTheDocument();
  expect(fetch_partner_me).not.toHaveBeenCalled();
  expect(fetch_partner_listings).not.toHaveBeenCalled();
});

test('the listings tab shows only what the API returned', async () => {
  renderPartner();
  await screen.findByText('Alpha Tours');

  fireEvent.click(screen.getByRole('tab', { name: 'عروضي' }));

  expect(await screen.findByText('Alpha Trip')).toBeInTheDocument();
  expect(screen.getByText('250.00')).toBeInTheDocument();
});

test('the listings empty state invites a first listing', async () => {
  fetch_partner_listings.mockResolvedValue([]);
  renderPartner();
  await screen.findByText('Alpha Tours');

  fireEvent.click(screen.getByRole('tab', { name: 'عروضي' }));

  expect(await screen.findByText('لا توجد عروض بعد')).toBeInTheDocument();
});

test('the listing form submits a new listing', async () => {
  create_partner_listing.mockResolvedValue({ name: 'New Trip' });
  renderPartner();
  await screen.findByText('Alpha Tours');

  fireEvent.click(screen.getByRole('tab', { name: 'عروضي' }));
  fireEvent.click(await screen.findByRole('button', { name: 'إضافة عرض' }));

  fireEvent.change(await screen.findByLabelText('الاسم'), { target: { value: 'New Trip' } });
  fireEvent.change(screen.getByLabelText('الوجهة'), { target: { value: 'Luxor' } });
  fireEvent.change(screen.getByLabelText('السعر'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

  await waitFor(() => expect(create_partner_listing).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'New Trip', place: 'Luxor', price: '300' })
  ));
});

test('the bookings tab renders the scoped rows', async () => {
  fetch_partner_bookings.mockResolvedValue([
    {
      id: 5, customer: 'shopper', trip: 'Alpha Trip', hotel: null,
      trip_date: '2026-09-01', hotel_reserve_date: null, seats: 2,
      price: '200.00', status: 'confirmed', is_paid: true,
    },
  ]);
  renderPartner();
  await screen.findByText('Alpha Tours');

  fireEvent.click(screen.getByRole('tab', { name: 'الحجوزات' }));

  expect(await screen.findByText('shopper')).toBeInTheDocument();
  expect(screen.getByText('مؤكد')).toBeInTheDocument();
});

test('a failed profile lookup shows an error, not partner data', async () => {
  fetch_partner_me.mockRejectedValue(new Error('network'));
  renderPartner();

  expect(await screen.findByText('تعذّر تحميل البيانات.')).toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});
