import { Routes, Route, NavLink } from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import TrackPage from "./pages/TrackPage";

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <h1>My Print Shop</h1>
        <nav>
          <NavLink to="/">New order</NavLink>
          <NavLink to="/track">Track order</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<OrderPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="*" element={<p>Page not found</p>} />
      </Routes>
    </div>
  );
}