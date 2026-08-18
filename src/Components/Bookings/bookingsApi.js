// Cancellation and availability calls.
//
// Same shape as FR-38's reviewsApi and FR-45's promotionsApi: plain `axios`
// rather than an axios instance, because the existing component tests automock
// the module and `axios.create()` would return undefined there.

import axios from "axios";
import { BOOKING_ERROR_MESSAGES, BOOKING_STRINGS } from "./strings";

export const API_BASE = "http://127.0.0.1:8000";

function login_required_error() {
  const error = new Error("login required");
  error.requires_login = true;
  return error;
}

function auth_config() {
  const token = localStorage.getItem("access_token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

async function refresh_access_token() {
  const refresh_token = localStorage.getItem("refresh_token");
  if (!refresh_token) return null;

  try {
    const response = await axios.post(`${API_BASE}/token/refresh/`, { refresh: refresh_token });
    localStorage.setItem("access_token", response.data.access);
    return response.data.access;
  } catch (error) {
    return null;
  }
}

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

/** Turns any failure into a sentence we can show the user. */
export function booking_error_message(error) {
  if (error && error.requires_login) return BOOKING_STRINGS.login_required;

  const data = error && error.response ? error.response.data : null;
  if (data) {
    if (data.code && BOOKING_ERROR_MESSAGES[data.code]) return BOOKING_ERROR_MESSAGES[data.code];
    if (typeof data.detail === "string") return data.detail;
  }

  return BOOKING_STRINGS.generic_error;
}

/** Remaining seats per date. Public — no token needed. */
export async function fetch_trip_availability({ tripName, from, to }) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;

  const response = await axios.get(
    `${API_BASE}/api/trips/${encodeURIComponent(tripName)}/availability/`,
    { params }
  );
  return response.data;
}

export async function fetch_cancellation_preview(bookingId) {
  const response = await authed_request((config) =>
    axios.get(`${API_BASE}/api/bookings/${bookingId}/cancellation-preview/`, config)
  );
  return response.data;
}

export async function cancel_booking({ bookingId, reason }) {
  const response = await authed_request((config) =>
    axios.post(`${API_BASE}/api/bookings/${bookingId}/cancel/`, { reason }, config)
  );
  return response.data;
}
