import { render, screen, fireEvent } from '@testing-library/react';
import TripCard from './TripCard';
import { set_language } from '../../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

test('renders name, price, rate and visitor count', () => {
  render(<TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={4.5} visitors={20} />);

  expect(screen.getByText('Cairo Trip')).toBeInTheDocument();
  expect(screen.getByText('100')).toBeInTheDocument();
  expect(screen.getByText('4.5')).toBeInTheDocument();
  expect(screen.getByText('20')).toBeInTheDocument();
});

test('calls onSelect with the trip name when the image is clicked', () => {
  const handleSelect = jest.fn();
  render(<TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={4.5} visitors={20} onSelect={handleSelect} />);

  fireEvent.click(screen.getByTitle('Travel now!'));
  expect(handleSelect).toHaveBeenCalledWith('Cairo Trip');
});

test('shows a discount badge only when discountPercent is set', () => {
  const { rerender } = render(<TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={4.5} visitors={20} />);
  expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();

  rerender(<TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={4.5} visitors={20} discountPercent={15} />);
  expect(screen.getByText('-15%')).toBeInTheDocument();
});

test('toggles the description panel without triggering onSelect', () => {
  const handleSelect = jest.fn();
  render(
    <TripCard
      name="Cairo Trip" image="/img.jpg" price={100} rate={4.5} visitors={20}
      description="A lovely trip." onSelect={handleSelect}
    />
  );

  expect(screen.queryByText('A lovely trip.')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('more info'));
  expect(screen.getByText('A lovely trip.')).toBeInTheDocument();
  expect(handleSelect).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText('less info'));
  expect(screen.queryByText('A lovely trip.')).not.toBeInTheDocument();
});

test('does not render a more-info toggle when no description is given', () => {
  render(<TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={4.5} visitors={20} />);
  expect(screen.queryByText('more info')).not.toBeInTheDocument();
});

test('falls back to the editorial rate when the trip has no reviews yet', () => {
  render(
    <TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={3.0} visitors={20}
      averageRating={4.7} reviewsCount={0} />
  );
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.queryByText('4.7')).not.toBeInTheDocument();
});

test('shows the real average rating instead of the editorial rate once the trip has reviews', () => {
  render(
    <TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={3.0} visitors={20}
      averageRating={4.7} reviewsCount={5} />
  );
  expect(screen.getByText('4.7')).toBeInTheDocument();
  expect(screen.queryByText('3')).not.toBeInTheDocument();
});

test('updates visitors, rating and price with no stale value left behind when the underlying trip data changes', () => {
  const { rerender } = render(
    <TripCard name="Cairo Trip" image="/img.jpg" price={100} rate={4.0} visitors={10} reviewsCount={0} />
  );
  expect(screen.getByText('100')).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();

  // Simulates a new booking (visitors, price) and a new review (real rating).
  rerender(
    <TripCard name="Cairo Trip" image="/img.jpg" price={120} rate={4.0} visitors={11}
      averageRating={4.8} reviewsCount={1} />
  );

  expect(screen.queryByText('100')).not.toBeInTheDocument();
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.queryByText('10')).not.toBeInTheDocument();
  expect(screen.getByText('11')).toBeInTheDocument();
  expect(screen.getByText('4.8')).toBeInTheDocument();
});
