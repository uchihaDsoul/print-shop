import { useEffect, useState } from "react";
import { getStats, listOrders } from "../../adminApi";
import { rupees, initials, shortDate } from "../../format";
import { statusLabel } from "../../statusMeta";

export default function DashboardTab() {
  const [stats, setStats] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [s, o] = await Promise.all([getStats(), listOrders()]);
      setStats(s);
      setOrders(o);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const todayTotal = stats.reduce((n, s) => n + s.total, 0);
  const todayPaid = stats.reduce((n, s) => n + s.paidTotal, 0);
  const todayOrders = stats.reduce((n, s) => n + s.orders, 0);

  const count = (...list) => orders.filter((o) => list.includes(o.status)).length;
  const waiting = count("awaiting_payment", "awaiting_confirmation");
  const toPrint = count("queued", "printing", "printed", "print_failed");
  const ready = count("ready");
  const active = waiting + toPrint + ready;

  const recent = orders.slice(0, 5); // the server sends newest first

  return (
    <>
      <header className="page-head">
        <h1>Overview</h1>
        <span className="date">
          {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="grid-3">
        <div className="tile">
          <span className="t-label">Today's revenue</span>
          <span className="t-big">{rupees(todayTotal)}</span>
          <span className="t-sub ok">
            {rupees(todayPaid)} paid · {todayOrders} orders
          </span>
        </div>
        <div className="tile">
          <span className="t-label">Active orders</span>
          <span className="t-big">{active}</span>
          <span className="t-sub warn">
            {waiting} awaiting payment · {toPrint} to print
          </span>
        </div>
        <div className="tile">
          <span className="t-label">Ready for pickup</span>
          <span className="t-big pri">{ready}</span>
          <span className="t-sub muted">Waiting for customers</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>Online vs walk-in today</h2>
          {stats.length === 0 && <p className="note">No orders yet today.</p>}
          {stats.map((s) => (
            <div className="price-line" key={s._id}>
              <span style={{ textTransform: "capitalize" }}>{s._id}</span>
              <strong>
                {rupees(s.total)} <small>{s.orders} orders</small>
              </strong>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Recent activity</h2>
          {recent.length === 0 && <p className="note">No orders yet.</p>}
          {recent.map((o) => (
            <div className="feed-item" key={o._id}>
              <span className="av small-av">{initials(o.customerName)}</span>
              <div>
                <strong>
                  {o.customerName}{" "}
                  <span className={`badge ${o.status}`}>{statusLabel(o.status)}</span>
                </strong>
                <span className="note">
                  {o.printPages || o.pages} pages · {o.size} · {rupees(o.price)} ·{" "}
                  {shortDate(o.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}