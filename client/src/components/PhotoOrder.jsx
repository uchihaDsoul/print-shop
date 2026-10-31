import { useEffect, useRef, useState } from "react";
import { getPhotoQuote, placePhotoOrder } from "../api";
import {
  A4_RATIO,
  a4Dpi,
  buildPreview,
  cropGeometry,
  dpiLevel,
  readImageSize,
  REFUSE_DPI,
  WARN_DPI,
  zoomKeepCenter,
} from "../photoMath";
import CropFrame from "./CropFrame";
import PassportOrder from "./PassportOrder";

const MAX_PHOTOS = 10;
const MAX_SHEETS = 60;
const MAX_FILE = 20 * 1024 * 1024;
const MAX_TOTAL = 60 * 1024 * 1024;

let nextId = 1;

const mb = (bytes) => (bytes / 1048576).toFixed(1);

// the photo's size after it is turned upright onto the portrait page
const portrait = (p) =>
  p.width > p.height
    ? { w: p.height, h: p.width }
    : { w: p.width, h: p.height };

const dpiOf = (p) =>
  a4Dpi({ width: p.width, height: p.height, fit: p.fit, zoom: p.zoom });

// share of the photo that Fill mode cuts off
function croppedPercent(p) {
  if (p.fit === "fit") return 0;
  const pr = portrait(p);
  const g = cropGeometry(pr.w, pr.h, A4_RATIO, p.zoom, 0.5, 0.5);
  return Math.round((1 - (g.bw * g.bh) / (pr.w * pr.h)) * 100);
}

const revokeAll = (p) => {
  URL.revokeObjectURL(p.url);
  if (p.preview) URL.revokeObjectURL(p.preview.url);
};

