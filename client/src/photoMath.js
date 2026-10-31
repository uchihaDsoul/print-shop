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