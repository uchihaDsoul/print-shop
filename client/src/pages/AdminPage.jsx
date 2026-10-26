import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { listOrders, updateOrder, deleteOrder, getStats, createWalkin, getFileLink } from "../adminApi";
import { getQuote } from "../api";

const STATUSES = ["pending", "printing", "ready", "collected"];
const blank = { customerName: "", phone: "", pages: 1, pageRange: "", copies: 1, color: false, size: "A4", doubleSided: false };

export default function AdminPage() {
  const { user, logout } = useAuth();
  const isBoss = user.role === "admin" || user.role === "superadmin";

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [price, setPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setOrders(await listOrders(filter ? `?status=${filter}` : ""));
      if (isBoss) setStats(await getStats());
    } catch (err) {
      setError(err.message);
    }
  }

  // load now, then refresh every 30 seconds
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [filter]);

  // live price for the walk-in form
  useEffect(() => {
    let cancelled = false;
    getQuote(form)
      .then((d) => !cancelled && setPrice(d.price))
      .catch(() => !cancelled && setPrice(0));
    return () => { cancelled = true; };
  }, [form.pages, form.pageRange, form.copies, form.color, form.size, form.doubleSided]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  }

  async function addWalkin(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createWalkin(form, file);
      setForm(blank);
      setFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function change(id, data) {
    try {
      await updateOrder(id, data);
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

  async function remove(id) {
    if (!window.confirm("Delete this order permanently?")) return;
    try {
      await deleteOrder(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  // active orders first (oldest first), collected at the bottom
  const sorted = [...orders].sort(
    (a, b) =>
      STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );

  return (
    <>
      <div className="bar">
        <span>{user.name} ({user.role})</span>
        <span>
          {isBoss && <Link to="/admin/users">Users</Link>}{" "}
          <button className="small" onClick={logout}>Log out</button>
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      {isBoss && (
        <div className="card">
          <h2>Today</h2>
          {stats.length === 0 && <p className="note">No orders yet today.</p>}
          <div className="stats">
            {stats.map((s) => (
              <div className="stat" key={s._id}>
                <div className="label">{s._id}</div>
                <div className="big">₹{s.total}</div>
                <div className="sub">{s.orders} orders · ₹{s.paidTotal} paid</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="card" onSubmit={addWalkin}>
        <h2>Add walk-in order</h2>
        <div className="row">
          <label>Name<input name="customerName" value={form.customerName} onChange={handleChange} required /></label>
          <label>Phone<input name="phone" value={form.phone} onChange={handleChange} required pattern="[0-9]{10}" title="10 digits" /></label>
        </div>
        <label>
          File (optional, pages are counted automatically)
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        <div className="row">
          <label>Pages{file && " (auto)"}<input type="number" min="1" name="pages" value={form.pages} onChange={handleChange} disabled={Boolean(file)} /></label>
          <label>Copies<input type="number" min="1" name="copies" value={form.copies} onChange={handleChange} /></label>
          <label>Size<select name="size" value={form.size} onChange={handleChange}><option>A4</option><option>A3</option></select></label>
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" name="color" checked={form.color} onChange={handleChange} />Color</label>
          <label className="check"><input type="checkbox" name="doubleSided" checked={form.doubleSided} onChange={handleChange} />Double-sided</label>
        </div>
        <div className="price">Price: ₹{file ? "calculated on save" : price}</div>
        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Add order"}</button>
      </form>

      <div className="card">
        <h2>Orders</h2>
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        {sorted.length === 0 && <p>No orders.</p>}

        {sorted.map((o) => (
          <div className="order" key={o._id}>
            <div>
              <strong>{o.trackingCode}</strong>{" "}
              <span className={`tag ${o.source}`}>{o.source}</span>{" "}
              <span className={`badge ${o.status}`}>{o.status}</span>
            </div>
            <div>{o.customerName} · {o.phone}</div>
            <div>
              {o.pages} pages × {o.copies} · {o.size} · {o.color ? "Color" : "B/W"} · {o.doubleSided ? "Double" : "Single"}-sided
            </div>
            <div>₹{o.price} · {o.paid ? "Paid" : "Not paid"} · {new Date(o.createdAt).toLocaleString()}</div>
            <div className="actions">
              {o.filePublicId && <button className="small ghost" onClick={() => openFile(o._id)}>Open file</button>}
              <select value={o.status} onChange={(e) => change(o._id, { status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="small" onClick={() => change(o._id, { paid: !o.paid })}>
                {o.paid ? "Mark unpaid" : "Mark paid"}
              </button>
              {isBoss && <button className="small danger" onClick={() => remove(o._id)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}