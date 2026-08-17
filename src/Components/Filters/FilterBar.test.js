jest.mock('axios');

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Gallery from '../Gallery/Gallery';
import { BookingProvider } from '../Reserve_trip/BookingContext';

function renderGallery() {
  return render(
    <BookingProvider>
      <Gallery />
    </BookingProvider>
  );
}

const TRIP = {
  name: 'Cairo Trip', img: '/c.jpg', price: 100, rate: 4.5, num: 10,
  place: 'Cairo', desc: 'd', average_rating: '4.50', reviews_count: 6,
};

function last_post_url() {
  const calls = axios.post.mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/');
  axios.get.mockResolvedValue({
    data: { places: ['Aswan', 'Cairo'], min_price: 50, max_price: 900 },
  });
  axios.post.mockResolvedValue({ data: [TRIP] });
});

test('populates the destination dropdown from filter-options', async () => {
  renderGallery();

  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/trips/filter-options/'
  ));
  expect(await screen.findByRole('option', { name: 'Aswan' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Cairo' })).toBeInTheDocument();
});

test('shows the result count', async () => {
  renderGallery();

  expect(await screen.findByText('عدد النتائج: 1')).toBeInTheDocument();
});

test('choosing a destination refetches with the place filter and stores it in the URL', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  fireEvent.change(screen.getByLabelText('الوجهة'), { target: { value: 'Aswan' } });

  await waitFor(() => expect(last_post_url()).toContain('place=Aswan'));
  expect(window.location.search).toContain('place=Aswan');
});

test('the sort dropdown is sent as the ordering param', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  fireEvent.change(screen.getByLabelText('ترتيب حسب'), { target: { value: '-price' } });

  await waitFor(() => expect(last_post_url()).toContain('ordering=-price'));
});

// The retired Gallery panel could sort by name, visitor count, price and the
// editorial rate. All four survive as ordering values on the FilterBar.
test('offers the sorts migrated off the retired inline panel', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  const sort = screen.getByLabelText('ترتيب حسب');
  const values = Array.from(sort.options).map((option) => option.value);

  expect(values).toEqual(expect.arrayContaining(['name', '-name', '-num', '-rate', 'price', '-price']));
});

test('sorting by most visited is sent as -num', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  fireEvent.change(screen.getByLabelText('ترتيب حسب'), { target: { value: '-num' } });

  await waitFor(() => expect(last_post_url()).toContain('ordering=-num'));
});

test('the price inputs are sent as min_price and max_price', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  fireEvent.change(screen.getByLabelText('من'), { target: { value: '100' } });
  await waitFor(() => expect(last_post_url()).toContain('min_price=100'));

  fireEvent.change(screen.getByLabelText('إلى'), { target: { value: '500' } });
  await waitFor(() => expect(last_post_url()).toContain('max_price=500'));
});

test('the star rating sets min_rating', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  fireEvent.click(screen.getByRole('radio', { name: '4 من 5 نجوم' }));

  await waitFor(() => expect(last_post_url()).toContain('min_rating=4'));
});

test('search is debounced before it reaches the API', async () => {
  jest.useFakeTimers();
  renderGallery();

  const search = screen.getByLabelText('ابحث');
  fireEvent.change(search, { target: { value: 'cai' } });
  fireEvent.change(search, { target: { value: 'cairo' } });

  expect(last_post_url()).not.toContain('search=');

  jest.advanceTimersByTime(350);
  jest.useRealTimers();

  await waitFor(() => expect(last_post_url()).toContain('search=cairo'));
});

test('reset clears every filter and empties the query string', async () => {
  window.history.replaceState({}, '', '/?place=Aswan&ordering=-price&min_rating=4');
  renderGallery();
  await screen.findByText('Cairo Trip');

  const reset = screen.getByRole('button', { name: 'مسح الفلاتر' });
  expect(reset).not.toBeDisabled();

  fireEvent.click(reset);

  await waitFor(() => expect(window.location.search).toBe(''));
  await waitFor(() => {
    expect(last_post_url()).not.toContain('place=');
    expect(last_post_url()).not.toContain('ordering=');
  });
});

test('reset is disabled when no filter is active', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  expect(screen.getByRole('button', { name: 'مسح الفلاتر' })).toBeDisabled();
});

test('filters are read back out of the URL on load', async () => {
  window.history.replaceState({}, '', '/?place=Aswan&ordering=-price');
  renderGallery();

  await waitFor(() => {
    expect(last_post_url()).toContain('place=Aswan');
    expect(last_post_url()).toContain('ordering=-price');
  });

  // The select can only hold the value once filter-options has supplied it.
  await screen.findByRole('option', { name: 'Aswan' });
  expect(screen.getByLabelText('الوجهة')).toHaveValue('Aswan');
  expect(screen.getByLabelText('ترتيب حسب')).toHaveValue('-price');
});

test('a rejected filter value shows the Arabic message from the server code', async () => {
  renderGallery();
  await screen.findByText('Cairo Trip');

  axios.post.mockRejectedValue({
    response: { status: 400, data: { code: 'invalid_price', detail: 'x' } },
  });
  fireEvent.change(screen.getByLabelText('من'), { target: { value: '-5' } });

  expect(await screen.findByText('قيمة السعر يجب أن تكون رقماً موجباً.')).toBeInTheDocument();
});

test('an empty filtered result explains how to recover', async () => {
  window.history.replaceState({}, '', '/?place=Aswan');
  axios.post.mockResolvedValue({ data: [] });
  renderGallery();

  expect(await screen.findByText('لا توجد رحلات مطابقة')).toBeInTheDocument();
  expect(screen.getByText('جرّب توسيع نطاق البحث أو مسح الفلاتر.')).toBeInTheDocument();
});
