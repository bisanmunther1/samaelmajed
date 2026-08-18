jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Gallery from './Gallery';
import { BookingProvider } from '../Reserve_trip/BookingContext';
import { set_language } from '../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

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
  // The FilterBar fetches its destination list and price bounds on mount.
  axios.get.mockResolvedValue({ data: { places: [], min_price: 0, max_price: 0 } });
  window.history.replaceState({}, '', '/');
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

// Regression test: the card's displayed price already came from the server
// as the discounted `final_price`, but the discount badge itself was never
// passed through on this grid (only the separate Discount_places carousel
// wired it up) — so a 20%-off trip silently showed its discounted price with
// no badge explaining why, while the same trip's badge worked fine elsewhere.
// This was invisible to TripCard's own unit tests, which only render the
// component in isolation with explicit props.
test('shows the discount badge for a discounted trip, matching its displayed price', async () => {
  axios.post.mockResolvedValueOnce({
    data: [{
      name: 'Discounted Trip', img: '/d.jpg', final_price: 80, discount: 20,
      rate: 4.5, num: 10, place: 'Cairo', desc: 'Nice',
    }],
  });

  renderGallery();

  expect(await screen.findByText('Discounted Trip')).toBeInTheDocument();
  expect(screen.getByText('80')).toBeInTheDocument();
  expect(screen.getByText('-20%')).toBeInTheDocument();
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

// Coverage moved off the retired inline filter panel and onto the FilterBar:
// destination filtering now travels on the query string, not the POST body.
test('filtering by destination is sent as a query param', async () => {
  axios.get.mockResolvedValue({
    data: { places: ['Aswan'], min_price: 0, max_price: 900 },
  });
  axios.post.mockResolvedValue({ data: [] });
  renderGallery();
  await screen.findByRole('option', { name: 'Aswan' });

  fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'Aswan' } });

  await waitFor(() => {
    const lastCall = axios.post.mock.calls[axios.post.mock.calls.length - 1];
    expect(lastCall[0]).toContain('place=Aswan');
  });
});

test('the request body still carries every key the listing endpoint requires', async () => {
  axios.post.mockResolvedValue({ data: [] });
  renderGallery();

  await waitFor(() => expect(axios.post).toHaveBeenCalled());

  const [, body] = axios.post.mock.calls[axios.post.mock.calls.length - 1];
  // send_trip_cards reads all six off request.data and KeyErrors without them.
  expect(body).toEqual({
    place: 'Any',
    price: 100000,
    rate: 0,
    order_by: 'name',
    reverse: false,
    number_of_images: 8,
  });
});

test('the retired inline filter panel is gone', async () => {
  axios.post.mockResolvedValue({ data: [] });
  renderGallery();
  await waitFor(() => expect(axios.post).toHaveBeenCalled());

  expect(screen.queryByText('Show Filters')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Any')).not.toBeInTheDocument();
  expect(screen.queryByText('Reverse Order')).not.toBeInTheDocument();
});
