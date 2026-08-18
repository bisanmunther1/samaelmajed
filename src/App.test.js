jest.mock('axios');

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import App from './App';
import { set_language } from './i18n';

// This suite describes the English rendering, so it pins the language rather
// than depending on the app default (Arabic).
beforeEach(() => {
  set_language('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: [] });
});

test('renders the home page with the site header, without crashing', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole('banner')).toBeInTheDocument();
});

test('renders the login page on /Login/Login.js', async () => {
  render(
    <MemoryRouter initialEntries={['/Login/Login.js']}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
});
