import { render, screen, fireEvent } from '@testing-library/react';
import ErrorState from './ErrorState';

test('renders the default title and message', () => {
  render(<ErrorState />);
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});

test('renders a custom message', () => {
  render(<ErrorState message="We couldn't load these trips." />);
  expect(screen.getByText("We couldn't load these trips.")).toBeInTheDocument();
});

test('does not render a Retry button when onRetry is not provided', () => {
  render(<ErrorState />);
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
});

test('renders a Retry button and calls onRetry when clicked', () => {
  const handleRetry = jest.fn();
  render(<ErrorState onRetry={handleRetry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(handleRetry).toHaveBeenCalledTimes(1);
});
