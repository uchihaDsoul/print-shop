import { useEffect, useState } from "react";
import { getShopSettings, updateShopSettings } from "../../adminApi";

// numbers are kept as text while typing, and the server checks them
const toForm = (s) => ({
  ...s,
  unpaidExpiryMinutes: String(s.unpaidExpiryMinutes),
  dailyPageLimit: String(s.dailyPageLimit),
  duplexSheetsPerRound: String(s.duplexSheetsPerRound),
  dryingSecondsBW: String(s.dryingSecondsBW),
  dryingSecondsColor: String(s.dryingSecondsColor),
  pairingCodeMinutes: String(s.pairingCodeMinutes),
});

export default function SettingsTab() {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getShopSettings()
      .then((s) => {
        setSaved(s);
        setForm(toForm(s));
      })
      .catch((err) => setError(err.message));
  }, []);

  function set(name, value) {
    setMessage("");
    setForm((p) => ({ ...p, [name]: value }));
  }

  const dirty =
    saved && form && JSON.stringify(form) !== JSON.stringify(toForm(saved));

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const result = await updateShopSettings(form);
      setSaved(result);
      setForm(toForm(result));
      setMessage("Settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function number(name, label, min = 0) {
    return (
      <label>
        {label}
        <input
          type="number"
          min={min}
          step="1"
          value={form[name]}
          onChange={(e) => set(name, e.target.value)}
          required
        />
      </label>
    );
  }

  function check(name, label) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={form[name]}
          onChange={(e) => set(name, e.target.checked)}
        />
        {label}
      </label>
    );
  }

  if (!form) {
    return (
      <>
        <header className="page-head">
          <h1>Settings</h1>
        </header>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p className="note">Loading...</p>
        )}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <form className="card" onSubmit={handleSave}>
        <h3>Guest Page Feature Toggles</h3>
        <p className="note">Use these switches to instantly show or hide features on the public-facing guest order page.</p>
        <div className="row">
          <div className="col">
            <strong>Main Services</strong>
            {check("guestShowPaper", "Paper print")}
            {check("guestShowPhoto", "Photo print")}
          </div>
          <div className="col">
            <strong>Finishing Options</strong>
            {check("guestShowStapling", "Stapling")}
            {check("guestShowBinding", "Spiral binding")}
            {check("guestShowUrgent", "Urgent processing")}
            {check("guestShowDoubleSided", "Double-sided (Assisted)")}
          </div>
          <div className="col">
            <strong>Payment Methods</strong>
            {check("guestShowCash", "Cash at counter")}
            {check("guestShowUPI", "UPI QR code")}
          </div>
        </div>

        <h3>Payments</h3>
        <div className="row">
          <label>
            UPI ID
            <input
              value={form.upiId}
              onChange={(e) => set("upiId", e.target.value)}
              placeholder="yourshop@bank"
              autoComplete="off"
            />
          </label>
          <label>
            Name shown on the UPI payment
            <input
              value={form.upiPayeeName}
              onChange={(e) => set("upiPayeeName", e.target.value)}
              placeholder="My Print Shop"
              maxLength={60}
            />
          </label>
        </div>
        <label>
          Message shown to customers while they wait for confirmation
          <input
            value={form.waitMessage}
            onChange={(e) => set("waitMessage", e.target.value)}
            maxLength={200}
          />
        </label>
        {number(
          "unpaidExpiryMinutes",
          "Cancel unpaid orders after (minutes)",
          5,
        )}
        <p className="note">
          Your UPI ID is shown to customers inside the payment QR, so it isn't a
          secret.
        </p>

        <h3>Printing</h3>
        <div className="row">
          <label>
            When to print
            <select
              value={form.printTiming}
              onChange={(e) => set("printTiming", e.target.value)}
            >
              <option value="auto">
                Right after the manager confirms payment
              </option>
              <option value="manual">
                Only when the manager taps Print now
              </option>
            </select>
          </label>
          <label>
            Marking an order Ready
            <select
              value={form.readyMode}
              onChange={(e) => set("readyMode", e.target.value)}
            >
              <option value="manual">
                The manager taps Ready after checking
              </option>
              <option value="auto">Automatically after printing</option>
            </select>
          </label>
        </div>
        {check(
          "coverSlip",
          "Print a cover slip (order code and name) before each job",
        )}
        {number(
          "dailyPageLimit",
          "Daily page limit per printer (0 = no limit)",
        )}

        <h3>Double-sided (assisted manual flip)</h3>
        <div className="row">
          {number("duplexSheetsPerRound", "Sheets per round", 1)}
          {number("dryingSecondsBW", "Ink drying wait, B/W (seconds)")}
          {number("dryingSecondsColor", "Ink drying wait, color (seconds)")}
        </div>
        <p className="note">
          The double-sided discount is on the Pricing page. Drying times may
          need tuning after real test prints.
        </p>

        <h3>Staff and printers</h3>
        {check(
          "managerCanPausePrinters",
          "Managers can pause printers and print test pages",
        )}
        {check(
          "showVirtualPrinters",
          "Show virtual printers (Print to PDF, XPS)",
        )}
        {number(
          "pairingCodeMinutes",
          "Computer pairing code lifetime (minutes)",
          1,
        )}

        {error && <p className="error">{error}</p>}
        {message && <p className="success-msg">{message}</p>}

        <div className="actions">
          <button type="submit" disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(toForm(saved));
              setError("");
            }}
          >
            Undo changes
          </button>
        </div>
      </form>
    </>
  );
}