import { Routes, Route, NavLink, Link, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import OrderPage from "./pages/OrderPage";
import TrackPage from "./pages/TrackPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import AdminLayout from "./pages/admin/AdminLayout";
import OrdersTab from "./pages/admin/OrdersTab";
import WalkinTab from "./pages/admin/WalkinTab";
import ReportsTab from "./pages/admin/ReportsTab";
import ThemeSwitcher, { useTheme } from "./ThemeSwitcher";
import { RequireRole, useAuth } from "./AuthContext";
import { SHOP } from "./shopConfig";

const BOSS = ["admin", "superadmin"];

function AdminHome() {
  const { user } = useAuth();
  return <Navigate to={user.role === "manager" ? "/admin/orders" : "/admin/reports"} replace />;
}

const PrinterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <rect x="7" y="14" width="10" height="7" />
  </svg>
);

export default function App() {
  const [theme, setTheme] = useTheme();

  return (
    <div className={`app t-${theme}`}>
      <div className="themebar">
        <ThemeSwitcher theme={theme} setTheme={setTheme} />
      </div>

      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="ico"><PrinterIcon /></span>
            {SHOP.name}
          </Link>
          <nav aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/order">New order</NavLink>
            <NavLink to="/track">Track order</NavLink>
          </nav>
          <Link className="btn ghost" to="/admin">Staff login</Link>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/track" element={<div className="page-narrow"><TrackPage /></div>} />
          <Route path="/admin/login" element={<LoginPage />} />

          <Route path="/admin" element={<RequireRole><AdminLayout /></RequireRole>}>
            <Route index element={<AdminHome />} />
            <Route path="orders" element={<OrdersTab />} />
            <Route path="walkin" element={<WalkinTab />} />
            <Route path="reports" element={<RequireRole roles={BOSS}><ReportsTab /></RequireRole>} />
            <Route path="users" element={<RequireRole roles={BOSS}><UsersPage /></RequireRole>} />
          </Route>

          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} {SHOP.name}
      </footer>
    </div>
  );
}