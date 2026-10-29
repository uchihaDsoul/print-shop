import { useEffect, useState } from "react";
import { useAuth } from "../../AuthContext";
import {
  listOrders,
  updateOrder,
  deleteOrder,
  getFileLink,
} from "../../adminApi";
import Icon from "../../components/Icon";
import { rupees, shortDate } from "../../format";
import {
  ALL_STATUSES,
  FILTERS,
  SORT_ORDER,
  statusLabel,
} from "../../statusMeta";

export default function OrdersTab() {
  const { user } = useAuth();
  const isBoss = user.role === "admin" || user.role === "superadmin";

  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setOrders(await listOrders(filter ? `?status=${filter}` : ""));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [filter]);

  async function change(id, data) {
    try {
      await updateOrder(id, data);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function changeStatus(order, value) {
    if (value === "rejected") {
      const reason = window.prompt(
        "Reason for rejecting (the customer will see this):",
      );
      if (reason === null) return;
      change(order._id, { status: value, rejectReason: reason });
      return;
    }
    if (
      value === "cancelled" &&
      !window.confirm("Cancel this order? Its file will be deleted.")
    ) {
      return;
    }
    change(order._id, { status: value });
  }

  async function remove(id) {
    if (!window.confirm("Delete this order permanently?")) return;
    try {
      await deleteOrder(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openFile(id) {
    try {
      const { url } = await getFileLink(id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err.message);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = orders.filter(
    (o) =>
      !q ||
      o.trackingCode.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.phone.includes(q),
  );

  // needs attention first, urgent first, then oldest first
  const sorted = [...visible].sort(
    (a, b) =>
      SORT_ORDER.indexOf(a.status) - SORT_ORDER.indexOf(b.status) ||
      Number(b.urgent) - Number(a.urgent) ||
      new Date(a.createdAt) - new Date(b.createdAt),
  );

  return (
    <>
      <header className="page-head">
        <h1>Orders</h1>
        <span className="date">{sorted.length} shown</span>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name or phone"
          />
        </div>
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={"chip" + (filter === f.value ? " on" : "")}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {sorted.length === 0 && <p className="note">No orders found.</p>}

      <div className="orders-grid">
        {sorted.map((o) => (
          <div className="order" key={o._id}>
            <div className="order-top">
              <strong>{o.trackingCode}</strong>
              <span>
                <span className={`tag ${o.source}`}>{o.source}</span>{" "}
                <span className={`badge ${o.status}`}>
                  {statusLabel(o.status)}
                </span>
              </span>
            </div>

            <div>
              <strong>{o.customerName}</strong>{" "}
              <span className="note">{o.phone}</span>
            </div>

            <div className="note">
              {o.printPages || o.pages} of {o.pages} pages
              {o.pageRange ? ` (${o.pageRange})` : ""} × {o.copies} · {o.size} ·{" "}
              {o.color ? "Color" : "B/W"} ·{" "}
              {o.doubleSided ? "Double" : "Single"}-sided
            </div>

            {(o.stapling || o.binding || o.urgent) && (
              <div>
                {o.urgent && <span className="tag urgent">URGENT</span>}{" "}
                {o.stapling && <span className="tag">Stapling</span>}{" "}
                {o.binding && <span className="tag">Binding</span>}
              </div>
            )}

            {o.note && <div className="order-note">📝 {o.note}</div>}
            {o.status === "rejected" && o.rejectReason && (
              <div className="order-note">Rejected: {o.rejectReason}</div>
            )}
            {o.upiReference && (
              <div className="order-note">
                UPI reference: <strong>{o.upiReference}</strong> · check ₹
                {o.price} in your UPI app
              </div>
            )}
            {o.atCounterAt && !o.paid && (
              <div>
                <span className="tag urgent">AT COUNTER</span>
              </div>
            )}

            <div className="order-total">
              <strong>{rupees(o.price)}</strong>
              <span className="note">
                {o.paid
                  ? `Paid (${o.paymentMethod || "n/a"}${
                      o.paymentConfirmedBy ? ` · ${o.paymentConfirmedBy}` : ""
                    })`
                  : "Not paid"}{" "}
                · {shortDate(o.createdAt)}
              </span>
            </div>

            <div className="actions">
              {o.filePublicId && (
                <button className="small ghost" onClick={() => openFile(o._id)}>
                  Open file
                </button>
              )}

              <select
                value={o.status}
                onChange={(e) => changeStatus(o, e.target.value)}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>

              {o.paid ? (
                <button
                  className="small ghost"
                  onClick={() => change(o._id, { paid: false })}
                >
                  Mark unpaid
                </button>
              ) : (
                <>
                  <button
                    className="small"
                    onClick={() =>
                      change(o._id, { paid: true, paymentMethod: "cash" })
                    }
                  >
                    Cash paid
                  </button>
                  <button
                    className="small"
                    onClick={() =>
                      change(o._id, { paid: true, paymentMethod: "upi" })
                    }
                  >
                    UPI paid
                  </button>
                </>
              )}

              {isBoss && (
                <button className="small danger" onClick={() => remove(o._id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
