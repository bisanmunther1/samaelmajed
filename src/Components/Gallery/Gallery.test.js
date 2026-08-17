jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Gallery from './Gallery';
import { BookingProvider } from '../Reserve_trip/BookingContext';

function renderGallery() {
  return render(
    <BookingProvider>
      <Gallery />
    </BookingProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reserve_trip's mocked reserve() reaches into these ids directly; not present
  // here since <Reserve_trip /> isn't mounted, so keep a stub background/name.
  document.body.innerHTML = '';
});

test('shows a loading skeleton while trips are being fetched', () => {
  axios.post.mockReturnValue(new Promise(() => {})); // never resolves
  const { container } = renderGallery();
  expect(container.querySelector('.photo_skeleton_grid')).toBeInTheDocument();
});

test('renders trip cards once the API responds', async () => {
  axios.post.mockResolvedValueOnce({
    data: [
      { name: 'Cairo Trip', img: '/cairo.jpg', price: 100, rate: 4.5, num: 10, place: 'Cairo', desc: 'Nice' },
    ],
  });

  renderGallery();

  expect(await screen.findByText('Cairo Trip')).toBeInTheDocument();
});

test('shows an error state with a working retry when the API call fails', async () => {
  axios.post.mockRejectedValueOnce(new Error('network error'));
  renderGallery();

  expect(await screen.findByText("We couldn't load these trips. Please try again.")).toBeInTheDocument();

  axios.post.mockResolvedValueOnce({
    data: [{ name: 'Retried Trip', img: '/r.jpg', price: 50, rate: 3, num: 1, place: 'Cairo', desc: 'd' }],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Retried Trip')).toBeInTheDocument();
});

test('shows an empty state when no trips match the current filters', async () => {
  axios.post.mockResolvedValueOnce({ data: [] });
  renderGallery();

  expect(await screen.findByText('No trips match your filters')).toBeInTheDocument();
});

test('switching trip type triggers a new fetch for that type', async () => {
  axios.post.mockResolvedValueOnce({
    data: [{ name: 'Beach Trip', img: '/b.jpg', price: 100, rate: 4, num: 5, place: 'Cairo', desc: 'd' }],
  });
  renderGallery();
  await screen.findByText('Beach Trip');

  axios.post.mockResolvedValueOnce({
    data: [{ name: 'Nature Trip', img: '/n.jpg', price: 100, rate: 4, num: 5, place: 'Cairo', desc: 'd' }],
  });
  fireEvent.click(screen.getByRole('button', { name: /Nature/ }));

  await waitFor(() => {
    const lastCall = axios.post.mock.calls[axios.post.mock.calls.length - 1];
    expect(lastCall[0]).toBe('http://127.0.0.1:8000/trips/send_trip_cards/Nature/');
  });
  expect(await screen.findByText('Nature Trip')).toBeInTheDocument();
});

test('filtering by place is included in the request body', async () => {
  axios.post.mockResolvedValue({ data: [] });
  renderGallery();
  await screen.findByText('No trips match your filters');

  fireEvent.click(screen.getByText('Show Filters'));
  fireEvent.change(screen.getByPlaceholderText('Any'), { target: { value: 'Aswan' } });

  await waitFor(() => {
    const lastCall = axios.post.mock.calls[axios.post.mock.calls.length - 1];
    expect(lastCall[1].place).toBe('Aswan');
  });
});
