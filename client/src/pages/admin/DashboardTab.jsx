import { useEffect, useState } from "react";
import { getStats, listOrders } from "../../adminApi";
import { rupees, initials, shortDate } from "../../format";
import { statusLabel } from "../../statusMeta";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function DashboardTab() {
  const [stats, setStats] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [timeFilter, setTimeFilter] = useState("all"); // "all", "1m", "1y"

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

  const lifetimeRevenue = orders.reduce((n, o) => n + (o.paid ? (o.price || 0) : 0), 0);
  const totalOrderCount = orders.length;

  const count = (...list) => orders.filter((o) => list.includes(o.status)).length;
  const waiting = count("awaiting_payment", "awaiting_confirmation");
  const toPrint = count("queued", "printing", "printed", "print_failed");
  const ready = count("ready");
  const active = waiting + toPrint + ready;

  const recent = orders.slice(0, 5);

  const onlineStat = stats.find((s) => s._id === "online") || { orders: 0, total: 0, paidTotal: 0 };
  const walkinStat = stats.find((s) => s._id === "walkin") || { orders: 0, total: 0, paidTotal: 0 };
  const maxStatTotal = Math.max(onlineStat.total, walkinStat.total, 1);

  // Filter orders based on selected time range
  const now = new Date();
  const filteredOrders = orders.filter((o) => {
    if (!o.createdAt) return false;
    const orderDate = new Date(o.createdAt);
    if (timeFilter === "1m") {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return orderDate >= oneMonthAgo;
    }
    if (timeFilter === "1y") {
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return orderDate >= oneYearAgo;
    }
    return true; // "all"
  });

  // Generate labels & values based on filter selection
  let chartLabels = [];
  let chartValues = [];

  if (timeFilter === "1m") {
    // Group by days or weeks for 1 Month view
    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      dailyMap[key] = 0;
    }
    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      if (dailyMap[key] !== undefined && o.paid) {
        dailyMap[key] += (o.price || 0);
      }
    });
    chartLabels = Object.keys(dailyMap);
    chartValues = Object.values(dailyMap);
  } else {
    // Group by months for 1 Year or All Time
    const monthsCount = timeFilter === "1y" ? 12 : 6;
    const timeBuckets = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('default', { month: 'short', year: timeFilter === "all" ? '2-digit' : undefined });
      timeBuckets.push(key);
    }

    const monthlyRevenue = filteredOrders.reduce((acc, o) => {
      const date = new Date(o.createdAt);
      const monthKey = date.toLocaleString('default', { month: 'short', year: timeFilter === "all" ? '2-digit' : undefined });
      if (!acc[monthKey]) acc[monthKey] = 0;
      if (o.paid) acc[monthKey] += (o.price || 0);
      return acc;
    }, {});

    chartLabels = timeBuckets;
    chartValues = timeBuckets.map(m => monthlyRevenue[m] || 0);
  }

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        fill: true,
        label: 'Revenue (₹)',
        data: chartValues,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#0f172a',
        pointBorderWidth: 2,
        pointRadius: chartLabels.length > 15 ? 3 : 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 13 },
        callbacks: {
          label: (context) => ` Revenue: ₹${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 10 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
    },
  };

  return (
    <div style={{ padding: "4px" }}>
      {/* Dashboard Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0, letterSpacing: "0.5px" }}>ANALYTICS DASHBOARD</h1>
          <span className="note" style={{ fontSize: "12px" }}>Real-time shop operations & revenue metrics</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", padding: "6px 14px", borderRadius: "8px", fontSize: "13px" }}>
          📅 Live Overview · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Top 4 KPI Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div className="card" style={{ margin: 0, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="note" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Lifetime Revenue</span>
          <div style={{ fontSize: "24px", fontWeight: "bold", margin: "8px 0 4px 0", color: "#10b981" }}>{rupees(lifetimeRevenue)}</div>
          <span className="note" style={{ fontSize: "12px", color: "#10b981" }}>▲ Collected from orders</span>
        </div>

        <div className="card" style={{ margin: 0, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="note" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Today's Revenue</span>
          <div style={{ fontSize: "24px", fontWeight: "bold", margin: "8px 0 4px 0" }}>{rupees(todayTotal)}</div>
          <span className="note" style={{ fontSize: "12px" }}>{rupees(todayPaid)} paid today</span>
        </div>

        <div className="card" style={{ margin: 0, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="note" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Print Queue</span>
          <div style={{ fontSize: "24px", fontWeight: "bold", margin: "8px 0 4px 0", color: "#6366f1" }}>{active}</div>
          <span className="note" style={{ fontSize: "12px" }}>{toPrint} ready/queued</span>
        </div>

        <div className="card" style={{ margin: 0, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="note" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Orders Tracked</span>
          <div style={{ fontSize: "24px", fontWeight: "bold", margin: "8px 0 4px 0" }}>{totalOrderCount}</div>
          <span className="note" style={{ fontSize: "12px" }}>{todayOrders} placed today</span>
        </div>
      </div>

      {/* Revenue Trend Graph Panel with Time Filter Buttons */}
      <div className="panel" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ fontSize: "15px", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Revenue Analytics Trend</h3>
          
          {/* Time Filter Buttons */}
          <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "8px" }}>
            <button
              type="button"
              onClick={() => setTimeFilter("1m")}
              style={{
                background: timeFilter === "1m" ? "#10b981" : "transparent",
                color: timeFilter === "1m" ? "#fff" : "#94a3b8",
                border: "none",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              1 Month
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("1y")}
              style={{
                background: timeFilter === "1y" ? "#10b981" : "transparent",
                color: timeFilter === "1y" ? "#fff" : "#94a3b8",
                border: "none",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              1 Year
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("all")}
              style={{
                background: timeFilter === "all" ? "#10b981" : "transparent",
                color: timeFilter === "all" ? "#fff" : "#94a3b8",
                border: "none",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              All Time
            </button>
          </div>
        </div>

        <div style={{ width: "100%", height: "260px" }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Middle Row: Online vs Walk-in Traffic & Recent Transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        
        <div className="panel" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "16px" }}>
          <h3 style={{ fontSize: "15px", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Online vs Walk-in Traffic</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
                <span>Online Orders</span>
                <strong>{rupees(onlineStat.total)} <small className="note">({onlineStat.orders} orders)</small></strong>
              </div>
              <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "6px", height: "10px", overflow: "hidden" }}>
                <div style={{ width: `${(onlineStat.total / maxStatTotal) * 100}%`, background: "#6366f1", height: "100%", borderRadius: "6px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
                <span>Walk-in Counter</span>
                <strong>{rupees(walkinStat.total)} <small className="note">({walkinStat.orders} orders)</small></strong>
              </div>
              <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "6px", height: "10px", overflow: "hidden" }}>
                <div style={{ width: `${(walkinStat.total / maxStatTotal) * 100}%`, background: "#10b981", height: "100%", borderRadius: "6px" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "16px" }}>
          <h3 style={{ fontSize: "15px", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Recent Transactions</h3>
          {recent.length === 0 && <p className="note">No orders yet.</p>}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recent.map((o) => (
              <div className="feed-item" key={o._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="av small-av">{initials(o.customerName)}</span>
                  <div>
                    <strong>{o.customerName}</strong>
                    <div className="note" style={{ fontSize: "11px" }}>{o.printPages || o.pages} pages · {shortDate(o.createdAt)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{rupees(o.price)}</strong>
                  <div><span className={`badge ${o.status}`} style={{ fontSize: "10px", padding: "2px 6px" }}>{statusLabel(o.status)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}