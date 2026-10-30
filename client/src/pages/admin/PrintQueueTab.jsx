import { useEffect, useState } from "react";
import { listPrintQueue, setOrderStatus, printNow, getShopSettings } from "../../adminApi";
import { useAuth } from "../../AuthContext";

const BOSS = ["admin", "superadmin"];

function describe(o) {
  const parts = [
    `${o.printPages} page${o.printPages > 1 ? "s" : ""}`,
    `${o.copies} copy`,
    o.color ? "Color" : "B/W",
  ];
  if (o.pageRange) parts.push(`pages ${o.pageRange}`);
  if (o.doubleSided) parts.push("double-sided");
  if (o.size !== "A4") parts.push(o.size);
  if (o.stapling) parts.push("staple");
  if (o.binding) parts.push("binding");
  if (o.urgent) parts.push("URGENT");
  return parts.join(" · ");
}

function Section({ title, hint, orders, render }) {
  if (orders.length === 0) return null;
  return (
    <div>
      <h2 style={{ marginBottom: 0 }}>
        {title} <span className="ph-pill ph-idle">{orders.length}</span>
      </h2>
      {hint && <p className="ph-muted">{hint}</p>}
      {orders.map((o) => (
        <div className="ph-card" key={o._id}>
          <div className="ph-row ph-between">
            <div>
              <strong>{o.customerName}</strong>{" "}
              <span className="ph-muted">#{o.trackingCode}</span>
              <p className="ph-muted">{describe(o)}</p>
              {o.printError && <p className="ph-error">{o.printError}</p>}
              {o.printerName && o.status !== "queued" && (
                <p className="ph-muted">Printer: {o.printerName}</p>
              )}
              {o.note && <p className="ph-muted">Note: {o.note}</p>}
            </div>
            <div className="ph-row">{render(o)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PrintQueueTab() {
  const { user } = useAuth();
  const isBoss = BOSS.includes(user.role);
  const [orders, setOrders] = useState([]);
  const [manualTiming, setManualTiming] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      setOrders(await listPrintQueue());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // only admins may read the settings; managers just don't see the manual-timing hint
    if (!isBoss) return;
    getShopSettings()
      .then((s) => setManualTiming(s.printTiming === "manual"))
      .catch(() => {});
  }, [isBoss]);

  async function run(o, fn) {
    setError("");
    setBusyId(o._id);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const by = (s) => orders.filter((o) => o.status === s);
  const button = (o, label, fn, ghost = false) => (
    <button className={ghost ? "small ghost" : "small"} disabled={busyId === o._id} onClick={() => run(o, fn)}>
      {label}
    </button>
  );

  const empty = orders.length === 0;

  return (
    <div>
      <h1>Print queue</h1>
      <p className="ph-muted">
        Confirmed orders print automatically. After printing, check the paper, then tap Ready.
      </p>
      {error && <p className="ph-error">{error}</p>}
      {empty && <p className="ph-muted">Nothing in the queue.</p>}

      <Section
        title="Print failed"
        hint="Check the printer (paper, ink) and the paper tray. Retry only if nothing came out."
        orders={by("print_failed")}
        render={(o) => button(o, "Retry", () => setOrderStatus(o._id, "queued"))}
      />

      <Section title="Printing now" orders={by("printing")} render={() => <span className="ph-muted">In progress...</span>} />

      <Section
        title="Printed: check the paper"
        orders={by("printed")}
        render={(o) => button(o, "Ready", () => setOrderStatus(o._id, "ready"))}
      />

      <Section
        title="Waiting to print"
        hint={manualTiming ? "Print timing is manual: tap Print now to release an order." : ""}
        orders={by("queued")}
        render={(o) => (
          <>
            {(o.doubleSided || o.size !== "A4") && (
              <span className="ph-pill ph-warn">Held: needs manual handling</span>
            )}
            {manualTiming && !o.printNow && button(o, "Print now", () => printNow(o._id))}
          </>
        )}
      />

      <Section
        title="Ready for pickup"
        orders={by("ready")}
        render={(o) => button(o, "Collected", () => setOrderStatus(o._id, "collected"))}
      />
    </div>
  );
}