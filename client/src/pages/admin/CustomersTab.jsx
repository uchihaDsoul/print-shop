import { useEffect, useMemo, useState } from "react";
import { listOrders } from "../../adminApi";
import Icon from "../../components/Icon";
import { rupees, initials } from "../../format";

export default function CustomersTab() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listOrders()
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

  const customers = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const c = map.get(o.phone) || {
        phone: o.phone,
        name: o.customerName,
        orders: 0,
        spend: 0,
        last: o.createdAt,
      };
      c.orders += 1;
      c.spend += o.price;
      if (new Date(o.createdAt) >= new Date(c.last)) {
        c.last = o.createdAt;
        c.name = o.customerName;
      }
      map.set(o.phone, c);
    }
    return [...map.values()].sort((a, b) => new Date(b.last) - new Date(a.last));
  }, [orders]);

  const q = search.trim().toLowerCase();
  const visible = customers.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
  );

  const regulars = customers.filter((c) => c.orders >= 5).length;
  const returning = customers.filter((c) => c.orders >= 2 && c.orders < 5).length;

  const kind = (n) =>
    n >= 5 ? ["Regular", "ready"] : n >= 2 ? ["Returning", "printing"] : ["New", "pending"];

  return (
    <>
      <header className="page-head">
        <h1>Customers</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="grid-3">
        <div className="tile">
          <span className="t-label">All customers</span>
          <span className="t-big">{customers.length}</span>
        </div>
        <div className="tile">
          <span className="t-label">Returning (2 to 4 orders)</span>
          <span className="t-big">{returning}</span>
        </div>
        <div className="tile">
          <span className="t-label">Regulars (5+ orders)</span>
          <span className="t-big pri">{regulars}</span>
        </div>
      </section>

      <div className="search">
        <Icon name="search" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone"
        />
      </div>

      <section className="panel">
        <div className="trow th cust">
          <span>Customer</span>
          <span>Type</span>
          <span>Orders</span>
          <span>Total billed</span>
          <span>Last order</span>
        </div>

        {visible.length === 0 && <p className="note">No customers found.</p>}

        {visible.map((c) => {
          const [label, cls] = kind(c.orders);
          return (
            <div className="trow cust" key={c.phone}>
              <span className="who-cell">
                <span className="av">{initials(c.name)}</span>
                <span>
                  <strong>{c.name}</strong>
                  <small className="note">{c.phone}</small>
                </span>
              </span>
              <span className={`badge ${cls}`}>{label}</span>
              <strong>{c.orders}</strong>
              <strong>{rupees(c.spend)}</strong>
              <span className="note">{new Date(c.last).toLocaleDateString("en-IN")}</span>
            </div>
          );
        })}
      </section>
    </>
  );
}