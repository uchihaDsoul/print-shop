import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getPublicSettings, submitUpi, chooseCash, atCounter } from "../api";

export default function PaymentPanel({ order, onUpdate }) {
  const [settings, setSettings] = useState(null);
  const [method, setMethod] = useState(order.paymentMethod || "");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicSettings()
      .then(setSettings)
      .catch(() => setSettings({}));
  }, []);

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      onUpdate(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const code = order.trackingCode;
  const deadline = order.expiresAt
    ? new Date(order.expiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : "";

  // 1) the customer has paid or arrived, and the shop is checking
  if (order.status === "awaiting_confirmation") {
    return (
      <div className="pay">
        <h3>Waiting for confirmation</h3>
        <p>
          {order.paymentMethod === "cash"
            ? "The shop knows you're at the counter. Please pay the manager."
            : settings?.waitMessage || "The shop will confirm your payment shortly."}
        </p>
        {order.paymentMethod === "upi" && (
          <p className="note">Your reference number was received. Printing starts after the shop confirms it.</p>
        )}
      </div>
    );
  }

  if (order.status !== "awaiting_payment") return null;

  const upiId = settings?.upiId;
  const amount = Number(order.price).toFixed(2);
  const link = upiId
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(settings.upiPayeeName || "Print shop")}` +
      `&am=${amount}&cu=INR&tn=${encodeURIComponent("Order " + code)}`
    : "";

  return (
    <div className="pay">
      <h3>How would you like to pay?</h3>

      <div className="method">
        <button
          type="button"
          className={"chip" + (method === "upi" ? " on" : "")}
          onClick={() => setMethod("upi")}
        >
          Pay by UPI
        </button>
        <button
          type="button"
          className={"chip" + (method === "cash" ? " on" : "")}
          onClick={() => {
            setMethod("cash");
            if (order.paymentMethod !== "cash") run(() => chooseCash(code));
          }}
        >
          Pay cash at the shop
        </button>
      </div>

      {method === "upi" && !settings && <p className="note">Loading...</p>}

      {method === "upi" && settings && !upiId && (
        <p className="error">UPI payment isn't set up yet. Please pay cash at the shop.</p>
      )}

      {method === "upi" && upiId && (
        <>
          <div className="qr">
            <QRCodeSVG value={link} size={190} />
          </div>
          <p>
            Scan with any UPI app and pay exactly <strong>₹{amount}</strong>.
          </p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <a className="btn" href={link}>
              Open UPI app
            </a>
          </div>
          <label>
            After paying, enter the 12-digit UPI reference number
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value.replace(/\D/g, "").slice(0, 12))}
              inputMode="numeric"
              placeholder="e.g. 412345678901"
              autoComplete="off"
            />
          </label>
          <p className="note">
            You'll find it in your payment app as "UPI Ref No." or "UTR". The shop checks it against
            their bank before printing.
          </p>
          <button
            type="button"
            disabled={busy || reference.length !== 12}
            onClick={() => run(() => submitUpi(code, reference))}
          >
            {busy ? "Sending..." : "I've paid"}
          </button>
        </>
      )}

      {method === "cash" && (
        <>
          <p>
            Come to the shop and show your tracking code <strong>{code}</strong>. When you're at the
            counter, tap the button below so the manager knows you're there.
          </p>
          <button type="button" disabled={busy} onClick={() => run(() => atCounter(code))}>
            {busy ? "Sending..." : "I'm at the counter"}
          </button>
        </>
      )}

      {deadline && <p className="note">Please pay before {deadline}, or this order is cancelled.</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}