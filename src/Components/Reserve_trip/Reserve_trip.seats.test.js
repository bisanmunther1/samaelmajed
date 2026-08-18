jest.mock('axios');
jest.mock('../Bookings/bookingsApi');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Reserve_trip from './Reserve_trip';
import { BookingProvider, useBooking } from './BookingContext';
import { ToastProvider } from '../ui/Toast/ToastContext';
import { fetch_trip_availability } from '../Bookings/bookingsApi';
import { set_language } from '../../i18n';

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
  // This suite describes the English rendering, so it pins the language rather
  // than depending on the app default (Arabic).
  set_language('en');
});

test('the seat selector offers exactly the remaining seats', async () => {
  renderHarness();
  await open_to_payment();

  const selector = await screen.findByLabelText('Travellers');
  const values = Array.from(selector.options).map((option) => Number(option.value));

  expect(values).toEqual([1, 2, 3, 4]);
  expect(screen.getByText('Seats remaining: 4')).toBeInTheDocument();
});

test('a sold-out departure offers no seats and says so', async () => {
  fetch_trip_availability.mockResolvedValue(availability(0));
  renderHarness();
  await open_to_payment();

  expect(await screen.findByText('Sold out')).toBeInTheDocument();
  expect(screen.queryByLabelText('Travellers')).not.toBeInTheDocument();
});

test('the chosen seat count is sent with the booking', async () => {
  process.env.REACT_APP_DEV_TOOLS = 'true';
  renderHarness();
  await open_to_payment();

  fireEvent.change(await screen.findByLabelText('Travellers'), { target: { value: '3' } });
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
  await screen.findByLabelText('Travellers');

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

  expect(await screen.findByText('Checking availability…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ready to pay' })).toBeInTheDocument();
});

// Regression tests for two bugs: the primary "ready to pay" button faked a
// success message without ever creating a booking, and the trip date sent
// with a booking (and the availability checked before it) was hardcoded to
// today regardless of what the customer saw or an admin configured.

test('the primary "ready to pay" button actually creates the booking', async () => {
  renderHarness();
  await open_to_payment();

  fireEvent.click(await screen.findByRole('button', { name: 'ready to pay' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/profile/update_profile/',
    expect.objectContaining({ username: 'testuser', trip_name: 'Test Trip' }),
  ));
  expect(await screen.findByText('Reservation complete successfully, have a good time!')).toBeInTheDocument();
});

test('"ready to pay" shows no success message before the request resolves', async () => {
  let resolve_post;
  axios.post.mockImplementation(() => new Promise((resolve) => { resolve_post = resolve; }));
  renderHarness();
  await open_to_payment();

  fireEvent.click(await screen.findByRole('button', { name: 'ready to pay' }));

  expect(screen.queryByText('Reservation complete successfully, have a good time!')).not.toBeInTheDocument();

  resolve_post({ data: {} });
  expect(await screen.findByText('Reservation complete successfully, have a good time!')).toBeInTheDocument();
});

test('"ready to pay" shows the error toast, not a false success, when the booking fails', async () => {
  axios.post.mockRejectedValue(new Error('server error'));
  renderHarness();
  await open_to_payment();

  fireEvent.click(await screen.findByRole('button', { name: 'ready to pay' }));

  expect(await screen.findByText('Something went wrong saving your booking. Please try again.')).toBeInTheDocument();
  expect(screen.queryByText('Reservation complete successfully, have a good time!')).not.toBeInTheDocument();
});

test('rapid double-clicking "ready to pay" only fires one POST', async () => {
  renderHarness();
  await open_to_payment();

  const button = await screen.findByRole('button', { name: 'ready to pay' });
  fireEvent.click(button);
  fireEvent.click(button);

  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
});

test('the departure date defaults to today and is sent with the booking', async () => {
  renderHarness();
  await open_to_payment();

  const today = new Date().toISOString().substring(0, 10);
  expect(await screen.findByLabelText('Departure date')).toHaveValue(today);

  fireEvent.click(screen.getByRole('button', { name: 'ready to pay' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.any(String), expect.objectContaining({ trip_date: today }),
  ));
});

test('changing the departure date re-checks availability for that date', async () => {
  renderHarness();
  await open_to_payment();
  await screen.findByLabelText('Departure date');

  fetch_trip_availability.mockClear();
  fetch_trip_availability.mockResolvedValue(availability(2));

  fireEvent.change(screen.getByLabelText('Departure date'), { target: { value: '2026-09-01' } });

  await waitFor(() => expect(fetch_trip_availability).toHaveBeenCalledWith(
    expect.objectContaining({ tripName: 'Test Trip', from: '2026-09-01', to: '2026-09-01' }),
  ));
});

test('the booking uses the chosen departure date, not today', async () => {
  renderHarness();
  await open_to_payment();
  await screen.findByLabelText('Departure date');

  fireEvent.change(screen.getByLabelText('Departure date'), { target: { value: '2026-09-01' } });
  await screen.findByLabelText('Departure date');

  fireEvent.click(screen.getByRole('button', { name: 'ready to pay' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.any(String), expect.objectContaining({ trip_date: '2026-09-01' }),
  ));
});

test('a sold-out date blocks submission with a clear message, not a silent failure', async () => {
  fetch_trip_availability.mockResolvedValue(availability(0));
  renderHarness();
  await open_to_payment();
  await screen.findByText('Sold out');

  fireEvent.click(screen.getByRole('button', { name: 'ready to pay' }));

  // The static "Sold out" label was already visible before the click; what
  // matters here is that the click itself produced a toast telling the
  // customer why nothing happened, rather than submitting silently.
  const toast = await screen.findByRole('status');
  expect(toast).toHaveTextContent('Sold out');
  expect(axios.post).not.toHaveBeenCalled();
});
