jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Login from './Login';
import { set_language } from '../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

function renderLogin() {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test('shows an inline error when the password is too short after submitting', () => {
  renderLogin();

  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ab' } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));

  expect(screen.getByText('Password must be more than 4 characters')).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('does not show the password error before the first submit attempt', () => {
  renderLogin();
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ab' } });
  expect(screen.queryByText('Password must be more than 4 characters')).not.toBeInTheDocument();
});

test('submits valid credentials and stores the tokens on success', async () => {
  axios.post.mockResolvedValueOnce({ data: { access: 'access-token', refresh: 'refresh-token' } });
  renderLogin();

  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'strongpass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://localhost:8000/token/',
    { username: 'alice', password: 'strongpass' },
  ));
  await waitFor(() => expect(localStorage.getItem('access_token')).toBe('access-token'));
  expect(localStorage.getItem('username')).toBe('alice');
});

test('shows an error message when the credentials are rejected', async () => {
  axios.post.mockRejectedValueOnce({ response: { status: 401 } });
  renderLogin();

  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));

  expect(await screen.findByText('invalid user name or password')).toBeInTheDocument();
});

test('toggles password visibility', () => {
  renderLogin();
  const passwordInput = screen.getByLabelText('Password');
  expect(passwordInput).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(passwordInput).toHaveAttribute('type', 'text');
});
