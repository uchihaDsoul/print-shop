import { useEffect, useState } from "react";
import { useAuth } from "../../AuthContext";
import { listPrinters, printerAction, updatePrinter } from "../../adminApi";

const BOSS = ["admin", "superadmin"];

const STATUS_LABEL = {
  detected: "Detected",
  waiting_approval: "Waiting for approval",
  active: "Active",
  paused: "Paused",
  ignored: "Hidden",
  missing: "Missing",
};
const STATUS_CLASS = {
  detected: "warn",
  waiting_approval: "warn",
  active: "good",
  paused: "idle",
  ignored: "idle",
  missing: "bad",
};
const CONNECTION_LABEL = { usb: "USB", wifi: "Wi-Fi", virtual: "Virtual", unknown: "Unknown" };

export default function PrintersTab() {
  const { user } = useAuth();
  const isBoss = BOSS.includes(user.role);
  const myId = user._id || user.id;

  const [printers, setPrinters] = useState([]);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);

  async function load() {
    try {
      setPrinters(await listPrinters());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function act(p, action) {
    setError("");
    setWorkingId(p._id);
    try {
      await printerAction(p._id, action);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkingId(null);
    }
  }

  async function makeDefault(p) {
    setError("");
    setWorkingId(p._id);
    try {
      await updatePrinter(p._id, { isDefault: true });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkingId(null);
    }
  }

  const detected = printers.filter((p) => p.status === "detected").length;
  const waiting = printers.filter((p) => p.status === "waiting_approval").length;

  function buttons(p) {
    const b = [];
    const busy = workingId === p._id;
    const btn = (label, action, ghost = true) => (
      <button
        key={action}
        className={ghost ? "small ghost" : "small"}
        disabled={busy}
        onClick={() => act(p, action)}
      >
        {label}
      </button>
    );

    if (p.status === "detected") {
      if (isBoss) {
        b.push(btn(p.isVirtual ? "Enable as test printer" : "Enable", "enable", false));
        b.push(btn("Ignore", "ignore"));
      } else {
        b.push(btn("Request approval", "request", false));
      }
    }
    if (p.status === "waiting_approval") {
      if (isBoss) {
        const mine = p.requestedBy && String(p.requestedBy) === String(myId);
        b.push(
          <button
            key="approve"
            className="small"
            disabled={busy || mine}
            title={mine ? "You cannot approve your own request" : ""}
            onClick={() => act(p, "approve")}
          >
            Approve
          </button>
        );
        b.push(btn("Reject", "reject"));
      } else {
        b.push(
          <span key="w" className="ph-muted">
            Waiting for an admin
          </span>
        );
      }
    }
    if (p.status === "active") {
      b.push(btn("Pause", "pause"));
      if (isBoss && !p.isDefault) {
        b.push(
          <button key="def" className="small ghost" disabled={busy} onClick={() => makeDefault(p)}>
            Make default
          </button>
        );
      }
      if (isBoss) b.push(btn("Ignore", "ignore"));
    }
    if (p.status === "paused") {
      b.push(btn("Resume", "resume", false));
    }
    if (p.status === "ignored" && isBoss) {
      b.push(btn(p.isVirtual ? "Enable as test printer" : "Enable", "enable", false));
    }
    if (p.status === "missing" && isBoss) {
      b.push(btn("Ignore", "ignore"));
    }
    return b;
  }

  return (
    <div>
      <h1>Printers</h1>
      <p className="ph-muted">
        Printers are reported by the shop PC. Only Active printers receive jobs.
      </p>

      {detected > 0 && (
        <div className="ph-banner">
          {detected} new printer{detected > 1 ? "s" : ""} detected.{" "}
          {isBoss
            ? "Enable the ones you want to use, and ignore the rest."
            : "Ask for approval for the one you want to use."}
        </div>
      )}
      {isBoss && waiting > 0 && (
        <div className="ph-banner">
          {waiting} printer{waiting > 1 ? "s are" : " is"} waiting for your approval.
        </div>
      )}

      {error && <p className="ph-error">{error}</p>}

      <div className="ph-list">
        {printers.length === 0 && (
          <p className="ph-muted">
            No printers yet. Pair a computer on the Computers page and it will report its printers.
          </p>
        )}
        {printers.map((p) => (
          <div className="ph-card" key={p._id}>
            <div className="ph-row ph-between">
              <div>
                <strong>{p.displayName}</strong>
                <span className={`ph-pill ph-${STATUS_CLASS[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                {p.isDefault && <span className="ph-pill ph-good">Default</span>}
                {p.testPrinter && <span className="ph-pill ph-idle">Test printer</span>}
              </div>
              <div className="ph-row">{buttons(p)}</div>
            </div>
            <p className="ph-muted">
              {CONNECTION_LABEL[p.connection]} · {p.computerName || "Unknown computer"} (
              {p.computerOnline ? "online" : "offline"}) · {p.supportsColor ? "Color" : "B/W only"}
              {p.dailyLimit ? ` · ${p.dailyPages}/${p.dailyLimit} pages today` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}