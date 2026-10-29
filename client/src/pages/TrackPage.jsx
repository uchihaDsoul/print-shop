import { useState } from "react";
import { trackOrder } from "../api";

const STEPS = ["Order placed", "Payment confirmed", "Printing", "Ready", "Collected"];

const STEP_OF = {
  awaiting_payment: 0,
  awaiting_confirmation: 0,
  queued: 1,
  printing: 2,
  printed: 2,
  print_failed: 2,
  ready: 3,
  collected: 4,
};

const MESSAGE = {
  awaiting_payment: "Waiting for your payment. Pay at the shop to start printing.",
  awaiting_confirmation: "The shop is checking your payment.",
  queued: "Payment confirmed. Your file is in the print queue.",
  printing: "Your file is printing.",
  printed: "Printed. The shop is checking your prints.",
  print_failed: "There was a printing problem. The shop is fixing it.",
  ready: "Your prints are ready for pickup!",
  collected: "Collected. Thank you!",
  cancelled: "This order was cancelled.",
};

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

  const current = order ? STEP_OF[order.status] : undefined;
  const closed = order && (order.status === "rejected" || order.status === "cancelled");

  return (
    <div className="card">
      <h2>Track your order</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label>
          Tracking code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. A3F9K2B7C1"
            required
          />
        </label>
        <button type="submit">Check status</button>
      </form>

      {error && <p className="error">{error}</p>}

      {order && (
        <div className="result">
          {!closed && (
            <div className="steps">
              {STEPS.map((label, i) => (
                <div key={label} className={`step ${i <= current ? "done" : ""}`}>
                  <div className="dot">{i <= current ? "✓" : i + 1}</div>
                  {label}
                </div>
              ))}
            </div>
          )}

          <p>
            <strong>
              {order.status === "rejected"
                ? `Payment was not accepted.${order.rejectReason ? ` Reason: ${order.rejectReason}` : ""}`
                : MESSAGE[order.status]}
            </strong>
          </p>
          <p>
            Code: <strong>{order.trackingCode}</strong>
          </p>
          <p>
            Amount: <strong>₹{order.price}</strong> ({order.paid ? "Paid" : "Not paid yet"})
          </p>
        </div>
      )}
    </div>
  );
}