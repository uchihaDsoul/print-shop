import { useEffect, useState } from "react";
import { getPricingAdmin, updatePricing } from "../../adminApi";
import { rupees } from "../../format";

// turn the server data into form fields
const toForm = (d) => ({
  A4bw: String(d.rates.A4.bw),
  A4color: String(d.rates.A4.color),
  A3bw: String(d.rates.A3.bw),
  A3color: String(d.rates.A3.color),
  a3: (d.enabledSizes || []).includes("A3"),
  discount: String(d.doubleSidedDiscountPercent),
  stapling: String(d.extras.stapling),
  binding: String(d.extras.binding),
  urgent: String(d.extras.urgent),
  photoA4bw: String(d.photo.a4.bw),
  photoA4color: String(d.photo.a4.color),
  sizes: Object.fromEntries(
    Object.entries(d.photoSizes).map(([k, s]) => [
      k,
      { enabled: s.enabled, bw: String(s.bw), color: String(s.color) },
    ]),
  ),
  papers: Object.fromEntries(
    Object.entries(d.papers).map(([k, p]) => [
      k,
      { enabled: p.enabled, cost: String(p.cost), driverName: p.driverName || "" },
    ]),
  ),
});

// and back into the shape the server expects
const toPayload = (f) => ({
  enabledSizes: f.a3 ? ["A4", "A3"] : ["A4"],
  rates: {
    A4: { bw: f.A4bw, color: f.A4color },
    A3: { bw: f.A3bw, color: f.A3color },
  },
  doubleSidedDiscountPercent: f.discount,
  extras: { stapling: f.stapling, binding: f.binding, urgent: f.urgent },
  photo: { a4: { bw: f.photoA4bw, color: f.photoA4color } },
  photoSizes: f.sizes,
  papers: f.papers,
});

export default function PricingTab() {
  const [saved, setSaved] = useState(null); // last known server data
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPricingAdmin()
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

  // change one field of one row in the sizes or papers lists
  function setRow(group, key, field, value) {
    setMessage("");
    setForm((p) => ({
      ...p,
      [group]: { ...p[group], [key]: { ...p[group][key], [field]: value } },
    }));
  }

  const dirty = saved && form && JSON.stringify(form) !== JSON.stringify(toForm(saved));

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
        {error ? <p className="error">{error}</p> : <p className="note">Loading...</p>}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1>Pricing</h1>
        <span className="date">
          A4 B/W: {rupees(saved.rates.A4.bw)} · A4 color: {rupees(saved.rates.A4.color)}
        </span>
      </header>

      <form className="card" onSubmit={handleSave}>
        <h3>A4 paper (₹ per page)</h3>
        <div className="row">
          {field("A4bw", "Black and white")}
          {field("A4color", "Color")}
        </div>

        <h3>Paper sizes</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={form.a3}
            onChange={(e) => set("a3", e.target.checked)}
          />
          Offer A3 paper (only if you have an A3 printer)
        </label>

        {form.a3 && (
          <>
            <h3>A3 paper (₹ per page)</h3>
            <div className="row">
              {field("A3bw", "Black and white")}
              {field("A3color", "Color")}
            </div>
          </>
        )}

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

        <h3>Full A4 photo (₹ per sheet)</h3>
        <div className="row">
          {field("photoA4bw", "B/W")}
          {field("photoA4color", "Color")}
        </div>

        <h3>Passport and ID photo sizes (₹ per piece)</h3>
        <p className="note">
          Switch on the sizes you offer. The customer screen still shows only 35 x 45 mm and
          2 x 2 inch until step P3, so keep those two on.
        </p>
        {Object.keys(form.sizes).map((key) => {
          const row = form.sizes[key];
          return (
            <div className="row" key={key}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => setRow("sizes", key, "enabled", e.target.checked)}
                />
                {saved.photoSizes[key].label}
              </label>
              <label>
                B/W
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.bw}
                  onChange={(e) => setRow("sizes", key, "bw", e.target.value)}
                  required
                />
              </label>
              <label>
                Color
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.color}
                  onChange={(e) => setRow("sizes", key, "color", e.target.value)}
                  required
                />
              </label>
            </div>
          );
        })}

        <h3>Photo papers</h3>
        <p className="note">
          Cost per sheet is private (customers never see it). The driver paper name is the exact
          paper name in the Windows printing preferences, which you can fill in after testing.
        </p>
        {Object.keys(form.papers).map((key) => {
          const row = form.papers[key];
          return (
            <div className="row" key={key}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => setRow("papers", key, "enabled", e.target.checked)}
                />
                {saved.papers[key].label}
              </label>
              <label>
                Cost per sheet (₹)
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.cost}
                  onChange={(e) => setRow("papers", key, "cost", e.target.value)}
                  required
                />
              </label>
              <label>
                Driver paper name
                <input
                  value={row.driverName}
                  maxLength={60}
                  onChange={(e) => setRow("papers", key, "driverName", e.target.value)}
                  placeholder="optional"
                />
              </label>
            </div>
          );
        })}

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
          Changing prices doesn't affect orders that already exist. Use 0 for a free extra. A3
          rates stay saved while A3 is switched off. Paper on/off switches take effect on the
          paper cards in step P4.
        </p>
      </form>
    </>
  );
}