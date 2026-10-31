// Thresholds from the brief: warn below 150 DPI, the server refuses below 75 DPI
export const WARN_DPI = 150;
export const REFUSE_DPI = 75;

const A4_W = 8.27; // inches
const A4_H = 11.69;

export const PASSPORT_SIZES = {
  "35x45": { label: "35 x 45 mm", wMm: 35, hMm: 45 },
  "51x51": { label: "51 x 51 mm (2 x 2 inch)", wMm: 51, hMm: 51 },
};

// Reads a photo's pixel size in the browser
export function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photo could not be read. Please use a JPG or PNG file."));
    };
    img.src = url;
  });
}

// Full A4 photo. Landscape photos are turned onto the portrait page.
// Example: 4000 x 3000 px, fill, zoom 1 gives about 342 DPI.
export function a4Dpi({ width, height, fit = "fill", zoom = 1 }) {
  let iw = width;
  let ih = height;
  if (iw > ih) [iw, ih] = [ih, iw];
  const inchesPerPixel =
    fit === "fit" ? Math.min(A4_W / iw, A4_H / ih) : Math.max(A4_W / iw, A4_H / ih) * zoom;
  return 1 / inchesPerPixel;
}

// Passport photo cropped to its frame.
// Example: 600 x 800 px at 35 x 45 mm, zoom 1 gives about 435 DPI.
export function passportDpi({ width, height, size, zoom = 1 }) {
  const p = PASSPORT_SIZES[size];
  if (!p) return 0;
  const aspect = p.wMm / p.hMm;
  let cropW = width;
  if (width / aspect > height) cropW = height * aspect;
  return cropW / zoom / (p.wMm / 25.4);
}

// "ok", "soft" (allowed with a warning) or "low" (the server will refuse it)
export function dpiLevel(dpi) {
  if (dpi < REFUSE_DPI) return "low";
  if (dpi < WARN_DPI) return "soft";
  return "ok";
}

// ---------- crop preview (the same rules as cropBox() in server/utils/photo.js) ----------

export const A4_RATIO = 2480 / 3508; // the shape the server crops to

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// The part of the photo that will print. Values are in pixels of the photo you pass in.
export function cropGeometry(w, h, ratio, zoom = 1, x = 0.5, y = 0.5) {
  let bw;
  let bh;
  if (w / h > ratio) {
    bh = h;
    bw = h * ratio;
  } else {
    bw = w;
    bh = w / ratio;
  }
  const z = clamp(zoom, 1, 4);
  bw /= z;
  bh /= z;
  const slackX = w - bw;
  const slackY = h - bh;
  return {
    bw,
    bh,
    slackX,
    slackY,
    left: slackX * clamp(x, 0, 1),
    top: slackY * clamp(y, 0, 1),
  };
}

// When zooming, keep the middle of the visible area where it was
export function zoomKeepCenter(w, h, ratio, oldZoom, newZoom, x, y) {
  const a = cropGeometry(w, h, ratio, oldZoom, x, y);
  const b = cropGeometry(w, h, ratio, newZoom, 0, 0);
  const cx = a.left + a.bw / 2;
  const cy = a.top + a.bh / 2;
  return {
    x: b.slackX > 0.5 ? clamp((cx - b.bw / 2) / b.slackX, 0, 1) : 0.5,
    y: b.slackY > 0.5 ? clamp((cy - b.bh / 2) / b.slackY, 0, 1) : 0.5,
  };
}

// A small copy of the photo for the preview. With rotateLandscape, a landscape photo is
// turned a quarter turn clockwise, exactly as the server does for A4.
export function buildPreview(file, { rotateLandscape = false, maxSide = 1200 } = {}) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const scale = Math.min(1, maxSide / Math.max(nw, nh));
        const dw = Math.max(1, Math.round(nw * scale));
        const dh = Math.max(1, Math.round(nh * scale));
        const turn = rotateLandscape && nw > nh;

        const canvas = document.createElement("canvas");
        canvas.width = turn ? dh : dw;
        canvas.height = turn ? dw : dh;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (turn) {
          ctx.translate(canvas.width, 0);
          ctx.rotate(Math.PI / 2);
        }
        ctx.drawImage(img, 0, 0, dw, dh);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(src);
            if (!blob) return reject(new Error("The preview could not be made."));
            resolve({ url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height });
          },
          "image/jpeg",
          0.85
        );
      } catch {
        URL.revokeObjectURL(src);
        reject(new Error("The preview could not be made."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("This photo could not be read. Please use a JPG or PNG file."));
    };
    img.src = src;
  });
}