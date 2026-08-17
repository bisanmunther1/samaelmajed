jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Register from './Register';
import { ToastProvider } from '../ui/Toast/ToastContext';

function renderRegister() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Register />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'strongpass' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'strongpass' } });
}

test('shows an inline error when passwords do not match', () => {
  renderRegister();
  fillValidForm();
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));

  expect(screen.getByText('Password does not match')).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('shows an inline error when the password is too short', () => {
  renderRegister();
  fillValidForm();
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ab' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'ab' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));

  expect(screen.getByText('Password must be more than 4 characters')).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('shows a name-taken error returned by the API', async () => {
  axios.post.mockRejectedValueOnce({ response: { data: ['name'] } });
  renderRegister();
  fillValidForm();
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));

  expect(await screen.findByText('Name is already taken')).toBeInTheDocument();
});

test('shows an email-taken error returned by the API', async () => {
  axios.post.mockRejectedValueOnce({ response: { data: ['email'] } });
  renderRegister();
  fillValidForm();
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));

  expect(await screen.findByText('Email is already taken')).toBeInTheDocument();
});

test('submits valid data and shows a success toast', async () => {
  axios.post.mockResolvedValueOnce({ data: { message: 'ok' } });
  renderRegister();
  fillValidForm();
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/user/add/',
    { username: 'newuser', email: 'new@example.com', password: 'strongpass' },
  ));
  expect(await screen.findByText('Registration complete! Log in with your new account.')).toBeInTheDocument();
});
