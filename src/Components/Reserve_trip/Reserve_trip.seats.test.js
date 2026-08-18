jest.mock('axios');
jest.mock('../Bookings/bookingsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Reserve_trip from './Reserve_trip';
import { BookingProvider, useBooking } from './BookingContext';
import { ToastProvider } from '../ui/Toast/ToastContext';
import { fetch_trip_availability } from '../Bookings/bookingsApi';

function OpenBookingButton({ tripName }) {
  const { openBooking } = useBooking();
  return <button onClick={() => openBooking(tripName)}>Open {tripName}</button>;
}

function renderHarness(tripName = 'Test Trip') {
  return render(
    <ToastProvider>
      <BookingProvider>
        <OpenBookingButton tripName={tripName} />
        <Reserve_trip />
      </BookingProvider>
    </ToastProvider>
  );
}

const FEATURES = {
  img1: '/img1.jpg', img2: '/img2.jpg', img3: '/img3.jpg', img4: '/img4.jpg',
  access_plane_1: true, access_plane_name_1: 'EgyptAir', access_plane_price_1: 200,
  plane_start_at_1: '2026-01-01T00:00:00Z',
};

function mockAxios() {
  axios.get.mockImplementation((url) => {
    if (url.includes('/trip_features/')) return Promise.resolve({ data: FEATURES });
    if (url.includes('/get_prices/')) return Promise.resolve({ data: [[], []] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  axios.post.mockResolvedValue({ data: {} });
}

async function open_to_payment() {
  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));
  await screen.findByText(/EgyptAir/);
  fireEvent.click(screen.getByRole('button', { name: /Payment/ }));
}

function availability(remaining) {
  return {
    trip: 'Test Trip', capacity: 30,
    days: [{
      date: '2026-08-18', total_seats: 30,
      remaining_seats: remaining, is_sold_out: remaining === 0,
    }],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('username', 'testuser');
  mockAxios();
  fetch_trip_availability.mockResolvedValue(availability(4));
});

test('the seat selector offers exactly the remaining seats', async () => {
  renderHarness();
  await open_to_payment();

  const selector = await screen.findByLabelText('عدد المسافرين');
  const values = Array.from(selector.options).map((option) => Number(option.value));

  expect(values).toEqual([1, 2, 3, 4]);
  expect(screen.getByText('المقاعد المتبقية: 4')).toBeInTheDocument();
});

test('a sold-out departure offers no seats and says so', async () => {
  fetch_trip_availability.mockResolvedValue(availability(0));
  renderHarness();
  await open_to_payment();

  expect(await screen.findByText('مكتمل الحجز')).toBeInTheDocument();
  expect(screen.queryByLabelText('عدد المسافرين')).not.toBeInTheDocument();
});

test('the chosen seat count is sent with the booking', async () => {
  process.env.REACT_APP_DEV_TOOLS = 'true';
  renderHarness();
  await open_to_payment();

  fireEvent.change(await screen.findByLabelText('عدد المسافرين'), { target: { value: '3' } });
  fireEvent.click(await screen.findByRole('button', { name: /seed booking/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/profile/update_profile/',
    expect.objectContaining({ seats: 3 }),
  ));

  delete process.env.REACT_APP_DEV_TOOLS;
});

test('a booking defaults to one seat', async () => {
  process.env.REACT_APP_DEV_TOOLS = 'true';
  renderHarness();
  await open_to_payment();
  await screen.findByLabelText('عدد المسافرين');

  fireEvent.click(await screen.findByRole('button', { name: /seed booking/i }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/profile/update_profile/',
    expect.objectContaining({ seats: 1 }),
  ));

  delete process.env.REACT_APP_DEV_TOOLS;
});

test('a failed availability lookup does not block the flow', async () => {
  fetch_trip_availability.mockRejectedValue(new Error('network'));
  renderHarness();
  await open_to_payment();

  expect(await screen.findByText('جارٍ التحقق من المقاعد…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ready to pay' })).toBeInTheDocument();
});
