// Partner API calls.
//
// Same shape as the other feature APIs in this app: plain `axios` rather than
// an axios instance, because the existing component tests automock the module
// and `axios.create()` would return undefined there.
//
// The role this returns is the server's answer, never a client-side guess —
// every one of these endpoints re-derives it from the database.

import axios from "axios";
import { PARTNER_ERROR_MESSAGES, PARTNER_STRINGS } from "./strings";

export const API_BASE = "http://127.0.0.1:8000";
const PARTNER_URL = `${API_BASE}/api/partner/`;

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
    if (response.data.refresh) localStorage.setItem("refresh_token", response.data.refresh);
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
export function partner_error_message(error) {
  if (error && error.requires_login) return PARTNER_STRINGS.login_required;

  const data = error && error.response ? error.response.data : null;
  if (data) {
    if (data.code && PARTNER_ERROR_MESSAGES[data.code]) return PARTNER_ERROR_MESSAGES[data.code];
    if (typeof data.detail === "string") return data.detail;
  }

  return PARTNER_STRINGS.generic_error;
}

export function is_logged_in() {
  return Boolean(localStorage.getItem("access_token"));
}

/** The caller's partner record, or null when they are not a partner at all. */
export async function fetch_partner_me() {
  try {
    const response = await authed_request((config) => axios.get(`${PARTNER_URL}me/`, config));
    return response.data;
  } catch (error) {
    if (error && error.response && error.response.status === 404) return null;
    throw error;
  }
}

export async function register_partner(payload) {
  const response = await authed_request((config) =>
    axios.post(`${PARTNER_URL}register/`, payload, config)
  );
  return response.data;
}

export async function fetch_partner_dashboard() {
  const response = await authed_request((config) => axios.get(`${PARTNER_URL}dashboard/`, config));
  return response.data;
}

export async function fetch_partner_listings() {
  const response = await authed_request((config) => axios.get(`${PARTNER_URL}listings/`, config));
  return response.data;
}

export async function create_partner_listing(payload) {
  const response = await authed_request((config) =>
    axios.post(`${PARTNER_URL}listings/`, payload, config)
  );
  return response.data;
}

export async function update_partner_listing(listingId, payload) {
  const response = await authed_request((config) =>
    axios.patch(`${PARTNER_URL}listings/${encodeURIComponent(listingId)}/`, payload, config)
  );
  return response.data;
}

export async function delete_partner_listing(listingId) {
  await authed_request((config) =>
    axios.delete(`${PARTNER_URL}listings/${encodeURIComponent(listingId)}/`, config)
  );
}

export async function fetch_partner_bookings(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;

  const response = await authed_request((config) =>
    axios.get(`${PARTNER_URL}bookings/`, { params, ...config })
  );
  return response.data;
}
