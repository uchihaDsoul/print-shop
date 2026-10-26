import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import TrackPage from "./pages/TrackPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import UsersPage from "./pages/UsersPage";
import { RequireRole } from "./AuthContext";

export default function App() {
  const wide = useLocation().pathname.startsWith("/admin");

  return (
    <div className={wide ? "container wide" : "container"}>
      <header className="header">
        <h1>My Print Shop</h1>
        <nav>
          <NavLink to="/" end>New order</NavLink>
          <NavLink to="/track">Track order</NavLink>
          <NavLink to="/admin">Staff</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<OrderPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={<RequireRole><AdminPage /></RequireRole>}
        />
        <Route
          path="/admin/users"
          element={<RequireRole roles={["admin", "superadmin"]}><UsersPage /></RequireRole>}
        />
        <Route path="*" element={<p>Page not found</p>} />
      </Routes>
    </div>
  );
}