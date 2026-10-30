import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRequests } from "../../RequestsContext";
import { confirmPayment, rejectPayment, getFileLink } from "../../adminApi";
import { rupees } from "../../format";

const QUICK_REASONS = [
  "Payment not received",
  "Amount is wrong",
  "Reference number not found",
];

function waited(since, now) {
  const mins = Math.max(0, Math.floor((now - new Date(since)) / 60000));
  return mins < 1 ? "just now" : `${mins} min`;
}

export default function RequestsTab() {
  const { requests, unpaid, queued, error: loadError, refresh } = useRequests();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // keep the "waiting for" times fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  async function act(id, fn) {
    setError("");
    setBusy(id);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
      await refresh();
    }
  }

  function confirm(r) {
    const method = r.paymentMethod === "upi" ? "upi" : "cash";
    if (
      method === "upi" &&
      !window.confirm(
        `Check your UPI app first.\n\nDid ₹${r.price} arrive with reference ${r.upiReference}?`
      )
    ) {
      return;
    }
    act(r._id, () => confirmPayment(r._id, method));
  }

  function takePayment(o, method) {
    if (
      method === "upi" &&
      !window.confirm(
        `Check your UPI app first.\n\nDid ₹${o.price} arrive for order ${o.trackingCode}?`
      )
    ) {
      return;
    }
    act(o._id, () => confirmPayment(o._id, method));
  }

  async function sendReject(r) {
    await act(r._id, () => rejectPayment(r._id, reason));
    setRejecting("");
    setReason("");
  }

  async function openFile(id) {
    try {
      const { url } = await getFileLink(id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="page-head">
        <h1>Payment requests</h1>
        <span className="date">{requests.length} waiting</span>
      </header>

      {(error || loadError) && <p className="error">{error || loadError}</p>}

      {requests.length === 0 && (
        <div className="panel">
          <h2>All clear</h2>
          <p className="note">
            No payments to check. New requests appear here by themselves, and the sidebar badge
            and sound tell you when one arrives.
            {unpaid.length > 0 && ` ${unpaid.length} order(s) are not paid yet, see below.`}
          </p>
        </div>
      )}

      <div className="orders-grid">
        {requests.map((r) => {
          const isUpi = r.paymentMethod === "upi";
          const mins = Math.floor((now - new Date(r.updatedAt)) / 60000);

          return (
            <div className={"order" + (mins >= 5 ? " late" : "")} key={r._id}>
              <div className="order-top">
                <strong>{r.trackingCode}</strong>
                <span>
                  <span className="tag">{isUpi ? "UPI" : "Cash"}</span>{" "}
                  {r.atCounterAt && <span className="tag urgent">AT COUNTER</span>}{" "}
                  {r.urgent && <span className="tag urgent">URGENT</span>}
                </span>
              </div>

              <div>
                <strong>{r.customerName}</strong> <span className="note">{r.phone}</span>
              </div>

              <div className="req-amount">{rupees(r.price)}</div>

              {isUpi ? (
                <div className="order-note">
                  UPI reference: <strong>{r.upiReference}</strong>
                  <br />
                  Look for exactly {rupees(r.price)} in your UPI app with this reference.
                </div>
              ) : (
                <div className="order-note">
                  The customer is at the counter. Take {rupees(r.price)} in cash.
                </div>
              )}

              <div className="note">
                {r.printPages || r.pages} of {r.pages} pages
                {r.pageRange ? ` (${r.pageRange})` : ""} × {r.copies} · {r.size} ·{" "}
                {r.color ? "Color" : "B/W"} · {r.doubleSided ? "Double" : "Single"}-sided
                {r.stapling ? " · Stapling" : ""}
                {r.binding ? " · Binding" : ""}
              </div>
              {r.note && <div className="order-note">📝 {r.note}</div>}

              <div className="note">Waiting {waited(r.updatedAt, now)}</div>

              {rejecting === r._id ? (
                <div className="reject-box">
                  <div className="chips">
                    {QUICK_REASONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={"chip" + (reason === q ? " on" : "")}
                        onClick={() => setReason(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (the customer will see this)"
                    maxLength={200}
                  />
                  <div className="actions">
                    <button
                      type="button"
                      className="small danger"
                      disabled={busy === r._id}
                      onClick={() => sendReject(r)}
                    >
                      Reject order
                    </button>
                    <button
                      type="button"
                      className="small ghost"
                      onClick={() => {
                        setRejecting("");
                        setReason("");
                      }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="actions">
                  {r.filePublicId && (
                    <button className="small ghost" onClick={() => openFile(r._id)}>
                      Preview file
                    </button>
                  )}
                  <button disabled={busy === r._id} onClick={() => confirm(r)}>
                    {isUpi ? "Confirm payment" : "Cash received"}
                  </button>
                  <button
                    className="small ghost"
                    onClick={() => {
                      setRejecting(r._id);
                      setReason(QUICK_REASONS[0]);
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {unpaid.length > 0 && (
        <div className="panel">
          <h2>Not paid yet ({unpaid.length})</h2>
          <p className="note">
            These customers ordered but haven't told the shop they paid. If one is at the counter,
            take their payment here.
          </p>
          {unpaid.map((o) => (
            <div className="unpaid-row" key={o._id}>
              <div>
                <strong>{o.trackingCode}</strong> · {o.customerName}{" "}
                <span className="note">{o.phone}</span>
                <div className="note">
                  {rupees(o.price)} · {o.source}
                  {o.paymentMethod ? ` · chose ${o.paymentMethod}` : ""} · ordered{" "}
                  {waited(o.createdAt, now)} ago
                </div>
              </div>
              <div className="actions">
                <button
                  className="small"
                  disabled={busy === o._id}
                  onClick={() => takePayment(o, "cash")}
                >
                  Cash received
                </button>
                <button
                  className="small ghost"
                  disabled={busy === o._id}
                  onClick={() => takePayment(o, "upi")}
                >
                  UPI received
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="note">
        {queued} confirmed order(s) in the print queue.{" "}
        <Link to="/admin/orders">See all orders</Link>
      </p>
    </>
  );
}