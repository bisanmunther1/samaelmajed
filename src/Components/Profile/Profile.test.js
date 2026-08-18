jest.mock('axios');

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Profile from './Profile';

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('username', 'produser');
});

function mockBoth(profileData, bookingsData) {
  axios.get.mockImplementation((url) => {
    if (url.includes('/get_profile_data/')) return Promise.resolve({ data: bookingsData });
    if (url.includes('/profile/get/')) return Promise.resolve({ data: profileData });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

test('shows a loading skeleton before the profile arrives', () => {
  axios.get.mockReturnValue(new Promise(() => {}));
  const { container } = renderProfile();
  expect(container.querySelector('#profile_skeleton')).toBeInTheDocument();
});

test('renders profile fields once loaded', async () => {
  mockBoth({ first_name: 'Ana', last_name: 'Smith', email: 'a@example.com', country: 'Egypt' }, []);
  renderProfile();

  expect(await screen.findByText('Ana')).toBeInTheDocument();
  expect(screen.getByText('Smith')).toBeInTheDocument();
});

test('shows an empty state when there are no bookings', async () => {
  mockBoth({ first_name: 'Ana' }, []);
  renderProfile();

  expect(await screen.findByText('No trips booked yet')).toBeInTheDocument();
});

test('renders the booking history table when bookings exist', async () => {
  mockBoth({ first_name: 'Ana' }, [
    { id: 1, trip_name: 'Cairo Trip', trip_date: '2026-01-01', price: 200, hotel_name: 'Nile Hotel', hotel_reserve_date: '2026-01-02' },
  ]);
  renderProfile();

  expect(await screen.findByText('Cairo Trip')).toBeInTheDocument();
  expect(screen.getByText('Nile Hotel')).toBeInTheDocument();
});

test('shows an error state with retry when the profile fails to load', async () => {
  axios.get.mockRejectedValue(new Error('network error'));
  renderProfile();

  expect(await screen.findByText("We couldn't load your profile.")).toBeInTheDocument();

  mockBoth({ first_name: 'Recovered' }, []);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Recovered')).toBeInTheDocument();
});

test('a cancelled booking is marked and shows its refund status', async () => {
  mockBoth({ first_name: 'Ana' }, [
    {
      id: 2, trip_name: 'Aswan Trip', trip_date: '2026-01-01', price: 200,
      hotel_name: null, hotel_reserve_date: null,
      status: 'cancelled', refund_amount: '100.00', refund_status: 'pending',
    },
  ]);
  renderProfile();

  expect(await screen.findByText('ملغى')).toBeInTheDocument();
  expect(screen.getByText(/الاسترداد قيد المعالجة/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'إلغاء الحجز' })).not.toBeInTheDocument();
});

test('an upcoming confirmed booking offers a cancel button', async () => {
  mockBoth({ first_name: 'Ana' }, [
    {
      id: 3, trip_name: 'Cairo Trip', trip_date: '2099-01-01', price: 200,
      hotel_name: null, hotel_reserve_date: null,
      status: 'confirmed', refund_amount: '0.00', refund_status: 'not_applicable',
    },
  ]);
  renderProfile();

  expect(await screen.findByRole('button', { name: 'إلغاء الحجز' })).toBeInTheDocument();
});

test('a departed booking offers no cancel button', async () => {
  mockBoth({ first_name: 'Ana' }, [
    {
      id: 4, trip_name: 'Past Trip', trip_date: '2020-01-01', price: 200,
      hotel_name: null, hotel_reserve_date: null,
      status: 'confirmed', refund_amount: '0.00', refund_status: 'not_applicable',
    },
  ]);
  renderProfile();

  expect(await screen.findByText('Past Trip')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'إلغاء الحجز' })).not.toBeInTheDocument();
});
