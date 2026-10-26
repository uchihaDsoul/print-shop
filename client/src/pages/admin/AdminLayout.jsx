import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { listOrders } from "../../adminApi";

const TABS = [
  { to: "orders", label: "Orders", icon: "📋", roles: ["manager", "admin", "superadmin"], badge: true },
  { to: "walkin", label: "Walk-in", icon: "➕", roles: ["manager", "admin", "superadmin"] },
  { to: "reports", label: "Reports", icon: "📊", roles: ["admin", "superadmin"] },
  { to: "users", label: "Users", icon: "👥", roles: ["admin", "superadmin"] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);

  // pending-orders badge, refreshed every 30 seconds
  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const list = await listOrders("?status=pending");
        if (alive) setPending(list.length);
      } catch {
        /* ignore, the pages show their own errors */
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
    <>
      <nav className="adminnav">
        <div className="adminnav-links">
          {TABS.filter((t) => t.roles.includes(user.role)).map((t) => (
            <NavLink key={t.to} to={t.to} className="adminnav-link">
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
              {t.badge && pending > 0 && <span className="count">{pending}</span>}
            </NavLink>
          ))}
        </div>
        <div className="adminnav-user">
          <span className="who">
            {user.name} <small>({user.role})</small>
          </span>
          <button className="small ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>

      <Outlet />
    </>
  );
}