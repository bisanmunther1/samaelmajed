import { render, screen, fireEvent } from '@testing-library/react';
import TripCard from './TripCard';

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
