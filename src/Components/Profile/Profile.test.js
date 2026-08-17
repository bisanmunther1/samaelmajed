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
