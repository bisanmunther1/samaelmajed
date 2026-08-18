import axios from "axios";

export const API_BASE = "http://127.0.0.1:8000";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing_promise = null;

async function refresh_access_token() {
  const refresh_token = localStorage.getItem("refresh_token");
  if (!refresh_token) throw new Error("no refresh token");

  const response = await axios.post(`${API_BASE}/token/refresh/`, { refresh: refresh_token });
  localStorage.setItem("access_token", response.data.access);
  if (response.data.refresh) localStorage.setItem("refresh_token", response.data.refresh);
  return response.data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original_request = error.config;

    if (error.response && error.response.status === 401 && !original_request._retried) {
      original_request._retried = true;

      try {
        if (!refreshing_promise) {
          refreshing_promise = refresh_access_token().finally(() => {
            refreshing_promise = null;
          });
        }
        const new_token = await refreshing_promise;
        original_request.headers.Authorization = `Bearer ${new_token}`;
        return api(original_request);
      } catch (refresh_error) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("username");
        window.location.href = "/admin/login";
        return Promise.reject(refresh_error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
