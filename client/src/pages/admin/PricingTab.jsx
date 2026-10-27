import { useEffect, useState } from "react";
import { getRates } from "../../api";
import { updatePricing } from "../../adminApi";
import { rupees } from "../../format";

// turn the server data into flat text fields for the form
const toForm = (d) => ({
  A4bw: String(d.rates.A4.bw),
  A4color: String(d.rates.A4.color),
  A3bw: String(d.rates.A3.bw),
  A3color: String(d.rates.A3.color),
  discount: String(d.doubleSidedDiscountPercent),
  stapling: String(d.extras.stapling),
  binding: String(d.extras.binding),
  urgent: String(d.extras.urgent),
});

// and back into the shape the server expects
const toPayload = (f) => ({
  rates: {
    A4: { bw: f.A4bw, color: f.A4color },
    A3: { bw: f.A3bw, color: f.A3color },
  },
  doubleSidedDiscountPercent: f.discount,
  extras: { stapling: f.stapling, binding: f.binding, urgent: f.urgent },
});

export default function PricingTab() {
  const [saved, setSaved] = useState(null); // last known server data
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRates()
      .then((d) => {
        setSaved(d);
        setForm(toForm(d));
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
      const result = await updatePricing(toPayload(form));
      setSaved(result);
      setForm(toForm(result));
      setMessage("Prices updated. New orders use these prices straight away.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function field(name, label) {
    return (
      <label>
        {label}
        <input
          type="number"
          min="0"
          step="0.5"
          value={form[name]}
          onChange={(e) => set(name, e.target.value)}
          required
        />
      </label>
    );
  }

  if (!form) {
    return (
      <>
        <header className="page-head">
          <h1>Pricing</h1>
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
        <h1>Pricing</h1>
        <span className="date">
          A4 B/W: {rupees(saved.rates.A4.bw)} · A4 color:{" "}
          {rupees(saved.rates.A4.color)}
        </span>
      </header>

      <form className="card" onSubmit={handleSave}>
        <h3>A4 paper (₹ per page)</h3>
        <div className="row">
          {field("A4bw", "Black and white")}
          {field("A4color", "Color")}
        </div>

        <h3>A3 paper (₹ per page)</h3>
        <div className="row">
          {field("A3bw", "Black and white")}
          {field("A3color", "Color")}
        </div>

        <h3>Discount</h3>
        <div className="row">
          <label>
            Double-sided discount (%)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.discount}
              onChange={(e) => set("discount", e.target.value)}
              required
            />
          </label>
        </div>

        <h3>Extras (₹)</h3>
        <div className="row">
          {field("stapling", "Stapling, per copy")}
          {field("binding", "Spiral binding, per copy")}
          {field("urgent", "Urgent, per order")}
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success-msg">{message}</p>}

        <div className="actions">
          <button type="submit" disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save prices"}
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

        <p className="note">
          Changing prices doesn't affect orders that already exist. Use 0 for a
          free extra.
        </p>
      </form>
    </>
  );
}
