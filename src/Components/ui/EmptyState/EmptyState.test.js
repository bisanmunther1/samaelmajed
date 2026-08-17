import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

test('renders the default title when none is given', () => {
  render(<EmptyState />);
  expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
});

test('renders a custom title and message', () => {
  render(<EmptyState title="No trips match your filters" message="Try widening your search." />);
  expect(screen.getByText('No trips match your filters')).toBeInTheDocument();
  expect(screen.getByText('Try widening your search.')).toBeInTheDocument();
});

test('renders an optional action', () => {
  render(<EmptyState action={<button>Reset filters</button>} />);
  expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
});
