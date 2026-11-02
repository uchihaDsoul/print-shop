import { useEffect, useRef, useState } from "react";
import { getPhotoQuote, placePhotoOrder, getRates } from "../api";
import { createPhotoWalkin } from "../adminApi";
import {
  buildPreview,
  dpiLevel,
  passportDpi,
  PASSPORT_SIZES,
  readImageSize,
  REFUSE_DPI,
  WARN_DPI,
  zoomKeepCenter,
} from "../photoMath";
import CropFrame from "./CropFrame";
import SheetGrid from "./SheetGrid";

const MAX_PIECES = 40;
const MAX_FILE = 20 * 1024 * 1024;

const GUIDE = {
  "35x45": { rx: 33, ry: 36, cy: 47 },
  "35x35": { rx: 33, ry: 33, cy: 47 },
  "51x51": { rx: 22, ry: 30, cy: 47 },
  "25x35": { rx: 30, ry: 36, cy: 47 },
};

const SIZE_HELP = {
  "35x45": "A common passport and ID size.",
  "35x35": "Used for some ID and OCI applications.",
  "51x51": "2 x 2 inch, used for some visas and passports.",
  "25x35": "PAN card size.",
};

const mb = (bytes) => (bytes / 1048576).toFixed(1);

export default function PassportOrder({ onPlaced, walkin = false }) {
  const [details, setDetails] = useState({ customerName: "", phone: "" });
  const [size, setSize] = useState("35x45");
  const [pic, setPic] = useState(null); 
  const [view, setView] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const [pieces, setPieces] = useState("6");
  const [color, setColor] = useState(true);
  
  // Advanced Controls
  const [marginMode, setMarginMode] = useState("safe"); // 'safe' or 'zero'
  const [removeBg, setRemoveBg] = useState(false); // Cloudinary AI hook

  const [note, setNote] = useState("");
  const [guide, setGuide] = useState(true);
  const [price, setPrice] = useState(0);
  const [cap, setCap] = useState({ a4: 0, p46: 0 });
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0); 
  const [payment, setPayment] = useState("");

  const [enabledSizes, setEnabledSizes] = useState(null); 
  const [enabledPapers, setEnabledPapers] = useState([{ key: "a4" }]);

  const picRef = useRef(null);
  picRef.current = pic;
  useEffect(() => () => {
    if (picRef.current) URL.revokeObjectURL(picRef.current.preview.url);
  }, []);

  useEffect(() => {
    getRates()
      .then((d) => {
        const list = d.photoSizes ? Object.entries(d.photoSizes).filter(([, s]) => s.enabled).map(([key]) => key) : ["35x45", "51x51"];
        setEnabledSizes(list);
        if (d.papers) {
          const paps = Object.entries(d.papers).filter(([, p]) => p.enabled).map(([key]) => ({ key }));
          setEnabledPapers(paps.length ? paps : [{ key: "a4" }]);
        }
      })
      .catch(() => {
        setEnabledSizes(["35x45", "51x51"]);
        setEnabledPapers([{ key: "a4" }]);
      });
  }, []);

  useEffect(() => {
    if (enabledSizes && enabledSizes.length > 0 && !enabledSizes.includes(size)) {
      chooseSize(enabledSizes[0]);
    }
  }, [enabledSizes]); // eslint-disable-line react-hooks/exhaustive-deps

  const spec = PASSPORT_SIZES[size];
  const ratio = spec.wMm / spec.hMm;
  const count = Number(pieces);
  const piecesOk = Number.isInteger(count) && count >= 1 && count <= MAX_PIECES;

  useEffect(() => {
    if (!piecesOk) {
      setPrice(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      getPhotoQuote({
        orderType: "passport",
        pieces: count,
        passportSize: size,
        color,
        marginMode,
      })
        .then((d) => {
          if (cancelled) return;
          setPrice(d.price || 0);
          setCap({ a4: d.perSheetA4 || 0, p46: d.perSheet4x6 || 0 });
        })
        .catch(() => !cancelled && setPrice(0));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [piecesOk, count, size, color, marginMode]);

  async function pickFile(e) {
    const chosen = e.target.files && e.target.files[0];
    setInputKey((k) => k + 1); 
    if (!chosen) return;

    setError("");
    if (/\.(heic|heif)$/i.test(chosen.name) || /hei[cf]/i.test(chosen.type)) {
      return setError("iPhone HEIC photos aren't supported yet. In Settings, Camera, Formats choose 'Most Compatible', or save the photo as JPG.");
    }
    if (!["image/jpeg", "image/png"].includes(chosen.type)) {
      return setError("Only JPG and PNG photos are allowed.");
    }
    if (chosen.size > MAX_FILE) return setError("This photo is larger than 20 MB.");

    setReading(true);
    try {
      const dims = await readImageSize(chosen);
      const preview = await buildPreview(chosen, { rotateLandscape: false });
      setPic((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview.url);
        return { file: chosen, width: dims.width, height: dims.height, preview };
      });
      setView({ zoom: 1, x: 0.5, y: 0.5 });
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
    }
  }

  function removePic() {
    if (pic) URL.revokeObjectURL(pic.preview.url);
    setPic(null);
    setView({ zoom: 1, x: 0.5, y: 0.5 });
  }

  function chooseSize(next) {
    setSize(next);
    setView({ zoom: 1, x: 0.5, y: 0.5 }); 
  }

  function changeZoom(value) {
    const zoom = Math.min(3, Math.max(1, Number(value)));
    const pos = zoomKeepCenter(pic.preview.w, pic.preview.h, ratio, view.zoom, zoom, view.x, view.y);
    setView({ zoom, ...pos });
  }

  const dpi = pic ? passportDpi({ width: pic.width, height: pic.height, size, zoom: view.zoom }) : 0;
  const level = pic ? dpiLevel(dpi) : "ok";
  const g = GUIDE[size];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!pic) return setError("Please add your photo.");
    if (level === "low") return setError("This photo is too small. Zoom out, or choose a larger photo.");
    if (!piecesOk) return setError(`Choose from 1 to ${MAX_PIECES} passport photos.`);
    if (walkin && !payment) return setError("Choose how the customer paid.");

    setLoading(true);
    try {
      const send = walkin ? createPhotoWalkin : placePhotoOrder;
      const order = await send(
        {
          customerName: details.customerName.trim(),
          phone: details.phone,
          orderType: "passport",
          passportSize: size,
          pieces: count,
          color,
          note,
          marginMode,
          removeBg,
          ...(walkin ? { payment } : {}),
          zoom: view.zoom,
          x: view.x,
          y: view.y,
        },
        [pic.file]
      );
      onPlaced(order);
      removePic();
      setDetails({ customerName: "", phone: "" });
      setPieces("6");
      setNote("");
      setPayment("");
      setPrice(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="photo-form" onSubmit={handleSubmit}>
      <p className="note">
        Use a plain, light background with your face straight ahead. The shop
        prints what you upload and can't promise that any office or embassy will
        accept it.
      </p>

      <h3>2. Photo size</h3>
      {enabledSizes === null && <p className="note">Loading sizes...</p>}
      <div className="choice-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {enabledSizes &&
          Object.entries(PASSPORT_SIZES)
            .filter(([key]) => enabledSizes.includes(key))
            .map(([key, s]) => (
              <button
                key={key}
                type="button"
                className={"choice" + (size === key ? " on" : "")}
                onClick={() => chooseSize(key)}
              >
                {s.label}
                <small>{SIZE_HELP[key] || ""}</small>
              </button>
            ))}
      </div>

      <h3>3. Your details</h3>
      <div className="row">
        <label>
          Your name
          <input value={details.customerName} onChange={(e) => setDetails((d) => ({ ...d, customerName: e.target.value }))} required />
        </label>
        <label>
          Phone number
          <input value={details.phone} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} required inputMode="numeric" pattern="[0-9]{10}" title="Enter a 10-digit phone number" />
        </label>
      </div>

      <h3>4. Your photo</h3>
      {!pic && (
        <label>
          One JPG or PNG photo (20 MB at most)
          <input key={inputKey} type="file" accept=".jpg,.jpeg,.png" onChange={pickFile} disabled={reading} />
        </label>
      )}
      {reading && <p className="note">Reading your photo...</p>}

      {pic && (
        <div className="photo-editor glass-panel" style={{ padding: "1.5rem", borderRadius: "1rem" }}>
          
          <div className="crop-wrap" style={{ maxWidth: 260, margin: "0 auto 1.5rem auto", position: "relative" }}>
            <CropFrame src={pic.preview.url} w={pic.preview.w} h={pic.preview.h} ratio={ratio} zoom={view.zoom} x={view.x} y={view.y} onMove={(pos) => setView((v) => ({ ...v, ...pos }))} maxWidth={260} />
            {guide && (
              <svg className="crop-guide" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                <ellipse cx="50" cy={g.cy} rx={g.rx} ry={g.ry} fill="none" stroke="rgba(244, 63, 94, 0.7)" strokeWidth="0.5" strokeDasharray="2" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="0.2" strokeDasharray="1" />
              </svg>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px", margin: "0 auto" }}>
            
            <label className="check glass-card" style={{ padding: "0.75rem", borderRadius: "0.5rem" }}>
              <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
              <span>Show Biometric Face Guide</span>
            </label>

            <div className="glass-card" style={{ padding: "1rem", borderRadius: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
                <span>Zoom Scale</span>
                <strong>{view.zoom.toFixed(2)}x</strong>
              </div>
              <input type="range" min="1" max="3" step="0.05" value={view.zoom} onChange={(e) => changeZoom(e.target.value)} style={{ width: "100%" }} />
            </div>

            <div className="glass-card" style={{ padding: "1rem", borderRadius: "0.5rem" }}>
              <strong style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Print Layout Margin</strong>
              <div className="choice-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button type="button" className={"choice" + (marginMode === "safe" ? " on" : "")} onClick={() => setMarginMode("safe")} style={{ padding: "0.5rem", fontSize: "0.8rem" }}>Safe Cut Gap (5mm)</button>
                <button type="button" className={"choice" + (marginMode === "zero" ? " on" : "")} onClick={() => setMarginMode("zero")} style={{ padding: "0.5rem", fontSize: "0.8rem" }}>Zero Margin</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "1rem", borderRadius: "0.5rem" }}>
              <label className="check" style={{ marginBottom: "0.25rem" }}>
                <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
                <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>AI Background Removal</span>
              </label>
              <span className="note" style={{ display: "block", fontSize: "0.75rem", marginTop: "0.25rem" }}>*Only effective if your photo is clear and well-lit.</span>
            </div>

            {level === "ok" && <span className="tag online" style={{ alignSelf: "center" }}>Good quality</span>}
            {level === "soft" && <span className="tag" style={{ alignSelf: "center" }}>May look soft (about {Math.round(dpi)} DPI)</span>}
            {level === "low" && <span className="tag urgent" style={{ alignSelf: "center" }}>Too small to print (about {Math.round(dpi)} DPI)</span>}

            <div className="actions" style={{ justifyContent: "center", marginTop: "0.5rem" }}>
              <button type="button" className="small ghost" onClick={() => setView({ zoom: 1, x: 0.5, y: 0.5 })}>Reset framing</button>
              <button type="button" className="small ghost" onClick={removePic}>Choose different photo</button>
            </div>
          </div>
        </div>
      )}

      <h3>5. How many photos?</h3>
      <div className="row">
        <label>
          Number of passport photos (1 to {MAX_PIECES})
          <input type="number" min="1" max={MAX_PIECES} value={pieces} onChange={(e) => setPieces(e.target.value)} required />
        </label>
      </div>
      <div className="chips">
        {[4, 6, 8, 12].map((n) => (
          <button key={n} type="button" className={"chip" + (count === n ? " on" : "")} onClick={() => setPieces(String(n))}>{n}</button>
        ))}
        {cap.a4 > 0 && cap.a4 <= MAX_PIECES && (
          <button type="button" className={"chip" + (count === cap.a4 ? " on" : "")} onClick={() => setPieces(String(cap.a4))}>Full A4 sheet ({cap.a4})</button>
        )}
      </div>

      {piecesOk && (
        <SheetGrid
          pieces={count}
          photoMm={{ w: spec.wMm, h: spec.hMm }}
          preview={pic ? pic.preview : null}
          view={view}
          ratio={ratio}
          enabledPapers={enabledPapers}
          onFill={(n) => setPieces(String(Math.min(MAX_PIECES, n)))}
        />
      )}

      {!piecesOk && pieces !== "" && (
        <p className="error">Choose a whole number from 1 to {MAX_PIECES}.</p>
      )}

      <h3>6. Print options</h3>
      <label className="check">
        <input type="checkbox" checked={color} onChange={(e) => setColor(e.target.checked)} />
        Color print (untick for black and white)
      </label>
      <label>
        Note for the shop (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} placeholder="e.g. Cut the photos for me" />
      </label>

      {walkin && (
        <label>
          Payment
          <select value={payment} onChange={(e) => setPayment(e.target.value)} required>
            <option value="">Choose...</option>
            <option value="cash">Cash received</option>
            <option value="upi">UPI received</option>
            <option value="none">Not paid yet</option>
          </select>
        </label>
      )}

      <div className="price">
        <span>Estimated price</span>
        <strong>₹{price}</strong>
      </div>

      <p className="note">
        Passport photos are printed in batches when the shop loads photo paper,
        so they can take a little longer than paper prints. Fresh prints need a
        few minutes to dry. Keep them dry and handle them by the edges.
      </p>
      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading || reading || !pic || level === "low" || !piecesOk}>
        {loading ? "Uploading photo..." : "Place order"}
      </button>
    </form>
  );
}