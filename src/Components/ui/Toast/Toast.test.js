import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';

function ToastTrigger({ message, type, duration }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type, duration)}>Trigger</button>;
}

test('useToast throws when used outside a ToastProvider', () => {
  function Bare() {
    useToast();
    return null;
  }
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Bare />)).toThrow('useToast must be used within a ToastProvider');
  spy.mockRestore();
});

test('showToast renders a toast with the given message', () => {
  render(
    <ToastProvider>
      <ToastTrigger message="Saved!" type="success" />
    </ToastProvider>
  );

  act(() => {
    screen.getByRole('button', { name: 'Trigger' }).click();
  });

  expect(screen.getByText('Saved!')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveClass('ui-toast-success');
});

test('a toast auto-dismisses after its duration', () => {
  jest.useFakeTimers();

  render(
    <ToastProvider>
      <ToastTrigger message="Bye soon" type="info" duration={1000} />
    </ToastProvider>
  );

  act(() => {
    screen.getByRole('button', { name: 'Trigger' }).click();
  });
  expect(screen.getByText('Bye soon')).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.queryByText('Bye soon')).not.toBeInTheDocument();

  jest.useRealTimers();
});

test('clicking dismiss removes the toast immediately', () => {
  render(
    <ToastProvider>
      <ToastTrigger message="Dismiss me" type="error" duration={60000} />
    </ToastProvider>
  );

  act(() => {
    screen.getByRole('button', { name: 'Trigger' }).click();
  });
  expect(screen.getByText('Dismiss me')).toBeInTheDocument();

  act(() => {
    screen.getByRole('button', { name: 'Dismiss' }).click();
  });
  expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
});
