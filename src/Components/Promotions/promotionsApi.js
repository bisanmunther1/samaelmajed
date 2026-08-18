// Promo-code API calls.
//
// Same shape as FR-38's reviewsApi: plain `axios` rather than an axios
// instance, because the existing component tests automock the module and
// `axios.create()` would return undefined there.

import axios from "axios";
import { PROMO_ERROR_MESSAGES, PROMO_STRINGS } from "./strings";

export const API_BASE = "http://127.0.0.1:8000";
const PROMOTIONS_URL = `${API_BASE}/api/promotions/`;

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
export function promo_error_message(error) {
  if (error && error.requires_login) return PROMO_STRINGS.login_required;

  const data = error && error.response ? error.response.data : null;
  if (data) {
    if (data.code && PROMO_ERROR_MESSAGES[data.code]) return PROMO_ERROR_MESSAGES[data.code];
    if (typeof data.detail === "string") return data.detail;
  }

  return PROMO_STRINGS.generic_error;
}

/** Dry run — prices the code without redeeming it. */
export async function validate_promo_code({ code, trip, amount }) {
  const response = await authed_request((config) =>
    axios.post(`${PROMOTIONS_URL}validate/`, { code, trip, amount }, config)
  );
  return response.data;
}

export async function fetch_active_promo_codes() {
  const response = await axios.get(`${PROMOTIONS_URL}active/`);
  return response.data;
}
