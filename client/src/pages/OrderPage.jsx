import { useState, useEffect } from "react";
import { getQuote, placeOrder } from "../api";

const initialForm = {
  customerName: "",
  phone: "",
  fileName: "",
  pages: 1,
  copies: 1,
  color: false,
  size: "A4",
  doubleSided: false,
};

export default function OrderPage() {
  const [form, setForm] = useState(initialForm);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  // One handler for all inputs
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  // Ask the server for the price whenever print options change
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getQuote(form)
        .then((data) => !cancelled && setPrice(data.price))
        .catch(() => !cancelled && setPrice(0));
    }, 300); // wait 300ms after typing stops

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.pages, form.copies, form.color, form.size, form.doubleSided]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const order = await placeOrder(form);
      setPlaced(order);
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (placed) {
    return (
      <div className="card success">
        <h2>Order placed!</h2>
        <p>Your tracking code:</p>
        <p className="code">{placed.trackingCode}</p>
        <p>Total: ₹{placed.price}</p>
        <p>Save this code to check your order status.</p>
        <button onClick={() => setPlaced(null)}>Place another order</button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>New print order</h2>

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

      <label>
        File name (file upload coming soon)
        <input name="fileName" value={form.fileName} onChange={handleChange} />
      </label>

      <div className="row">
        <label>
          Pages
          <input type="number" min="1" name="pages" value={form.pages} onChange={handleChange} required />
        </label>
        <label>
          Copies
          <input type="number" min="1" name="copies" value={form.copies} onChange={handleChange} required />
        </label>
      </div>

      <label>
        Paper size
        <select name="size" value={form.size} onChange={handleChange}>
          <option value="A4">A4</option>
          <option value="A3">A3</option>
        </select>
      </label>

      <label className="check">
        <input type="checkbox" name="color" checked={form.color} onChange={handleChange} />
        Color print
      </label>

      <label className="check">
        <input type="checkbox" name="doubleSided" checked={form.doubleSided} onChange={handleChange} />
        Double-sided
      </label>

      <div className="price">Estimated price: ₹{price}</div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? "Placing order..." : "Place order"}
      </button>
    </form>
  );
}