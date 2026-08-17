import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

test('renders its children as the label', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
});

test('calls onClick when clicked', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Go</Button>);
  fireEvent.click(screen.getByRole('button', { name: 'Go' }));
  expect(handleClick).toHaveBeenCalledTimes(1);
});

test('is disabled and does not fire onClick when disabled prop is set', () => {
  const handleClick = jest.fn();
  render(<Button disabled onClick={handleClick}>Go</Button>);
  const button = screen.getByRole('button', { name: 'Go' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(handleClick).not.toHaveBeenCalled();
});

test('is disabled and shows a spinner while loading', () => {
  render(<Button loading>Save</Button>);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button.querySelector('.ui-btn-spinner')).toBeInTheDocument();
});

test('applies the requested variant and size classes', () => {
  render(<Button variant="danger" size="sm">Delete</Button>);
  const button = screen.getByRole('button', { name: 'Delete' });
  expect(button).toHaveClass('ui-btn-danger');
  expect(button).toHaveClass('ui-btn-sm');
});

test('defaults to type="button" so it does not accidentally submit a form', () => {
  render(<Button>Click</Button>);
  expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
});
