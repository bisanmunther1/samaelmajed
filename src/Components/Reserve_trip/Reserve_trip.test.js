jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Reserve_trip from './Reserve_trip';
import { BookingProvider, useBooking } from './BookingContext';
import { ToastProvider } from '../ui/Toast/ToastContext';

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
    if (url.includes('/get_prices/')) return Promise.resolve({ data: [[100], ['Nile Hotel']] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  axios.post.mockImplementation((url) => {
    if (url.includes('/send_hotel/')) {
      return Promise.resolve({
        data: [{ name: 'Nile Hotel', price: 100, rate: 4.5, h_photo1: '', h_photo2: '', h_photo3: '' }],
      });
    }
    if (url.includes('/update_profile/')) return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('username', 'testuser');
});

test('modal is closed until openBooking is called', () => {
  mockAxiosForHappyPath();
  renderHarness();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('opening a trip fetches its features and auto-selects the first transport option', async () => {
  mockAxiosForHappyPath();
  renderHarness();

  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));

  expect(await screen.findByText('EgyptAir / 200$', { exact: false })).toBeInTheDocument();
  await waitFor(() => expect(document.querySelector('#reserve_footer_total')).toHaveTextContent('200$'));
});

test('shows an error state with retry when trip features fail to load', async () => {
  axios.get.mockRejectedValue(new Error('network error'));
  renderHarness();

  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));
  expect(await screen.findByText("We couldn't load this trip's details.")).toBeInTheDocument();

  mockAxiosForHappyPath();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('EgyptAir / 200$', { exact: false })).toBeInTheDocument();
});

test('selecting a hotel adds its price to the total', async () => {
  mockAxiosForHappyPath();
  renderHarness();
  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));
  await screen.findByText(/EgyptAir/);

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(await screen.findByText('Nile Hotel — 100$', { exact: false }));

  await waitFor(() => expect(document.querySelector('#reserve_footer_total')).toHaveTextContent('300$'));
});

test('closing the modal via the close button hides it', async () => {
  mockAxiosForHappyPath();
  renderHarness();
  fireEvent.click(screen.getByRole('button', { name: 'Open Test Trip' }));
  await screen.findByRole('dialog');

  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
