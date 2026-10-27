import { useEffect, useState } from "react";
import { useAuth } from "../../AuthContext";
import { listOrders, updateOrder, deleteOrder, getFileLink } from "../../adminApi";
import Icon from "../../components/Icon";
import { rupees, shortDate } from "../../format";

const STATUSES = ["pending", "printing", "ready", "collected"];

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
      o.phone.includes(q)
  );

  // active first, urgent first, then oldest first
  const sorted = [...visible].sort(
    (a, b) =>
      STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
      Number(b.urgent) - Number(a.urgent) ||
      new Date(a.createdAt) - new Date(b.createdAt)
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
          {["", ...STATUSES].map((s) => (
            <button
              key={s || "all"}
              className={"chip" + (filter === s ? " on" : "")}
              onClick={() => setFilter(s)}
            >
              {s || "all"}
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
                <span className={`badge ${o.status}`}>{o.status}</span>
              </span>
            </div>

            <div>
              <strong>{o.customerName}</strong> <span className="note">{o.phone}</span>
            </div>

            <div className="note">
              {o.printPages || o.pages} of {o.pages} pages
              {o.pageRange ? ` (${o.pageRange})` : ""} × {o.copies} · {o.size} ·{" "}
              {o.color ? "Color" : "B/W"} · {o.doubleSided ? "Double" : "Single"}-sided
            </div>

            {(o.stapling || o.binding || o.urgent) && (
              <div>
                {o.urgent && <span className="tag urgent">URGENT</span>}{" "}
                {o.stapling && <span className="tag">Stapling</span>}{" "}
                {o.binding && <span className="tag">Binding</span>}
              </div>
            )}

            {o.note && <div className="order-note">📝 {o.note}</div>}

            <div className="order-total">
              <strong>{rupees(o.price)}</strong>
              <span className="note">
                {o.paid ? "Paid" : "Not paid"} · {shortDate(o.createdAt)}
              </span>
            </div>

            <div className="actions">
              {o.filePublicId && (
                <button className="small ghost" onClick={() => openFile(o._id)}>
                  Open file
                </button>
              )}
              <select value={o.status} onChange={(e) => change(o._id, { status: e.target.value })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className="small" onClick={() => change(o._id, { paid: !o.paid })}>
                {o.paid ? "Mark unpaid" : "Mark paid"}
              </button>
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