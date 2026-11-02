import { useState } from "react";
import { submitUpi, atCounter, cancelOrder } from "../api";
import QRCode from "react-qr-code";
import { SHOP } from "../shopConfig";

export default function PaymentPanel({ order, onUpdate, settings }) {
  const [method, setMethod] = useState(""); // "upi" or "cash"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  async function handleConfirm(e) {
    if (e) e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let updated;
      if (method === "upi") {
        updated = await submitUpi(order.trackingCode, ref);
      } else if (method === "cash") {
        updated = await atCounter(order.trackingCode);
      }
      if (updated) onUpdate(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    setError("");
    setSubmitting(true);
    try {
      const updated = await cancelOrder(order.trackingCode);
      if (updated) onUpdate(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Use toggles if provided, otherwise default to showing both
  const showCash = settings ? settings.guestShowCash : true;
  const showUPI = settings ? settings.guestShowUPI : true;

  if (order.status !== "awaiting_payment") return null;

  const upiLink = `upi://pay?pa=${settings?.upiId || SHOP.upiId}&pn=${encodeURIComponent(
    settings?.upiPayeeName || SHOP.name
  )}&tr=${order.trackingCode}&am=${order.price}&cu=INR`;

  return (
    <div className="payment-panel">
      {!method && (
        <div className="payment-choices">
          {showUPI && (
            <button type="button" onClick={() => setMethod("upi")}>
              Pay with UPI
              <small>Scan QR or open app</small>
            </button>
          )}
          {showCash && (
            <button type="button" onClick={() => setMethod("cash")}>
              Pay with cash
              <small>At the counter</small>
            </button>
          )}
          {!showUPI && !showCash && (
            <p className="note">No payment methods are currently available. Please see a manager.</p>
          )}
          
          {/* Cancel button right on the main payment choice screen */}
          <button
            type="button"
            className="ghost small"
            onClick={handleCancel}
            disabled={submitting}
            style={{ marginTop: "12px", width: "100%", color: "#ef4444", borderColor: "#ef4444" }}
          >
            Cancel this order
          </button>
        </div>
      )}

      {method === "cash" && (
        <div className="cash-flow">
          <p>
            Please give <strong>₹{order.price}</strong> to the manager at the counter. They will
            confirm it on their screen to start printing.
          </p>
          <div className="actions">
            <button
              type="button"
              className="small ghost"
              onClick={() => setMethod("")}
              disabled={submitting}
            >
              Back
            </button>
            <button type="button" className="small" onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Telling shop..." : "I'm at the counter"}
            </button>
          </div>
          <button
            type="button"
            className="ghost small"
            onClick={handleCancel}
            disabled={submitting}
            style={{ marginTop: "10px", width: "100%", color: "#ef4444" }}
          >
            Cancel order
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {method === "upi" && (
        <form className="upi-flow" onSubmit={handleConfirm}>
          <div className="qr-wrap">
            <QRCode value={upiLink} size={180} />
          </div>

          <a
            href={upiLink}
            className="small button"
            style={{
              display: "block",
              textAlign: "center",
              background: "var(--accent, #6366f1)",
              color: "#fff",
              padding: "10px",
              borderRadius: "8px",
              textDecoration: "none",
              margin: "12px 0",
              fontWeight: "500"
            }}
          >
            ⚡ Open UPI App (GPay / PhonePe / Paytm)
          </a>

          <p className="note">
            Scan the QR code or tap the button above to pay <strong>₹{order.price}</strong>.
          </p>

          <label>
            12-digit UPI reference number (UTR)
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              required
              inputMode="numeric"
              pattern="[0-9]{12}"
              title="Enter the 12-digit number from your payment app"
              placeholder="e.g. 312345678901"
            />
          </label>

          <div className="actions">
            <button
              type="button"
              className="small ghost"
              onClick={() => {
                setMethod("");
                setRef("");
              }}
              disabled={submitting}
            >
              Back
            </button>
            <button className="small" type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Confirm payment"}
            </button>
          </div>

          <button
            type="button"
            className="ghost small"
            onClick={handleCancel}
            disabled={submitting}
            style={{ marginTop: "10px", width: "100%", color: "#ef4444" }}
          >
            Cancel order
          </button>

          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}