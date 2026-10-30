import { useState, useEffect } from "react";
import { getQuote, placeOrder, countPages, trackOrder } from "../api";
import PriceList from "../components/PriceList";
import ShopInfo from "../components/ShopInfo";
import PaymentPanel from "../components/PaymentPanel";
import Modal from "../components/Modal";
import useRates from "../useRates";
import { statusLabel } from "../statusMeta";

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

const HEADLINE = {
  awaiting_confirmation: "Sent to the shop",
  queued: "Payment confirmed",
  printing: "Printing now",
  printed: "Printed, being checked",
  print_failed: "Printing problem, the shop is fixing it",
  ready: "Ready for pickup",
  collected: "Collected, thank you",
  rejected: "Payment not accepted",
  cancelled: "Order cancelled",
};

export default function OrderPage() {
  const rates = useRates();
  const sizes = rates?.enabledSizes || ["A4"];

  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); // changing this empties the file input
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null); // the order that was just created
  const [showPay, setShowPay] = useState(false); // is the payment popup open?

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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

  // ask the server for the price whenever the print options change
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

  // after payment is sent, follow the order's status so the screen updates by itself
  useEffect(() => {
    if (!placed) return;
    if (["collected", "rejected", "cancelled"].includes(placed.status)) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      trackOrder(placed.trackingCode)
        .then(setPlaced)
        .catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, [placed?.trackingCode, placed?.status]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const order = await placeOrder(form, file);
      setPlaced(order);
      try {
        localStorage.setItem("lastTrack", order.trackingCode);
      } catch {
        /* storage may be blocked, which is fine */
      }
      setShowPay(true); // open the payment popup
      setForm(initialForm);
      setFile(null);
      setFileKey((k) => k + 1);
      setPrice(0);
      setPrintPages(0);
      setRangeError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    setShowPay(false);
    // finished orders don't need the banner any more
    if (
      placed &&
      ["collected", "rejected", "cancelled"].includes(placed.status)
    ) {
      setPlaced(null);
    }
  }

  const paying = placed?.status === "awaiting_payment";

  return (
    <>
      <div className="hero">
        <h2>Print in minutes</h2>
        <p>Upload your file, pick your options, collect it at the shop.</p>
      </div>

      {/* shown when the popup is closed but an order is still open */}
      {placed && !showPay && (
        <div className="card pending-order">
          <div>
            <strong>Order {placed.trackingCode}</strong>
            <div className="note">
              {paying
                ? "Waiting for your payment"
                : HEADLINE[placed.status] || statusLabel(placed.status)}
            </div>
          </div>
          <div className="actions">
            <button
              type="button"
              className="small"
              onClick={() => setShowPay(true)}
            >
              {paying ? "Pay now" : "View"}
            </button>
            {!paying && (
              <button
                type="button"
                className="small ghost"
                onClick={() => setPlaced(null)}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <h3>1. Your details</h3>
        <div className="row">
          <label>
            Your name
            <input
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              required
            />
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
          <input
            key={fileKey}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFile}
            required
          />
        </label>
        {counting && <p className="note">Reading your file...</p>}
        {file && (
          <p className="note">
            ✓ {file.name}: <strong>{form.pages}</strong> page(s) found
          </p>
        )}

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
          <p className="note">
            Printing <strong>{printPages}</strong> of {form.pages} page(s)
          </p>
        )}

        <h3>3. Print options</h3>
        <div className="row">
          <label>
            Copies
            <input
              type="number"
              min="1"
              name="copies"
              value={form.copies}
              onChange={handleChange}
              required
            />
          </label>
          {sizes.length > 1 && (
            <label>
              Paper size
              <select name="size" value={form.size} onChange={handleChange}>
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className="check">
          <input
            type="checkbox"
            name="color"
            checked={form.color}
            onChange={handleChange}
          />
          Color print
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="doubleSided"
            checked={form.doubleSided}
            onChange={handleChange}
          />
          Double-sided
        </label>

        <h3>4. Finishing</h3>
        <label className="check">
          <input
            type="checkbox"
            name="stapling"
            checked={form.stapling}
            onChange={handleChange}
          />
          Stapling
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="binding"
            checked={form.binding}
            onChange={handleChange}
          />
          Spiral binding
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="urgent"
            checked={form.urgent}
            onChange={handleChange}
          />
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

        <p className="note">
          🔒 Your file is deleted after you collect your prints.
        </p>
        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          disabled={loading || counting || !file || Boolean(rangeError)}
        >
          {loading ? "Placing order..." : "Place order"}
        </button>
      </form>

      <PriceList />
      <ShopInfo />

      {/* payment popup */}
      <Modal
        open={Boolean(placed) && showPay}
        onClose={closeModal}
        title="Payment"
      >
        {placed && (
          <div className="modal-body">
            {paying ? (
              <>
                <span className="step-label">Almost done</span>
                <h2>Choose how to pay</h2>
                <p>
                  Total to pay: <strong>₹{placed.price}</strong>
                </p>
              </>
            ) : (
              <>
                {["rejected", "cancelled"].includes(placed.status) ? (
                  <div className="tick bad">✕</div>
                ) : (
                  <div className="tick">✓</div>
                )}
                <h2>{HEADLINE[placed.status] || statusLabel(placed.status)}</h2>
              </>
            )}

            <p className="note">Your tracking code:</p>
            <p className="code">{placed.trackingCode}</p>

            {placed.status === "rejected" && placed.rejectReason && (
              <p className="error">{placed.rejectReason}</p>
            )}

            <PaymentPanel order={placed} onUpdate={setPlaced} />

            {paying ? (
              <p className="note">
                Your order is saved. If you close this window, tap{" "}
                <strong>Pay now</strong> on the page, or pay later from Track
                order with this code.
              </p>
            ) : (
              <button type="button" className="ghost" onClick={closeModal}>
                Done
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
