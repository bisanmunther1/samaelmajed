import { render, screen, fireEvent } from '@testing-library/react';
import Input, { Textarea } from './Input';

test('renders a label associated with its input', () => {
  render(<Input label="Username" name="username" value="" onChange={() => {}} />);
  expect(screen.getByLabelText('Username')).toBeInTheDocument();
});

test('calls onChange when the user types', () => {
  const handleChange = jest.fn();
  render(<Input label="Username" name="username" value="" onChange={handleChange} />);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
  expect(handleChange).toHaveBeenCalledTimes(1);
});

test('shows an inline error message when the error prop is set', () => {
  render(<Input label="Password" name="password" value="" onChange={() => {}} error="Too short" />);
  expect(screen.getByText('Too short')).toBeInTheDocument();
});

test('does not show a hint when an error is present', () => {
  render(
    <Input
      label="Password" name="password" value="" onChange={() => {}}
      error="Too short" hint="Should be secret"
    />
  );
  expect(screen.getByText('Too short')).toBeInTheDocument();
  expect(screen.queryByText('Should be secret')).not.toBeInTheDocument();
});

test('renders a clickable trailing icon and fires onIconClick', () => {
  const handleIconClick = jest.fn();
  render(
    <Input
      label="Password" name="password" value="" onChange={() => {}}
      icon="fa-solid fa-eye" onIconClick={handleIconClick} iconLabel="Show password"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(handleIconClick).toHaveBeenCalledTimes(1);
});

test('Textarea renders a label and responds to typing', () => {
  const handleChange = jest.fn();
  render(<Textarea label="Bio" name="bio" value="" onChange={handleChange} />);
  fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'hello' } });
  expect(handleChange).toHaveBeenCalledTimes(1);
});
