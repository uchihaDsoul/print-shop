import { Routes, Route, NavLink, Link, useLocation } from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import TrackPage from "./pages/TrackPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import UsersPage from "./pages/UsersPage";
import { RequireRole } from "./AuthContext";

const SHOP_NAME = "My Print Shop"; // change to your shop name

export default function App() {
  const wide = useLocation().pathname.startsWith("/admin");

  return (
    <div className="app">
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
          <Route path="/admin" element={<RequireRole><AdminPage /></RequireRole>} />
          <Route
            path="/admin/users"
            element={<RequireRole roles={["admin", "superadmin"]}><UsersPage /></RequireRole>}
          />
          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} {SHOP_NAME} · <Link to="/admin">Staff login</Link>
      </footer>
    </div>
  );
}