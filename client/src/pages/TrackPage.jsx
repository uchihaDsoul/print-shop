import { useState } from "react";
import { trackOrder } from "../api";

export default function TrackPage() {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setOrder(null);
    try {
      setOrder(await trackOrder(code.trim()));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h2>Track your order</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Tracking code
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button type="submit">Check status</button>
      </form>

      {error && <p className="error">{error}</p>}

      {order && (
        <div className="result">
          <p>Code: <strong>{order.trackingCode}</strong></p>
          <p>Status: <span className={`badge ${order.status}`}>{order.status}</span></p>
          <p>Amount: ₹{order.price} ({order.paid ? "Paid" : "Pay at shop"})</p>
        </div>
      )}
    </div>
  );
}