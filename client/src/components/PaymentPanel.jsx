import { useState } from "react";
import { submitUpi, atCounter } from "../api";
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

  // Use toggles if provided, otherwise default to showing both
  const showCash = settings ? settings.guestShowCash : true;
  const showUPI = settings ? settings.guestShowUPI : true;

  if (order.status !== "awaiting_payment") return null;

  return (
    <div className="payment-panel">
      {!method && (
        <div className="payment-choices">
          {showUPI && (
            <button type="button" onClick={() => setMethod("upi")}>
              Pay with UPI
              <small>Scan a QR code</small>
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
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {method === "upi" && (
        <form className="upi-flow" onSubmit={handleConfirm}>
          <div className="qr-wrap">
            <QRCode
              value={`upi://pay?pa=${settings?.upiId || SHOP.upiId}&pn=${encodeURIComponent(
                settings?.upiPayeeName || SHOP.name
              )}&tr=${order.trackingCode}&am=${order.price}&cu=INR`}
              size={180}
            />
          </div>
          <p className="note">
            Scan this with PhonePe, Google Pay or Paytm to pay <strong>₹{order.price}</strong>.
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
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}