// Thin API layer over /api/reviews/.
//
// Deliberately built on the bare `axios` module rather than an axios instance:
// the rest of the public app calls axios directly, and the existing component
// tests automock it — an `axios.create()` here would break them.

import axios from "axios";
import { REVIEW_ERROR_MESSAGES, REVIEW_STRINGS } from "./strings";

export const API_BASE = "http://127.0.0.1:8000";
export const REVIEWS_URL = `${API_BASE}/api/reviews/`;

function login_required_error() {
  const error = new Error("login required");
  error.requires_login = true;
  return error;
}

function auth_config() {
  const token = localStorage.getItem("access_token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

// Access tokens live 5 minutes, so a refresh on 401 is the normal path, not an
// edge case. Returns the new token, or null when the session is really over.
async function refresh_access_token() {
  const refresh_token = localStorage.getItem("refresh_token");
  if (!refresh_token) return null;

  try {
    const response = await axios.post(`${API_BASE}/token/refresh/`, { refresh: refresh_token });
    localStorage.setItem("access_token", response.data.access);
    if (response.data.refresh) localStorage.setItem("refresh_token", response.data.refresh);
    return response.data.access;
  } catch (error) {
    return null;
  }
}

// A read anyone may make. A stale token would make even a public endpoint
// answer 401, so fall all the way back to an anonymous request.
async function public_request(run) {
  try {
    return await run(auth_config());
  } catch (error) {
    if (!error || !error.response || error.response.status !== 401) throw error;

    const fresh_token = await refresh_access_token();
    if (fresh_token) return run({ headers: { Authorization: `Bearer ${fresh_token}` } });
    return run({});
  }
}

// A write, or a read of the user's own data. Ends in `requires_login` rather
// than a redirect so the caller can prompt instead of losing the page.
async function authed_request(run) {
  if (!localStorage.getItem("access_token")) throw login_required_error();

  try {
    return await run(auth_config());
  } catch (error) {
    if (!error || !error.response || error.response.status !== 401) throw error;

    const fresh_token = await refresh_access_token();
    if (!fresh_token) throw login_required_error();
    return run({ headers: { Authorization: `Bearer ${fresh_token}` } });
  }
}

export function is_logged_in() {
  return Boolean(localStorage.getItem("access_token"));
}

/** Turns any failure into a sentence we can show the user. */
export function review_error_message(error) {
  if (error && error.requires_login) return REVIEW_STRINGS.login_required;

  const data = error && error.response ? error.response.data : null;
  if (data) {
    if (data.code && REVIEW_ERROR_MESSAGES[data.code]) return REVIEW_ERROR_MESSAGES[data.code];
    if (typeof data.detail === "string") return data.detail;
  }

  return REVIEW_STRINGS.generic_error;
}

export function requires_login(error) {
  if (error && error.requires_login) return true;
  return Boolean(error && error.response && error.response.status === 401);
}

export async function fetch_reviews({ targetType, targetId, page = 1, ordering = "-created_at" }) {
  const params = { page, ordering, [targetType]: targetId };
  const response = await public_request((config) => axios.get(REVIEWS_URL, { params, ...config }));
  return response.data;
}

export async function fetch_summary({ targetType, targetId }) {
  const params = { [targetType]: targetId };
  const response = await public_request((config) =>
    axios.get(`${REVIEWS_URL}summary/`, { params, ...config })
  );
  return response.data;
}

export async function fetch_my_reviews() {
  const response = await authed_request((config) => axios.get(`${REVIEWS_URL}my/`, config));
  return response.data;
}

export async function fetch_pending_reviews() {
  const response = await authed_request((config) => axios.get(`${REVIEWS_URL}pending/`, config));
  return response.data;
}

export async function create_review({ booking, targetType, targetId, rating, comment }) {
  const payload = { booking, rating, comment, [targetType]: targetId };
  const response = await authed_request((config) => axios.post(REVIEWS_URL, payload, config));
  return response.data;
}

export async function update_review({ id, rating, comment }) {
  const response = await authed_request((config) =>
    axios.patch(`${REVIEWS_URL}${id}/`, { rating, comment }, config)
  );
  return response.data;
}

export async function delete_review(id) {
  await authed_request((config) => axios.delete(`${REVIEWS_URL}${id}/`, config));
}
