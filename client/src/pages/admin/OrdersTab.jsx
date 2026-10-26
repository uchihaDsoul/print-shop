import { useEffect, useState } from "react";
import { useAuth } from "../../AuthContext";
import { listOrders, updateOrder, deleteOrder, getFileLink } from "../../adminApi";

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
    <div className="card">
      <h2>Orders</h2>

      <div className="row">
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, name or phone"
          />
        </label>
        <label>
          Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {sorted.length === 0 && <p className="note">No orders found.</p>}

      <div className="orders-grid">
        {sorted.map((o) => (
          <div className="order" key={o._id}>
            <div>
              <strong>{o.trackingCode}</strong>{" "}
              <span className={`tag ${o.source}`}>{o.source}</span>{" "}
              <span className={`badge ${o.status}`}>{o.status}</span>
            </div>

            <div>
              {o.customerName} · {o.phone}
            </div>

            <div>
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

            <div>
              ₹{o.price} · {o.paid ? "Paid" : "Not paid"} ·{" "}
              {new Date(o.createdAt).toLocaleString()}
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
    </div>
  );
}