import { createContext, useContext, useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";

const AdminAuthContext = createContext(null);

function decode_jwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function claims_from_storage() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;

  const decoded = decode_jwt(token);
  if (!decoded) return null;

  return {
    username: decoded.username,
    is_staff: Boolean(decoded.is_staff),
    is_superuser: Boolean(decoded.is_superuser),
  };
}

export function AdminAuthProvider({ children }) {
  const [admin_user, set_admin_user] = useState(() => claims_from_storage());
  const [auth_status, set_auth_status] = useState("idle"); // idle | loading | error

  async function login(username, password) {
    set_auth_status("loading");
    try {
      const response = await axios.post(`${API_BASE}/token/`, { username, password });
      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("username", username);
      const claims = claims_from_storage();
      set_admin_user(claims);
      set_auth_status("idle");
      return claims;
    } catch (e) {
      set_auth_status("error");
      throw e;
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    set_admin_user(null);
  }

  return (
    <AdminAuthContext.Provider value={{ admin_user, auth_status, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
