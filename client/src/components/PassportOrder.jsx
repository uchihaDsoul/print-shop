import { useEffect, useRef, useState } from "react";
import { getPhotoQuote, placePhotoOrder } from "../api";
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

// A rough face guide, in percent of the frame. It is a help, not an official check.
const GUIDE = {
  "35x45": { rx: 33, ry: 36, cy: 47 },
  "51x51": { rx: 22, ry: 30, cy: 47 },
};

const mb = (bytes) => (bytes / 1048576).toFixed(1);

// onPlaced(order) opens the payment popup on the order page
export default function PassportOrder({ onPlaced, walkin = false }) {
  const [details, setDetails] = useState({ customerName: "", phone: "" });
  const [size, setSize] = useState("35x45");
  const [pic, setPic] = useState(null); // { file, width, height, preview: { url, w, h } }
  const [view, setView] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const [pieces, setPieces] = useState("6");
  const [color, setColor] = useState(true);
  const [note, setNote] = useState("");
  const [guide, setGuide] = useState(true);
  const [price, setPrice] = useState(0);
  const [cap, setCap] = useState({ a4: 0, p46: 0 });
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0); // changing this empties the file input
  const [payment, setPayment] = useState(""); // staff walk-in only

  // keeps the latest picture so the cleanup below can release it
  const picRef = useRef(null);
  picRef.current = pic;
  useEffect(
    () => () => {
      if (picRef.current) URL.revokeObjectURL(picRef.current.preview.url);
    },
    [],
  );

  const spec = PASSPORT_SIZES[size];
  const ratio = spec.wMm / spec.hMm;

  const count = Number(pieces);
  const piecesOk = Number.isInteger(count) && count >= 1 && count <= MAX_PIECES;

  // live price and layout from the server
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
  }, [piecesOk, count, size, color]);

  async function pickFile(e) {
    const chosen = e.target.files && e.target.files[0];
    setInputKey((k) => k + 1); // so the same file can be picked again
    if (!chosen) return;

    setError("");
    if (/\.(heic|heif)$/i.test(chosen.name) || /hei[cf]/i.test(chosen.type)) {
      return setError(
        'iPhone HEIC photos aren\'t supported yet. In Settings, Camera, Formats choose "Most Compatible", or save the photo as JPG.',
      );
    }
    if (!["image/jpeg", "image/png"].includes(chosen.type)) {
      return setError("Only JPG and PNG photos are allowed.");
    }
    if (chosen.size > MAX_FILE)
      return setError("This photo is larger than 20 MB.");

    setReading(true);
    try {
      const dims = await readImageSize(chosen);
      const preview = await buildPreview(chosen, { rotateLandscape: false });
      setPic((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview.url);
        return {
          file: chosen,
          width: dims.width,
          height: dims.height,
          preview,
        };
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
    setView({ zoom: 1, x: 0.5, y: 0.5 }); // the frame changes shape, so start again
  }

  function changeZoom(value) {
    const zoom = Math.min(3, Math.max(1, Number(value)));
    const pos = zoomKeepCenter(
      pic.preview.w,
      pic.preview.h,
      ratio,
      view.zoom,
      zoom,
      view.x,
      view.y,
    );
    setView({ zoom, ...pos });
  }

  const dpi = pic
    ? passportDpi({
        width: pic.width,
        height: pic.height,
        size,
        zoom: view.zoom,
      })
    : 0;
  const level = pic ? dpiLevel(dpi) : "ok";
  const sheetsNeeded = cap.a4 && piecesOk ? Math.ceil(count / cap.a4) : 0;
  const g = GUIDE[size];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!pic) return setError("Please add your photo.");
    if (level === "low")
      return setError(
        "This photo is too small. Zoom out, or choose a larger photo.",
      );
    if (!piecesOk)
      return setError(`Choose from 1 to ${MAX_PIECES} passport photos.`);

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
          ...(walkin ? { payment } : {}),
          zoom: view.zoom,
          x: view.x,
          y: view.y,
        },
        [pic.file],
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
      <div className="choice-grid">
        {Object.entries(PASSPORT_SIZES).map(([key, s]) => (
          <button
            key={key}
            type="button"
            className={"choice" + (size === key ? " on" : "")}
            onClick={() => chooseSize(key)}
          >
            {s.label}
            <small>
              {key === "35x45"
                ? "A common passport and ID size."
                : "2 x 2 inch, used for some visas and passports."}
            </small>
          </button>
        ))}
      </div>

      <h3>3. Your details</h3>
      <div className="row">
        <label>
          Your name
          <input
            value={details.customerName}
            onChange={(e) =>
              setDetails((d) => ({ ...d, customerName: e.target.value }))
            }
            required
          />
        </label>
        <label>
          Phone number
          <input
            value={details.phone}
            onChange={(e) =>
              setDetails((d) => ({ ...d, phone: e.target.value }))
            }
            required
            inputMode="numeric"
            pattern="[0-9]{10}"
            title="Enter a 10-digit phone number"
          />
        </label>
      </div>

      <h3>4. Your photo</h3>
      {!pic && (
        <label>
          One JPG or PNG photo (20 MB at most)
          <input
            key={inputKey}
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={pickFile}
            disabled={reading}
          />
        </label>
      )}
      {reading && <p className="note">Reading your photo...</p>}

      {pic && (
        <div className="photo-editor" style={{ borderTop: 0, paddingTop: 0 }}>
          <div className="crop-wrap" style={{ maxWidth: 260 }}>
            <CropFrame
              src={pic.preview.url}
              w={pic.preview.w}
              h={pic.preview.h}
              ratio={ratio}
              zoom={view.zoom}
              x={view.x}
              y={view.y}
              onMove={(pos) => setView((v) => ({ ...v, ...pos }))}
              maxWidth={260}
            />
            {guide && (
              <svg
                className="crop-guide"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <ellipse cx="50" cy={g.cy} rx={g.rx} ry={g.ry} />
                <line x1="50" y1="0" x2="50" y2="100" />
              </svg>
            )}
          </div>

          <p className="note">
            The frame is one {spec.label} photo. Drag your photo so the face
            sits in the middle.
          </p>

          <label className="check" style={{ width: "100%", maxWidth: 320 }}>
            <input
              type="checkbox"
              checked={guide}
              onChange={(e) => setGuide(e.target.checked)}
            />
            Show a rough face guide
          </label>
          <span className="note">
            The guide is only a help. It isn't an official check of any
            country's rules.
          </span>

          <label>
            Zoom ({view.zoom.toFixed(2)}x)
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={view.zoom}
              onChange={(e) => changeZoom(e.target.value)}
            />
          </label>

          {level === "ok" && <span className="tag online">Good quality</span>}
          {level === "soft" && (
            <span className="tag">
              May look soft (about {Math.round(dpi)} DPI)
            </span>
          )}
          {level === "low" && (
            <span className="tag urgent">
              Too small to print (about {Math.round(dpi)} DPI)
            </span>
          )}
          {level === "soft" && (
            <span className="note">
              Under {WARN_DPI} DPI at this size, so details may look blurry.
            </span>
          )}
          {level === "low" && (
            <span className="note">
              Below {REFUSE_DPI} DPI at this size.{" "}
              {view.zoom > 1 ? "Zoom out, or " : ""}Choose a larger photo.
            </span>
          )}

          <span className="note">
            {pic.file.name} · {pic.width} x {pic.height} px ·{" "}
            {mb(pic.file.size)} MB
          </span>

          <div className="actions">
            <button
              type="button"
              className="small ghost"
              onClick={() => setView({ zoom: 1, x: 0.5, y: 0.5 })}
            >
              Reset framing
            </button>
            <button type="button" className="small ghost" onClick={removePic}>
              Choose a different photo
            </button>
          </div>
        </div>
      )}

      <h3>5. How many photos?</h3>
      <div className="row">
        <label>
          Number of passport photos (1 to {MAX_PIECES})
          <input
            type="number"
            min="1"
            max={MAX_PIECES}
            value={pieces}
            onChange={(e) => setPieces(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="chips">
        {[4, 6, 8, 12].map((n) => (
          <button
            key={n}
            type="button"
            className={"chip" + (count === n ? " on" : "")}
            onClick={() => setPieces(String(n))}
          >
            {n}
          </button>
        ))}
        {cap.a4 > 0 && cap.a4 <= MAX_PIECES && (
          <button
            type="button"
            className={"chip" + (count === cap.a4 ? " on" : "")}
            onClick={() => setPieces(String(cap.a4))}
          >
            Full A4 sheet ({cap.a4})
          </button>
        )}
      </div>
      
      {piecesOk && (
        <SheetGrid
          pieces={count}
          photoMm={{ w: spec.wMm, h: spec.hMm }}
          preview={pic ? pic.preview : null}
          view={view}
          ratio={ratio}
          onFill={(n) => setPieces(String(Math.min(MAX_PIECES, n)))}
        />
      )}

      {!piecesOk && pieces !== "" && (
        <p className="error">Choose a whole number from 1 to {MAX_PIECES}.</p>
      )}

      <h3>6. Print options</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={color}
          onChange={(e) => setColor(e.target.checked)}
        />
        Color print (untick for black and white)
      </label>
      <label>
        Note for the shop (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="e.g. Cut the photos for me"
        />
      </label>

      {walkin && (
        <label>
          Payment
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            required
          >
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
      <p className="note">
        🔒 Your photo is deleted after you collect your prints.
      </p>
      {error && <p className="error">{error}</p>}

      <button
        type="submit"
        disabled={loading || reading || !pic || level === "low" || !piecesOk}
      >
        {loading ? "Uploading photo..." : "Place order"}
      </button>
    </form>
  );
}
