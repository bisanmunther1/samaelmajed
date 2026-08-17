import { NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";
import { API_BASE } from "./api";
import "./Admin.css";

const BUSINESS_LINKS = [
  { to: "/admin", label: "Dashboard", icon: "fa-solid fa-chart-column", end: true },
  { to: "/admin/trips", label: "Trips", icon: "fa-solid fa-plane-departure" },
  { to: "/admin/hotels", label: "Hotels", icon: "fa-solid fa-hotel" },
  { to: "/admin/trip-features", label: "Trip Features", icon: "fa-solid fa-route" },
  { to: "/admin/bookings", label: "Bookings", icon: "fa-solid fa-ticket" },
  { to: "/admin/profiles", label: "Profiles", icon: "fa-solid fa-user-circle" },
];

const ACCESS_LINKS = [
  { to: "/admin/users", label: "Users", icon: "fa-solid fa-users-cog" },
  { to: "/admin/groups", label: "Groups", icon: "fa-solid fa-users" },
  { to: "/admin/token-blacklist", label: "Token Blacklist", icon: "fa-solid fa-key" },
];

export default function AdminLayout() {
  const { admin_user, logout } = useAdminAuth();

  return (
    <div id="admin_shell">
      <aside id="admin_sidebar">
        <div id="admin_brand">
          <span id="admin_brand_mark">س</span>
          <span>سما المجد Admin</span>
        </div>

        <nav id="admin_nav">
          <div className="admin_nav_section_label">Business</div>
          {BUSINESS_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => "admin_nav_link" + (isActive ? " is_active" : "")}
            >
              <i className={link.icon} aria-hidden="true"></i>
              <span>{link.label}</span>
            </NavLink>
          ))}

          {admin_user?.is_superuser && (
            <>
              <div className="admin_nav_section_label admin_nav_section_muted">Access Control</div>
              {ACCESS_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => "admin_nav_link admin_nav_link_muted" + (isActive ? " is_active" : "")}
                >
                  <i className={link.icon} aria-hidden="true"></i>
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      <div id="admin_main">
        <header id="admin_topbar">
          <a href={`${API_BASE}/admin/`} target="_blank" rel="noreferrer" id="admin_django_link">
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Django Admin
          </a>
          <div id="admin_topbar_user">
            <i className="fa-solid fa-circle-user" aria-hidden="true"></i>
            <span>{admin_user?.username}</span>
            <button type="button" id="admin_logout_button" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        <main id="admin_content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
