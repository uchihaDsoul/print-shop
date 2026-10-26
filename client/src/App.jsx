import { Routes, Route, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import TrackPage from "./pages/TrackPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import AdminLayout from "./pages/admin/AdminLayout";
import OrdersTab from "./pages/admin/OrdersTab";
import WalkinTab from "./pages/admin/WalkinTab";
import ReportsTab from "./pages/admin/ReportsTab";
import { RequireRole, useAuth } from "./AuthContext";

const SHOP_NAME = "My Print Shop"; // change to your shop name

// /admin lands on Reports for bosses and Orders for managers
function AdminHome() {
  const { user } = useAuth();
  return <Navigate to={user.role === "manager" ? "/admin/orders" : "/admin/reports"} replace />;
}

const BOSS = ["admin", "superadmin"];

export default function App() {
  const wide = useLocation().pathname.startsWith("/admin");

  return (
    <div className="app">
      <div className="bg" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-logo">🖨️</span>
            {SHOP_NAME}
          </Link>
          <nav>
            <NavLink to="/" end>New order</NavLink>
            <NavLink to="/track">Track order</NavLink>
          </nav>
        </div>
      </header>

      <main className={wide ? "container wide" : "container"}>
        <Routes>
          <Route path="/" element={<OrderPage />} />
          <Route path="/track" element={<TrackPage />} />
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
        © {new Date().getFullYear()} {SHOP_NAME} · <Link to="/admin">Staff login</Link>
      </footer>
    </div>
  );
}