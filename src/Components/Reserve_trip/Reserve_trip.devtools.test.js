jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Reserve_trip from './Reserve_trip';
import { BookingProvider, useBooking } from './BookingContext';
import { ToastProvider } from '../ui/Toast/ToastContext';
import { set_language } from '../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

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

function mockAxiosForHappyPath() {
  axios.get.mockImplementation((url) => {
    if (url.includes('/trip_features/')) return Promise.resolve({ data: FEATURES });
    if (url.includes('/get_prices/')) return Promise.resolve({ data: [[], []] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  axios.post.mockImplementation((url) => {
    if (url.includes('/update_profile/')) return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
}

async function open_to_payment_step() {
  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));
  await screen.findByText(/EgyptAir/);
  fireEvent.click(screen.getByRole('button', { name: /Payment/ }));
  return screen.findByRole('button', { name: /seed booking/i });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('username', 'testuser');
  process.env.REACT_APP_DEV_TOOLS = 'true';
});

afterEach(() => {
  delete process.env.REACT_APP_DEV_TOOLS;
});

test('the dev-only seed-booking button is hidden unless REACT_APP_DEV_TOOLS is enabled', async () => {
  delete process.env.REACT_APP_DEV_TOOLS;
  mockAxiosForHappyPath();
  renderHarness();
  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));
  await screen.findByText(/EgyptAir/);
  fireEvent.click(screen.getByRole('button', { name: /Payment/ }));

  await screen.findByRole('button', { name: 'ready to pay' });
  expect(screen.queryByRole('button', { name: /seed booking/i })).not.toBeInTheDocument();
});

test('seed booking (dev only) posts a booking and shows a success toast', async () => {
  mockAxiosForHappyPath();
  renderHarness();
  const seed_button = await open_to_payment_step();

  fireEvent.click(seed_button);

  expect(await screen.findByText('Reservation complete successfully, have a good time!')).toBeInTheDocument();
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/profile/update_profile/',
    expect.objectContaining({ username: 'testuser', trip_name: 'Test Trip', price: 200 }),
  ));
});

test('shows an error toast instead of a silent failure when the seed-booking POST fails', async () => {
  mockAxiosForHappyPath();
  renderHarness();
  const seed_button = await open_to_payment_step();

  axios.post.mockImplementation((url) => {
    if (url.includes('/update_profile/')) return Promise.reject(new Error('server error'));
    return Promise.resolve({ data: [] });
  });

  fireEvent.click(seed_button);

  expect(await screen.findByText('Something went wrong saving your booking. Please try again.')).toBeInTheDocument();
});

test('rapid double-clicking seed booking only fires one POST', async () => {
  mockAxiosForHappyPath();
  renderHarness();
  const seed_button = await open_to_payment_step();

  fireEvent.click(seed_button);
  fireEvent.click(seed_button);

  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
});
