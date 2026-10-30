import {
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  Outlet,
} from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import TrackPage from "./pages/TrackPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import AdminLayout from "./pages/admin/AdminLayout";
import RequestsTab from "./pages/admin/RequestsTab";
import DashboardTab from "./pages/admin/DashboardTab";
import OrdersTab from "./pages/admin/OrdersTab";
import WalkinTab from "./pages/admin/WalkinTab";
import CustomersTab from "./pages/admin/CustomersTab";
import PricingTab from "./pages/admin/PricingTab";
import SettingsTab from "./pages/admin/SettingsTab";
import ComputersTab from "./pages/admin/ComputersTab";
import PrintersTab from "./pages/admin/PrintersTab";
import PrintQueueTab from "./pages/admin/PrintQueueTab";
import Icon from "./components/Icon";
import { RequireRole, useAuth } from "./AuthContext";
import { SHOP } from "./shopConfig";

const BOSS = ["admin", "superadmin"];

function PublicLayout() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-logo">
              <Icon name="printer" size={22} />
            </span>
            {SHOP.name}
          </Link>
          <nav>
            <NavLink to="/" end>
              New order
            </NavLink>
            <NavLink to="/track">Track order</NavLink>
          </nav>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} {SHOP.name} ·{" "}
        <Link to="/admin">Staff login</Link>
      </footer>
    </div>
  );
}

// /admin lands on Requests for managers and on the Dashboard for bosses
function AdminHome() {
  const { user } = useAuth();
  return (
    <Navigate
      to={user.role === "manager" ? "/admin/requests" : "/admin/dashboard"}
      replace
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<OrderPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/track/:code" element={<TrackPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="*" element={<p>Page not found</p>} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="requests" element={<RequestsTab />} />
        <Route
          path="dashboard"
          element={
            <RequireRole roles={BOSS}>
              <DashboardTab />
            </RequireRole>
          }
        />
        <Route path="orders" element={<OrdersTab />} />
        <Route path="walkin" element={<WalkinTab />} />
        <Route
          path="customers"
          element={
            <RequireRole roles={BOSS}>
              <CustomersTab />
            </RequireRole>
          }
        />
        <Route
          path="pricing"
          element={
            <RequireRole roles={BOSS}>
              <PricingTab />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={BOSS}>
              <SettingsTab />
            </RequireRole>
          }
        />

        <Route path="queue" element={<PrintQueueTab />} />
        <Route path="printers" element={<PrintersTab />} />
        <Route
          path="computers"
          element={
            <RequireRole roles={BOSS}>
              <ComputersTab />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={BOSS}>
              <UsersPage />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  );
}
