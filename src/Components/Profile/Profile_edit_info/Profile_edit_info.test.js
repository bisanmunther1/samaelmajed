jest.mock('axios');

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Profile_edit_info from './Profile_edit_info';
import { ToastProvider } from '../../ui/Toast/ToastContext';
import { set_language } from '../../../i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

function renderPage() {
  return render(
    <ToastProvider>
      <Profile_edit_info />
    </ToastProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('username', 'edituser');
  localStorage.setItem('access_token', 'access-token');
  localStorage.setItem('refresh_token', 'refresh-token');
});

test('shows a skeleton while the profile is loading', () => {
  axios.get.mockReturnValue(new Promise(() => {}));
  const { container } = renderPage();
  expect(container.querySelector('#profile_edit_skeleton')).toBeInTheDocument();
});

test('populates the form once the profile loads', async () => {
  axios.get.mockResolvedValueOnce({
    data: { first_name: 'Ana', last_name: 'Smith', phone: '123', country: 'Egypt', birth_date: '1999-01-01', bio: 'hi' },
  });
  renderPage();

  expect(await screen.findByLabelText('First Name')).toHaveValue('Ana');
  expect(screen.getByLabelText('Country')).toHaveValue('Egypt');
});

test('shows an error state with retry when the profile fails to load', async () => {
  axios.get.mockRejectedValueOnce(new Error('network error'));
  renderPage();

  expect(await screen.findByText("We couldn't load your profile.")).toBeInTheDocument();

  axios.get.mockResolvedValueOnce({
    data: { first_name: 'Ana', last_name: '', phone: '', country: '', birth_date: '', bio: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByLabelText('First Name')).toHaveValue('Ana');
});

test('submits the form and shows a success toast', async () => {
  axios.get.mockResolvedValueOnce({
    data: { first_name: '', last_name: '', phone: '', country: '', birth_date: '', bio: '' },
  });
  axios.post.mockImplementation((url) => {
    if (url.includes('/token/refresh/')) return Promise.resolve({ data: { access: 'a2', refresh: 'r2' } });
    if (url.includes('/profile/send/')) return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });

  renderPage();
  await screen.findByLabelText('First Name');

  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Updated' } });
  fireEvent.click(screen.getByRole('button', { name: 'submit' }));

  expect(await screen.findByText('Your profile was updated successfully.')).toBeInTheDocument();
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    'http://localhost:8000/profile/send/',
    expect.any(FormData),
    expect.objectContaining({ headers: { Authorization: 'Bearer a2' } }),
  ));
});

test('rejects an oversized photo with an inline error instead of submitting', async () => {
  axios.get.mockResolvedValueOnce({
    data: { first_name: '', last_name: '', phone: '', country: '', birth_date: '', bio: '' },
  });
  renderPage();
  await screen.findByLabelText('First Name');

  const bigFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [bigFile] } });
  fireEvent.click(screen.getByRole('button', { name: 'submit' }));

  expect(await screen.findByText('The photo size should not exceed 2MB')).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});
