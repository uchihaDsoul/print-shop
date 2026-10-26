import { useState } from "react";
import { trackOrder } from "../api";

const STEPS = [
  { key: "pending", label: "Received" },
  { key: "printing", label: "Printing" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

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

  const current = order ? STEPS.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="card">
      <h2>Track your order</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label>
          Tracking code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. A3F9K2"
            required
          />
        </label>
        <button type="submit">Check status</button>
      </form>

      {error && <p className="error">{error}</p>}

      {order && (
        <div className="result">
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`step ${i <= current ? "done" : ""}`}>
                <div className="dot">{i <= current ? "✓" : i + 1}</div>
                {s.label}
              </div>
            ))}
          </div>
          <p>Code: <strong>{order.trackingCode}</strong></p>
          <p>Amount: <strong>₹{order.price}</strong> ({order.paid ? "Paid" : "Pay at shop"})</p>
          {order.status === "ready" && <p><strong>🎉 Your prints are ready for pickup!</strong></p>}
        </div>
      )}
    </div>
  );
}