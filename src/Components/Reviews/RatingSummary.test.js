import { render, screen } from '@testing-library/react';
import RatingSummary from './RatingSummary';

test('shows the average, the star row and the total count', () => {
  render(<RatingSummary average={4.2} count={12} distribution={{ 1: 0, 2: 1, 3: 1, 4: 3, 5: 7 }} />);

  expect(screen.getByText('4.2')).toBeInTheDocument();
  expect(screen.getByText('12 مراجعة')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '4 من 5' })).toBeInTheDocument();
});

test('renders one distribution bar per star level, sized by share', () => {
  render(<RatingSummary average={4} count={10} distribution={{ 1: 0, 2: 0, 3: 0, 4: 5, 5: 5 }} />);

  const bars = screen.getAllByRole('progressbar');
  expect(bars).toHaveLength(5);
  expect(screen.getByRole('progressbar', { name: '5 نجوم' })).toHaveAttribute('aria-valuenow', '50');
  expect(screen.getByRole('progressbar', { name: '1 نجوم' })).toHaveAttribute('aria-valuenow', '0');
});

test('accepts string keys from the JSON payload', () => {
  render(<RatingSummary average={3} count={2} distribution={{ '3': 2 }} />);

  expect(screen.getByRole('progressbar', { name: '3 نجوم' })).toHaveAttribute('aria-valuenow', '100');
});

test('handles a target with no reviews at all', () => {
  render(<RatingSummary average={0} count={0} distribution={{}} />);

  expect(screen.getByText('0.0')).toBeInTheDocument();
  expect(screen.getByText('لا توجد مراجعات')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: '5 نجوم' })).toHaveAttribute('aria-valuenow', '0');
});

test('shows skeletons while the summary is loading', () => {
  const { container } = render(<RatingSummary loading />);

  expect(container.querySelectorAll('.ui-skeleton').length).toBeGreaterThan(0);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
