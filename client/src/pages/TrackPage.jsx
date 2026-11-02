import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackOrder } from "../api";
import PaymentPanel from "../components/PaymentPanel";

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
  awaiting_payment: "Waiting for your payment.",
  awaiting_confirmation: "The shop is checking your payment.",
  queued: "Payment confirmed. Your file is in the print queue.",
  printing: "Your file is printing.",
  printed: "Printed. The shop is checking your prints.",
  print_failed: "There was a printing problem. The shop is fixing it.",
  ready: "Your prints are ready for pickup!",
  collected: "Collected. Thank you!",
};

const FINAL = ["collected", "rejected", "cancelled"];

function rememberCode(code) {
  try {
    localStorage.setItem("lastTrack", code);
  } catch {
    /* ignore */
  }
}
function lastCode() {
  try {
    return localStorage.getItem("lastTrack") || "";
  } catch {
    return "";
  }
}

export default function TrackPage() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();

  const [code, setCode] = useState(urlCode || "");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);

  // load the order whenever the address has a code
  useEffect(() => {
    if (!urlCode) {
      setOrder(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    trackOrder(urlCode.trim())
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setCode(o.trackingCode);
        rememberCode(o.trackingCode);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrder(null);
        setError(err.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [urlCode, reload]);

  // keep the status fresh while the order is still open
  useEffect(() => {
    if (!order || FINAL.includes(order.status)) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      trackOrder(order.trackingCode)
        .then(setOrder)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [order?.trackingCode, order?.status]);

  function handleSubmit(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (c === (urlCode || "").toUpperCase()) setReload((n) => n + 1);
    else navigate(`/track/${c}`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/track/${order.trackingCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* some browsers block copying */
    }
  }

  const closed = order && (order.status === "rejected" || order.status === "cancelled");
  const current = order ? STEP_OF[order.status] : undefined;
  const previous = !urlCode ? lastCode() : "";

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
        <button type="submit" disabled={loading}>
          {loading ? "Checking..." : "Check status"}
        </button>
      </form>

      {previous && (
        <p className="note">
          Your last order on this device:{" "}
          <Link to={`/track/${previous}`}>
            <strong>{previous}</strong>
          </Link>
        </p>
      )}

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
                : order.status === "cancelled"
                  ? `This order was cancelled.${order.cancelReason ? ` (${order.cancelReason})` : ""}`
                  : MESSAGE[order.status]}
            </strong>
          </p>

          <p>
            Code: <strong>{order.trackingCode}</strong>
          </p>
          <p>
            Amount: <strong>₹{order.price}</strong> ({order.paid ? "Paid" : "Not paid yet"})
          </p>

          {order.source === "online" &&
            ["awaiting_payment", "awaiting_confirmation"].includes(order.status) && (
              <PaymentPanel
                order={order}
                onUpdate={(next) =>
                  setOrder((prev) => ({
                    ...prev,
                    ...next,
                    trackingCode: next?.trackingCode || prev?.trackingCode,
                  }))
                }
              />
            )}

          {closed && (
            <p className="note">
              Need to print this? <Link to="/">Place a new order</Link>.
            </p>
          )}

          <div className="actions">
            <button type="button" className="small ghost" onClick={copyLink}>
              {copied ? "Link copied" : "Copy link to this order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}