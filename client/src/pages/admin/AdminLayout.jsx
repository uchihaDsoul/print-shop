import { useEffect, useState } from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { listOrders } from "../../adminApi";
import Icon from "../../components/Icon";
import { initials } from "../../format";
import { SHOP } from "../../shopConfig";
import { NEEDS_ACTION } from "../../statusMeta";

const ALL = ["manager", "admin", "superadmin"];
const BOSS = ["admin", "superadmin"];

const TABS = [
  { to: "dashboard", label: "Dashboard", icon: "dashboard", roles: BOSS },
  { to: "orders", label: "Orders", icon: "orders", roles: ALL, badge: true },
  { to: "walkin", label: "Walk-in order", icon: "plus", roles: ALL },
  { to: "customers", label: "Customers", icon: "customers", roles: BOSS },
  { to: "pricing", label: "Pricing", icon: "pricing", roles: BOSS },
  { to: "settings", label: "Settings", icon: "settings", roles: BOSS },
  { to: "users", label: "Staff", icon: "staff", roles: BOSS },
];

const ROLE_LABEL = {
  superadmin: "Super admin",
  admin: "Admin",
  manager: "Store manager",
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const list = await listOrders(`?status=${NEEDS_ACTION}`);
        if (alive) setPending(list.length);
      } catch {
        /* the pages show their own errors */
      }
    }
    check();
    const t = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

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
              {t.badge && pending > 0 && (
                <span className="count">{pending}</span>
              )}
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
          <button className="small ghost" onClick={logout}>
            <Icon name="logout" size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
