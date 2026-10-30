import { useState } from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { RequestsProvider, useRequests } from "../../RequestsContext";
import RequestToasts from "../../components/RequestToasts";
import Icon from "../../components/Icon";
import { initials } from "../../format";
import { SHOP } from "../../shopConfig";

const ALL = ["manager", "admin", "superadmin"];
const BOSS = ["admin", "superadmin"];

const TABS = [
  { to: "requests", label: "Requests", icon: "bell", roles: ALL, badge: true },
  { to: "dashboard", label: "Dashboard", icon: "dashboard", roles: BOSS },
  { to: "orders", label: "Orders", icon: "orders", roles: ALL },
  { to: "walkin", label: "Walk-in order", icon: "plus", roles: ALL },
  { to: "customers", label: "Customers", icon: "customers", roles: BOSS },
  { to: "pricing", label: "Pricing", icon: "pricing", roles: BOSS },
  { to: "settings", label: "Settings", icon: "settings", roles: BOSS },
  { to: "users", label: "Staff", icon: "staff", roles: BOSS },
];

const ROLE_LABEL = { superadmin: "Super admin", admin: "Admin", manager: "Store manager" };

function Shell() {
  const { user, logout } = useAuth();
  const { requests, soundOn, needsClick, enableSound, disableSound } = useRequests();
  const [hideBanner, setHideBanner] = useState(false);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/admin" className="brand">
          <span className="brand-logo">
            <Icon name="printer" size={22} />
          </span>
          <span>
            {SHOP.name}
            <small className="brand-sub">Admin</small>
          </span>
        </Link>

        <nav className="side-nav">
          {TABS.filter((t) => t.roles.includes(user.role)).map((t) => (
            <NavLink key={t.to} to={t.to} className="side">
              <Icon name={t.icon} />
              {t.label}
              {t.badge && requests.length > 0 && <span className="count">{requests.length}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="side-foot">
          <div className="me">
            <span className="av">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{ROLE_LABEL[user.role] || user.role}</small>
            </span>
          </div>
          <button className="small ghost" onClick={soundOn ? disableSound : enableSound}>
            {soundOn ? "Mute alerts" : "Turn on alert sound"}
          </button>
          <button className="small ghost" onClick={logout}>
            <Icon name="logout" size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="main">
        {!soundOn && !hideBanner && (
          <div className="soundbar">
            <span>
              {needsClick
                ? "Click anywhere on the page to switch the alert sound back on."
                : "Alert sound is off. Turn it on to hear new payment requests."}
            </span>
            <span className="actions">
              {!needsClick && (
                <button className="small" onClick={enableSound}>
                  Turn on sound
                </button>
              )}
              <button className="small ghost" onClick={() => setHideBanner(true)}>
                Hide
              </button>
            </span>
          </div>
        )}
        <Outlet />
      </main>

      <RequestToasts />
    </div>
  );
}

export default function AdminLayout() {
  return (
    <RequestsProvider>
      <Shell />
    </RequestsProvider>
  );
}