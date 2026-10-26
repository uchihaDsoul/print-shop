import { useEffect, useState } from "react";
import { getStats } from "../../adminApi";

export default function ReportsTab() {
  const [stats, setStats] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setStats(await getStats());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const totalAmount = stats.reduce((n, s) => n + s.total, 0);
  const totalPaid = stats.reduce((n, s) => n + s.paidTotal, 0);
  const totalOrders = stats.reduce((n, s) => n + s.orders, 0);

  return (
    <div className="card">
      <h2>Today</h2>
      {error && <p className="error">{error}</p>}
      {stats.length === 0 && !error && <p className="note">No orders yet today.</p>}

      {stats.length > 0 && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">All orders</div>
              <div className="big">₹{totalAmount}</div>
              <div className="sub">
                {totalOrders} orders · ₹{totalPaid} paid · ₹{totalAmount - totalPaid} unpaid
              </div>
            </div>
            {stats.map((s) => (
              <div className="stat" key={s._id}>
                <div className="label">{s._id}</div>
                <div className="big">₹{s.total}</div>
                <div className="sub">
                  {s.orders} orders · ₹{s.paidTotal} paid
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}