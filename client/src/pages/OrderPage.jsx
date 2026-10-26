import { useState, useEffect } from "react";
import { getQuote, placeOrder, countPages } from "../api";
import PriceList from "../components/PriceList";
import ShopInfo from "../components/ShopInfo";

const initialForm = {
  customerName: "",
  phone: "",
  pages: 0,
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

export default function OrderPage() {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleFile(e) {
    const chosen = e.target.files[0];
    setError("");
    setFile(null);
    setForm((prev) => ({ ...prev, pages: 0 }));
    if (!chosen) return;

    if (chosen.size > 20 * 1024 * 1024) {
      setError("File is too large (max 20 MB)");
      e.target.value = "";
      return;
    }

    setCounting(true);
    try {
      const { pages } = await countPages(chosen);
      setFile(chosen);
      setForm((prev) => ({ ...prev, pages }));
    } catch (err) {
      setError(err.message);
      e.target.value = "";
    } finally {
      setCounting(false);
    }
  }

  // Ask the server for the price whenever print options change
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getQuote(form)
        .then((data) => {
          if (cancelled) return;
          setPrice(data.price);
          setPrintPages(data.printPages || 0);
          setRangeError(data.error || "");
        })
        .catch(() => !cancelled && setPrice(0));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    }, [form.pages, form.pageRange, form.copies, form.color, form.size, form.doubleSided, form.stapling, form.binding, form.urgent]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const order = await placeOrder(form, file);
      setPlaced(order);
      setForm(initialForm);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (placed) {
    return (
      <div className="card success">
        <div className="tick">✓</div>
        <h2>Order placed!</h2>
        <p className="note">Save this code to track your order:</p>
        <p className="code">{placed.trackingCode}</p>
        <p>Total: <strong>₹{placed.price}</strong> (pay at the shop)</p>
        <button onClick={() => setPlaced(null)}>Place another order</button>
      </div>
    );
  }

  return (
    <>
      <div className="hero">
        <h2>Print in minutes</h2>
        <p>Upload your file, pick your options, collect it at the shop.</p>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h3>1. Your details</h3>
        <div className="row">
          <label>
            Your name
            <input name="customerName" value={form.customerName} onChange={handleChange} required />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              title="Enter a 10-digit phone number"
            />
          </label>
        </div>

        <h3>2. Your file</h3>
        <label>
          PDF, JPG or PNG (max 20 MB)
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} required />
        </label>
        {counting && <p className="note">Reading your file...</p>}
        {file && <p className="note">✓ {file.name}: <strong>{form.pages}</strong> page(s) found</p>}

        {file && (
          <label>
            Pages to print (optional)
            <input
              name="pageRange"
              value={form.pageRange}
              onChange={handleChange}
              placeholder="e.g. 1-5, 8, 10-12 (blank = all pages)"
            />
          </label>
        )}
        {rangeError && <p className="error">{rangeError}</p>}
        {file && !rangeError && (
          <p className="note">Printing <strong>{printPages}</strong> of {form.pages} page(s)</p>
        )}

        <h3>3. Print options</h3>
        <div className="row">
          <label>
            Copies
            <input type="number" min="1" name="copies" value={form.copies} onChange={handleChange} required />
          </label>
          <label>
            Paper size
            <select name="size" value={form.size} onChange={handleChange}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </label>
        </div>

        <label className="check">
          <input type="checkbox" name="color" checked={form.color} onChange={handleChange} />
          Color print
        </label>
        <label className="check">
          <input type="checkbox" name="doubleSided" checked={form.doubleSided} onChange={handleChange} />
          Double-sided
        </label>

                <h3>4. Finishing</h3>
        <label className="check">
          <input type="checkbox" name="stapling" checked={form.stapling} onChange={handleChange} />
          Stapling
        </label>
        <label className="check">
          <input type="checkbox" name="binding" checked={form.binding} onChange={handleChange} />
          Spiral binding
        </label>
        <label className="check">
          <input type="checkbox" name="urgent" checked={form.urgent} onChange={handleChange} />
          Urgent (priority printing)
        </label>
        <label>
          Note for the shop (optional)
          <textarea
            name="note"
            value={form.note}
            onChange={handleChange}
            maxLength={300}
            rows={3}
            placeholder="e.g. Staple top-left, use thick paper"
          />
        </label>

        <div className="price">
          <span>Estimated price</span>
          <strong>₹{price}</strong>
        </div>

        <p className="note">🔒 Your file is deleted after you collect your prints.</p>
        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading || counting || !file || Boolean(rangeError)}>
          {loading ? "Placing order..." : "Place order"}
        </button>
      </form>
      <PriceList />
      <ShopInfo />
    </>
  );
}