import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';
import { set_language } from '../../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

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
