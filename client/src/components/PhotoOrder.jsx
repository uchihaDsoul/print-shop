import { useEffect, useRef, useState } from "react";
import { getPhotoQuote, placePhotoOrder } from "../api";
import { a4Dpi, dpiLevel, readImageSize, REFUSE_DPI, WARN_DPI } from "../photoMath";

const MAX_PHOTOS = 10;
const MAX_SHEETS = 60;
const MAX_FILE = 20 * 1024 * 1024;
const MAX_TOTAL = 60 * 1024 * 1024;
const PAGE_ASPECT = 8.27 / 11.69; // A4 portrait, width / height

let nextId = 1;

// Share of the photo's edges that Fill mode cuts off (the photo is turned to portrait first)
function cropPercent({ width, height }) {
  const a = Math.min(width, height) / Math.max(width, height);
  const visible = Math.min(a / PAGE_ASPECT, PAGE_ASPECT / a);
  return Math.round((1 - visible) * 100);
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);

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

  // keeps the latest list so the cleanup below can release the thumbnails
  const photosRef = useRef([]);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

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
          `${file.name}: iPhone HEIC photos aren't supported yet. In Settings, Camera, Formats choose "Most Compatible", or save the photo as JPG.`
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
        problems.push(`${file.name}: an order can hold up to 60 MB of photos in total.`);
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
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  function setCopies(id, value) {
    const n = Math.round(Number(value));
    updatePhoto(id, { copies: Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : 1 });
  }

  const levels = photos.map((p) => dpiLevel(a4Dpi({ ...p, zoom: 1 })));
  const tooSmall = levels.includes("low");
  const tooManySheets = sheets > MAX_SHEETS;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (photos.length === 0) return setError("Please add at least one photo.");
    if (tooSmall) return setError("Remove the photos marked 'too small to print', or choose bigger ones.");
    if (tooManySheets) return setError(`An order can have at most ${MAX_SHEETS} sheets.`);

    setLoading(true);
    try {
      const order = await placePhotoOrder(
        {
          customerName: details.customerName.trim(),
          phone: details.phone,
          orderType: "photo_a4",
          color,
          note,
          items: photos.map((p) => ({ copies: p.copies, fit: p.fit, zoom: 1, x: 0.5, y: 0.5 })),
        },
        photos.map((p) => p.file)
      );
      onPlaced(order);
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
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
    <form className="card" onSubmit={handleSubmit}>
      <h3>1. Choose the photo type</h3>
      <div className="choice-grid">
        <button
          type="button"
          className={"choice" + (kind === "a4" ? " on" : "")}
          onClick={() => setKind("a4")}
        >
          Full A4 photo
          <small>Up to 10 photos, each with its own copies. One A4 sheet per photo.</small>
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

      {kind === "passport" && (
        <>
          <p className="note">
            Use a plain, light background with your face straight ahead. The shop prints what you
            upload and can't promise that any office or embassy will accept it.
          </p>
          <p className="note">The passport photo screen arrives in a later step.</p>
        </>
      )}

      {kind === "a4" && (
        <>
          <h3>2. Your details</h3>
          <div className="row">
            <label>
              Your name
              <input
                value={details.customerName}
                onChange={(e) => setDetails((d) => ({ ...d, customerName: e.target.value }))}
                required
              />
            </label>
            <label>
              Phone number
              <input
                value={details.phone}
                onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
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
            const dpi = a4Dpi({ ...p, zoom: 1 });
            const level = levels[i];
            const cropped = cropPercent(p);
            return (
              <div className="photo-row" key={p.id}>
                <img className="photo-thumb" src={p.url} alt={`Photo ${i + 1}`} />
                <div className="photo-info">
                  <strong className="photo-name" title={p.file.name}>
                    {p.file.name}
                  </strong>
                  <span className="note">
                    {p.width} x {p.height} px · {mb(p.file.size)} MB
                  </span>

                  {level === "ok" && <span className="tag online">Good quality</span>}
                  {level === "soft" && (
                    <span className="tag">May look soft (about {Math.round(dpi)} DPI)</span>
                  )}
                  {level === "low" && (
                    <span className="tag urgent">Too small to print (about {Math.round(dpi)} DPI)</span>
                  )}

                  {level === "low" && (
                    <span className="note">
                      This photo is below {REFUSE_DPI} DPI at A4 size. Please choose a larger photo.
                    </span>
                  )}
                  {level === "soft" && (
                    <span className="note">
                      Under {WARN_DPI} DPI at A4 size, so details may look blurry on paper.
                    </span>
                  )}
                  {p.width > p.height && (
                    <span className="note">
                      Landscape photo: it's turned sideways to fill the portrait page.
                    </span>
                  )}
                  {p.fit === "fill" && cropped >= 5 && (
                    <span className="note">
                      About {cropped}% of the edges will be cropped. Choose "Fit inside" to keep the
                      whole photo.
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
                        onChange={(e) => updatePhoto(p.id, { fit: e.target.value })}
                      >
                        <option value="fill">Fill the page (crops edges)</option>
                        <option value="fit">Fit inside (white margins)</option>
                      </select>
                    </label>
                  </div>
                </div>
                <button type="button" className="small ghost" onClick={() => removePhoto(p.id)}>
                  Remove
                </button>
              </div>
            );
          })}

          {photos.length > 0 && (
            <p className="note">
              {photos.length} photo(s) · <strong>{sheets}</strong> sheet(s) of A4 · {mb(totalBytes)} MB
              {tooManySheets && ` (the limit is ${MAX_SHEETS} sheets)`}
            </p>
          )}

          <h3>4. Print options</h3>
          <label className="check">
            <input type="checkbox" checked={color} onChange={(e) => setColor(e.target.checked)} />
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
            Photo orders are printed in batches when the shop loads photo paper, so they can take a
            little longer than paper prints. Fresh prints need a few minutes to dry. Keep them dry
            and handle them by the edges.
          </p>
          <p className="note">🔒 Your photos are deleted after you collect your prints.</p>
          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            disabled={loading || adding || photos.length === 0 || tooSmall || tooManySheets}
          >
            {loading ? "Uploading photos..." : "Place order"}
          </button>
        </>
      )}
    </form>
  );
}