import { useEffect, useState } from "react";
import { createWalkin } from "../../adminApi";
import { getQuote, countPages } from "../../api";

const blank = {
  customerName: "",
  phone: "",
  pages: 1,
  pageRange: "",
  copies: 1,
  color: false,
  size: "A4",
  doubleSided: false,
  stapling: false,
  binding: false,
  urgent: false,
  note: "",
};

export default function WalkinTab() {
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); // changing this resets the file input
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleFile(e) {
    const chosen = e.target.files[0] || null;
    setError("");
    if (!chosen) {
      setFile(null);
      return;
    }
    setCounting(true);
    try {
      const { pages } = await countPages(chosen);
      setFile(chosen);
      setForm((p) => ({ ...p, pages }));
    } catch (err) {
      setError(err.message);
      setFile(null);
      setFileKey((k) => k + 1);
    } finally {
      setCounting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getQuote(form)
        .then((d) => {
          if (cancelled) return;
          setPrice(d.price);
          setPrintPages(d.printPages || 0);
          setRangeError(d.error || "");
        })
        .catch(() => !cancelled && setPrice(0));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    form.pages,
    form.pageRange,
    form.copies,
    form.color,
    form.size,
    form.doubleSided,
    form.stapling,
    form.binding,
    form.urgent,
  ]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setDone(null);
    setSaving(true);
    try {
      const order = await createWalkin(form, file);
      setDone(order);
      setForm(blank);
      setFile(null);
      setFileKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Add walk-in order</h2>

      {done && (
        <p className="success-msg">
          ✓ Order added. Code <strong>{done.trackingCode}</strong> · ₹{done.price}
        </p>
      )}

      <div className="row">
        <label>
          Name
          <input name="customerName" value={form.customerName} onChange={handleChange} required />
        </label>
        <label>
          Phone
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            inputMode="numeric"
            pattern="[0-9]{10}"
            title="10 digits"
          />
        </label>
      </div>

      <label>
        File (optional, pages are counted automatically)
        <input
          key={fileKey}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFile}
        />
      </label>
      {counting && <p className="note">Reading file...</p>}
      {file && (
        <p className="note">
          ✓ {file.name}: <strong>{form.pages}</strong> page(s) found
        </p>
      )}

      <div className="row">
        <label>
          Pages{file && " (auto)"}
          <input
            type="number"
            min="1"
            name="pages"
            value={form.pages}
            onChange={handleChange}
            disabled={Boolean(file)}
          />
        </label>
        <label>
          Copies
          <input type="number" min="1" name="copies" value={form.copies} onChange={handleChange} />
        </label>
        <label>
          Size
          <select name="size" value={form.size} onChange={handleChange}>
            <option>A4</option>
            <option>A3</option>
          </select>
        </label>
      </div>

      <label>
        Pages to print (optional)
        <input
          name="pageRange"
          value={form.pageRange}
          onChange={handleChange}
          placeholder="e.g. 1-5, 8 (blank = all)"
        />
      </label>
      {rangeError && <p className="error">{rangeError}</p>}
      {!rangeError && printPages > 0 && (
        <p className="note">
          Printing <strong>{printPages}</strong> of {form.pages} page(s)
        </p>
      )}

      <div className="row">
        <label className="check">
          <input type="checkbox" name="color" checked={form.color} onChange={handleChange} />
          Color
        </label>
        <label className="check">
          <input type="checkbox" name="doubleSided" checked={form.doubleSided} onChange={handleChange} />
          Double-sided
        </label>
      </div>

      <div className="row">
        <label className="check">
          <input type="checkbox" name="stapling" checked={form.stapling} onChange={handleChange} />
          Stapling
        </label>
        <label className="check">
          <input type="checkbox" name="binding" checked={form.binding} onChange={handleChange} />
          Binding
        </label>
        <label className="check">
          <input type="checkbox" name="urgent" checked={form.urgent} onChange={handleChange} />
          Urgent
        </label>
      </div>

      <label>
        Note (optional)
        <input name="note" value={form.note} onChange={handleChange} maxLength={300} />
      </label>

      <div className="price">
        <span>Price</span>
        <strong>₹{price}</strong>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={saving || counting || Boolean(rangeError)}>
        {saving ? "Saving..." : "Add order"}
      </button>
    </form>
  );
}