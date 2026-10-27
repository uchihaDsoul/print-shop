import { useState, useEffect } from "react";
import { getQuote, placeOrder, countPages } from "../api";

const initialForm = {
  customerName: "", phone: "", pages: 0, pageRange: "", copies: 1,
  color: false, size: "A4", doubleSided: false,
  stapling: false, binding: false, urgent: false, note: "",
};

export default function OrderPage() {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  }
  const toggle = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  async function handleFile(e) {
    const chosen = e.target.files[0];
    setError("");
    setFile(null);
    setForm((p) => ({ ...p, pages: 0 }));
    if (!chosen) return;
    if (chosen.size > 20 * 1024 * 1024) {
      setError("File is too large (max 20 MB)");
      setFileKey((k) => k + 1);
      return;
    }
    setCounting(true);
    try {
      const { pages } = await countPages(chosen);
      setFile(chosen);
      setForm((p) => ({ ...p, pages }));
    } catch (err) {
      setError(err.message);
      setFileKey((k) => k + 1);
    } finally {
      setCounting(false);
    }
  }

  function removeFile() {
    setFile(null);
    setForm((p) => ({ ...p, pages: 0, pageRange: "" }));
    setFileKey((k) => k + 1);
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
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.pages, form.pageRange, form.copies, form.color, form.size, form.doubleSided, form.stapling, form.binding, form.urgent]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setPlaced(await placeOrder(form, file));
      setForm(initialForm);
      setFile(null);
      setFileKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (placed) {
    return (
      <div className="page-narrow">
        <div className="card success">
          <div className="tick">✓</div>
          <h2>Order placed</h2>
          <p className="note">Save this code to track your order:</p>
          <p className="code">{placed.trackingCode}</p>
          <p>Total: <strong>₹{placed.price}</strong> (pay at the shop)</p>
          <button onClick={() => setPlaced(null)}>Place another order</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="page-title">
        <h1>Print your document</h1>
        <p className="muted">Upload a PDF or image, then choose how you want it printed.</p>
      </div>

      <div className="split">
        <div className="main">
          <div className="card">
            <h3>1 · Your details</h3>
            <div className="row">
              <label>Your name
                <input name="customerName" value={form.customerName} onChange={handleChange} required />
              </label>
              <label>Phone number
                <input name="phone" value={form.phone} onChange={handleChange} required inputMode="numeric" pattern="[0-9]{10}" title="Enter a 10-digit phone number" />
              </label>
            </div>
          </div>

          <div className="card">
            <h3>2 · Your file</h3>
            <div className="well dropzone">
              <span className="ico" style={{ width: 68, height: 68 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
                </svg>
              </span>
              <b style={{ fontSize: 18 }}>Choose your file</b>
              <span className="muted" style={{ fontSize: 14 }}>PDF, JPG or PNG · up to 20 MB</span>
              <input key={fileKey} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} required={!file} />
            </div>
            {counting && <p className="note">Reading your file...</p>}
            {file && (
              <div className="glass-s filerow">
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{file.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB · {form.pages} page(s) detected
                  </div>
                </div>
                <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: 13 }}>Ready</span>
                <button type="button" className="small ghost" onClick={removeFile}>Remove</button>
              </div>
            )}
            {file && (
              <label>Pages to print (optional)
                <input name="pageRange" value={form.pageRange} onChange={handleChange} placeholder="e.g. 1-5, 8, 10-12 (blank = all pages)" />
              </label>
            )}
            {rangeError && <p className="error">{rangeError}</p>}
          </div>

          <div className="card">
            <h3>3 · Print options</h3>
            <div className="grid2">
              <label>Copies
                <input type="number" min="1" name="copies" value={form.copies} onChange={handleChange} required />
              </label>
              <label>Paper size
                <select name="size" value={form.size} onChange={handleChange}>
                  <option value="A4">A4</option><option value="A3">A3</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
              <div>
                <span className="note" style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>Colour</span>
                <div className="opts">
                  <span className={`opt ${!form.color ? "on" : ""}`} onClick={() => toggle("color", false)}>Black &amp; white</span>
                  <span className={`opt ${form.color ? "on" : ""}`} onClick={() => toggle("color", true)}>Full colour</span>
                </div>
              </div>
              <div>
                <span className="note" style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>Sides</span>
                <div className="opts">
                  <span className={`opt ${!form.doubleSided ? "on" : ""}`} onClick={() => toggle("doubleSided", false)}>Single</span>
                  <span className={`opt ${form.doubleSided ? "on" : ""}`} onClick={() => toggle("doubleSided", true)}>Double sided</span>
                </div>
              </div>
            </div>
            <label className="check"><input type="checkbox" name="stapling" checked={form.stapling} onChange={handleChange} />Stapling</label>
            <label className="check"><input type="checkbox" name="binding" checked={form.binding} onChange={handleChange} />Spiral binding</label>
            <label className="check"><input type="checkbox" name="urgent" checked={form.urgent} onChange={handleChange} />Urgent (priority printing)</label>
            <label>Instructions for the shop (optional)
              <textarea name="note" rows={3} maxLength={300} value={form.note} onChange={handleChange} placeholder="e.g. staple top-left, use thick paper" />
            </label>
          </div>
        </div>

        <aside className="glass card" aria-label="Order summary">
          <h2>Price summary</h2>
          <div className="well sum">
            <div><span className="muted">File pages</span><b>{form.pages || "–"}</b></div>
            <div><span className="muted">Printing</span><b>{printPages || "–"} page(s)</b></div>
            <div><span className="muted">Copies</span><b>{form.copies}</b></div>
            <div><span className="muted">Paper</span><b>{form.size} · {form.color ? "Colour" : "B/W"}</b></div>
            <div><span className="muted">Sides</span><b>{form.doubleSided ? "Double" : "Single"}</b></div>
          </div>
          <div className="price"><span>Total</span><strong>₹{price}</strong></div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-lg" disabled={loading || counting || !file || Boolean(rangeError)}>
            {loading ? "Placing order..." : "Place order"}
          </button>
          <p className="note">Pay at the counter when you collect. Your file is deleted after pickup.</p>
        </aside>
      </div>
    </form>
  );
}