// onPlaced(order) opens the payment popup on the order page
export default function PhotoOrder({ onPlaced }) {
  const [kind, setKind] = useState("a4"); // "a4" or "passport"
  const [details, setDetails] = useState({ customerName: "", phone: "" });
  const [photos, setPhotos] = useState([]);
  const [color, setColor] = useState(true);
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(0);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0); // changing this empties the file input
  const [openId, setOpenId] = useState(null); // which photo's preview is open

  // keeps the latest list so the cleanup below can release the pictures
  const photosRef = useRef([]);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach(revokeAll), []);

  const sheets = photos.reduce((n, p) => n + p.copies, 0);
  const totalBytes = photos.reduce((n, p) => n + p.file.size, 0);

  // live price from the server
  useEffect(() => {
    if (kind !== "a4" || sheets < 1 || sheets > MAX_SHEETS) {
      setPrice(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      getPhotoQuote({ orderType: "photo_a4", sheets, color })
        .then((d) => !cancelled && setPrice(d.price))
        .catch(() => !cancelled && setPrice(0));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, sheets, color]);

  async function addFiles(e) {
    const chosen = Array.from(e.target.files || []);
    setInputKey((k) => k + 1); // so the same file can be picked again
    if (chosen.length === 0) return;

    setError("");
    setAdding(true);

    const problems = [];
    const added = [];
    let total = totalBytes;
    let count = photos.length;

    for (const file of chosen) {
      if (count >= MAX_PHOTOS) {
        problems.push(`You can add up to ${MAX_PHOTOS} photos.`);
        break;
      }
      if (/\.(heic|heif)$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
        problems.push(
          `${file.name}: iPhone HEIC photos aren't supported yet. In Settings, Camera, Formats choose "Most Compatible", or save the photo as JPG.`,
        );
        continue;
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        problems.push(`${file.name}: only JPG and PNG photos are allowed.`);
        continue;
      }
      if (file.size > MAX_FILE) {
        problems.push(`${file.name}: this photo is larger than 20 MB.`);
        continue;
      }
      if (total + file.size > MAX_TOTAL) {
        problems.push(
          `${file.name}: an order can hold up to 60 MB of photos in total.`,
        );
        continue;
      }
      try {
        const size = await readImageSize(file);
        added.push({
          id: nextId++,
          file,
          url: URL.createObjectURL(file),
          width: size.width,
          height: size.height,
          copies: 1,
          fit: "fill",
          zoom: 1,
          x: 0.5,
          y: 0.5,
          preview: null,
        });
        total += file.size;
        count += 1;
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      }
    }

    if (added.length > 0) setPhotos((prev) => [...prev, ...added]);
    if (problems.length > 0) setError(problems.join(" "));
    setAdding(false);
  }

  function updatePhoto(id, patch) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) revokeAll(gone);
      return prev.filter((p) => p.id !== id);
    });
    setOpenId((cur) => (cur === id ? null : cur));
  }

  function setCopies(id, value) {
    const n = Math.round(Number(value));
    updatePhoto(id, {
      copies: Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : 1,
    });
  }

  function changeZoom(p, value) {
    const zoom = Math.min(3, Math.max(1, Number(value)));
    const pr = portrait(p);
    const pos = zoomKeepCenter(pr.w, pr.h, A4_RATIO, p.zoom, zoom, p.x, p.y);
    updatePhoto(p.id, { zoom, ...pos });
  }

  // opens or closes the framing preview (the small picture is made only when it is needed)
  async function toggleEditor(p) {
    if (openId === p.id) {
      setOpenId(null);
      return;
    }
    setOpenId(p.id);
    if (p.preview) return;
    try {
      const preview = await buildPreview(p.file, { rotateLandscape: true });
      setPhotos((prev) => {
        if (!prev.some((x) => x.id === p.id)) {
          URL.revokeObjectURL(preview.url); // the photo was removed while we worked
          return prev;
        }
        return prev.map((x) => (x.id === p.id ? { ...x, preview } : x));
      });
    } catch (err) {
      setError(err.message);
      setOpenId(null);
    }
  }

  const levels = photos.map((p) => dpiLevel(dpiOf(p)));
  const tooSmall = levels.includes("low");
  const tooManySheets = sheets > MAX_SHEETS;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (photos.length === 0) return setError("Please add at least one photo.");
    if (tooSmall)
      return setError(
        "Remove the photos marked 'too small to print', or zoom out.",
      );
    if (tooManySheets)
      return setError(`An order can have at most ${MAX_SHEETS} sheets.`);

    setLoading(true);
    try {
      const order = await placePhotoOrder(
        {
          customerName: details.customerName.trim(),
          phone: details.phone,
          orderType: "photo_a4",
          color,
          note,
          items: photos.map((p) => ({
            copies: p.copies,
            fit: p.fit,
            zoom: p.zoom,
            x: p.x,
            y: p.y,
          })),
        },
        photos.map((p) => p.file),
      );
      onPlaced(order);
      photos.forEach(revokeAll);
      setPhotos([]);
      setOpenId(null);
      setDetails({ customerName: "", phone: "" });
      setNote("");
      setPrice(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>1. Choose the photo type</h3>
      <div className="choice-grid">
        <button
          type="button"
          className={"choice" + (kind === "a4" ? " on" : "")}
          onClick={() => setKind("a4")}
        >
          Full A4 photo
          <small>
            Up to 10 photos, each with its own copies. One A4 sheet per photo.
          </small>
        </button>
        <button
          type="button"
          className={"choice" + (kind === "passport" ? " on" : "")}
          onClick={() => setKind("passport")}
        >
          Passport photos
          <small>One photo cut into 35 x 45 mm or 51 x 51 mm pieces.</small>
        </button>
      </div>

      {kind === "passport" && <PassportOrder onPlaced={onPlaced} />}

      {kind === "a4" && (
        <form className="photo-form" onSubmit={handleSubmit}>
          <h3>2. Your details</h3>
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

          <h3>3. Your photos</h3>
          <label>
            JPG or PNG, up to 10 photos (20 MB each)
            <input
              key={inputKey}
              type="file"
              accept=".jpg,.jpeg,.png"
              multiple
              onChange={addFiles}
              disabled={adding || photos.length >= MAX_PHOTOS}
            />
          </label>
          {adding && <p className="note">Reading your photos...</p>}

          {photos.map((p, i) => {
            const dpi = dpiOf(p);
            const level = levels[i];
            const cropped = croppedPercent(p);
            const pr = portrait(p);
            return (
              <div className="photo-row" key={p.id}>
                <img
                  className="photo-thumb"
                  src={p.url}
                  alt={`Photo ${i + 1}`}
                />
                <div className="photo-info">
                  <strong className="photo-name" title={p.file.name}>
                    {p.file.name}
                  </strong>
                  <span className="note">
                    {p.width} x {p.height} px · {mb(p.file.size)} MB
                  </span>

                  {level === "ok" && (
                    <span className="tag online">Good quality</span>
                  )}
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

                  {level === "low" && (
                    <span className="note">
                      This is below {REFUSE_DPI} DPI at A4 size.{" "}
                      {p.zoom > 1 ? "Zoom out, or " : ""}Choose a larger photo.
                    </span>
                  )}
                  {level === "soft" && (
                    <span className="note">
                      Under {WARN_DPI} DPI at A4 size, so details may look
                      blurry on paper.
                    </span>
                  )}
                  {p.width > p.height && (
                    <span className="note">
                      Landscape photo: it's turned a quarter turn onto the
                      portrait page.
                    </span>
                  )}
                  {p.fit === "fill" && cropped >= 5 && (
                    <span className="note">
                      About {cropped}% of the photo is cropped. Choose "Fit
                      inside" to keep all of it.
                    </span>
                  )}

                  <div className="row">
                    <label>
                      Copies
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={p.copies}
                        onChange={(e) => setCopies(p.id, e.target.value)}
                      />
                    </label>
                    <label>
                      Layout
                      <select
                        value={p.fit}
                        onChange={(e) =>
                          updatePhoto(p.id, { fit: e.target.value })
                        }
                      >
                        <option value="fill">
                          Fill the page (crops edges)
                        </option>
                        <option value="fit">Fit inside (white margins)</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    className="small ghost"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => toggleEditor(p)}
                  >
                    {openId === p.id
                      ? "Hide preview"
                      : p.fit === "fill"
                        ? "Adjust framing"
                        : "Preview"}
                  </button>
                </div>

                <button
                  type="button"
                  className="small ghost"
                  onClick={() => removePhoto(p.id)}
                >
                  Remove
                </button>

                {openId === p.id && (
                  <div className="photo-editor">
                    {!p.preview ? (
                      <p className="note">Preparing the preview...</p>
                    ) : (
                      <>
                        <CropFrame
                          src={p.preview.url}
                          w={p.preview.w}
                          h={p.preview.h}
                          ratio={A4_RATIO}
                          fit={p.fit}
                          zoom={p.zoom}
                          x={p.x}
                          y={p.y}
                          onMove={(pos) => updatePhoto(p.id, pos)}
                          maxWidth={280}
                        />
                        <p className="note">
                          {p.fit === "fit"
                            ? "The whole photo is printed, with white margins."
                            : "The frame is your A4 page. Drag the photo to choose what prints."}
                        </p>

                        {p.fit === "fill" && (
                          <>
                            <label>
                              Zoom ({p.zoom.toFixed(2)}x)
                              <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.05"
                                value={p.zoom}
                                onChange={(e) => changeZoom(p, e.target.value)}
                              />
                            </label>
                            {p.zoom > 1 && (
                              <span className="note">
                                Zooming in makes the photo less sharp. Now about{" "}
                                {Math.round(dpi)} DPI.
                              </span>
                            )}
                            <button
                              type="button"
                              className="small ghost"
                              onClick={() =>
                                updatePhoto(p.id, { zoom: 1, x: 0.5, y: 0.5 })
                              }
                            >
                              Reset framing
                            </button>
                          </>
                        )}
                        <span className="note">
                          Original after turning upright: {pr.w} x {pr.h} px
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {photos.length > 0 && (
            <p className="note">
              {photos.length} photo(s) · <strong>{sheets}</strong> sheet(s) of
              A4 · {mb(totalBytes)} MB
              {tooManySheets && ` (the limit is ${MAX_SHEETS} sheets)`}
            </p>
          )}

          <h3>4. Print options</h3>
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
              placeholder="e.g. Glossy paper if you have it"
            />
          </label>

          <div className="price">
            <span>Estimated price</span>
            <strong>₹{price}</strong>
          </div>

          <p className="note">
            Photo orders are printed in batches when the shop loads photo paper,
            so they can take a little longer than paper prints. Fresh prints
            need a few minutes to dry. Keep them dry and handle them by the
            edges.
          </p>
          <p className="note">
            🔒 Your photos are deleted after you collect your prints.
          </p>
          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            disabled={
              loading ||
              adding ||
              photos.length === 0 ||
              tooSmall ||
              tooManySheets
            }
          >
            {loading ? "Uploading photos..." : "Place order"}
          </button>
        </form>
      )}
    </div>
  );
}
