const sharp = require("sharp");
const { PDFDocument, rgb } = require("pdf-lib");

const LIMIT = { limitInputPixels: 100000000 }; // refuse absurdly large images
const MIN_DPI = 75; // below this we refuse the photo
const WARN_DPI = 150; // below this we warn
const MAX_PDF_BYTES = 9.5 * 1024 * 1024;
const MM = 72 / 25.4; // PDF points per millimetre

const A4_PX = { w: 2480, h: 3508 }; // A4 at 300 DPI
const A4_IN = { w: 8.27, h: 11.69 };
const A4_PT = { w: 595.28, h: 841.89 };

const PASSPORT = { "35x45": { w: 35, h: 45 }, "51x51": { w: 51, h: 51 } };
const PAPERS = { a4: { w: 210, h: 297 }, "4x6": { w: 101.6, h: 152.4 } };
const GAP = 3; // mm between passport photos
const MARGIN = 5; // mm paper margin

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Reads a JPG or PNG, applies its camera rotation, and returns the pixels
async function loadOriented(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, LIMIT).metadata();
  } catch {
    throw new Error("Could not read this photo. It may be damaged.");
  }
  if (!["jpeg", "png"].includes(meta.format))
    throw new Error("Only JPG and PNG photos are allowed");

  let out;
  try {
    out = await sharp(buffer, LIMIT)
      .rotate()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new Error("Could not read this photo. It may be damaged.");
  }
  if (out.info.width < 50 || out.info.height < 50)
    throw new Error("This photo is too small");
  return { data: out.data, w: out.info.width, h: out.info.height };
}

// The part of the photo that will be printed, for a given target shape, zoom and position
function cropBox(w, h, ratio, zoom, x, y) {
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
  const left = Math.round((w - bw) * clamp(x, 0, 1));
  const top = Math.round((h - bh) * clamp(y, 0, 1));
  return {
    left,
    top,
    width: Math.max(1, Math.min(Math.round(bw), w - left)),
    height: Math.max(1, Math.min(Math.round(bh), h - top)),
  };
}

// ---------- Full A4 photos ----------

// item = { copies, fit: "fill" | "fit", zoom, x, y }
async function prepareA4Photo(buffer, item, index = 0) {
  const base = await loadOriented(buffer);
  let { data, w, h } = base;
  if (w > h) {
    data = await sharp(data).rotate(90).toBuffer(); // landscape photos go sideways onto the portrait page
    [w, h] = [h, w];
  }
  let dpi;
  if (item.fit === "fit") {
    dpi = Math.max(w / A4_IN.w, h / A4_IN.h);
  } else {
    dpi =
      cropBox(w, h, A4_PX.w / A4_PX.h, item.zoom, item.x, item.y).width /
      A4_IN.w;
  }
  if (dpi < MIN_DPI) {
    throw new Error(
      `Photo ${index + 1} is too small to print on A4 (about ${Math.round(dpi)} DPI). Please use a larger photo.`,
    );
  }
  return { data, w, h, dpi, item };
}

async function renderA4(p, quality) {
  if (p.item.fit === "fit") {
    return sharp(p.data)
      .resize(A4_PX.w, A4_PX.h, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality })
      .toBuffer();
  }
  const box = cropBox(
    p.w,
    p.h,
    A4_PX.w / A4_PX.h,
    p.item.zoom,
    p.item.x,
    p.item.y,
  );
  return sharp(p.data)
    .extract(box)
    .resize(A4_PX.w, A4_PX.h)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality })
    .toBuffer();
}

// One PDF: every photo on its own A4 page, repeated once per copy
async function buildA4Pdf(prepared) {
  for (const quality of [88, 78, 68, 58]) {
    const doc = await PDFDocument.create();
    for (const p of prepared) {
      const img = await doc.embedJpg(await renderA4(p, quality));
      for (let c = 0; c < p.item.copies; c++) {
        const page = doc.addPage([A4_PT.w, A4_PT.h]);
        page.drawImage(img, { x: 0, y: 0, width: A4_PT.w, height: A4_PT.h });
      }
    }
    const bytes = Buffer.from(await doc.save());
    if (bytes.length <= MAX_PDF_BYTES) return bytes;
  }
  throw new Error(
    "These photos are too large together. Please add fewer photos.",
  );
}

// ---------- Passport photos ----------

// Crops the photo to the passport size at 300 DPI. Returns { jpeg, dpi }
async function renderPassport(
  buffer,
  size,
  { zoom = 1, x = 0.5, y = 0.5 } = {},
) {
  const s = PASSPORT[size];
  if (!s) throw new Error("Unknown passport size");
  const base = await loadOriented(buffer);
  const tw = Math.round((s.w / 25.4) * 300);
  const th = Math.round((s.h / 25.4) * 300);
  const box = cropBox(base.w, base.h, tw / th, zoom, x, y);
  const dpi = box.width / (s.w / 25.4);
  if (dpi < MIN_DPI) {
    throw new Error(
      `This photo is too small for a ${size} mm passport photo (about ${Math.round(dpi)} DPI). Please use a larger photo.`,
    );
  }
  const jpeg = await sharp(base.data)
    .extract(box)
    .resize(tw, th)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { jpeg, dpi };
}

// How many photos fit on one sheet of the chosen paper
function capacity(paper, size) {
  const pp = PAPERS[paper];
  const s = PASSPORT[size];
  if (!pp || !s) return { cols: 0, rows: 0, perSheet: 0 };
  const layout = (pw, ph, rotated) => {
    const cols = Math.max(
      0,
      Math.floor((pp.w - 2 * MARGIN + GAP) / (pw + GAP)),
    );
    const rows = Math.max(
      0,
      Math.floor((pp.h - 2 * MARGIN + GAP) / (ph + GAP)),
    );
    return { cols, rows, pw, ph, rotated, perSheet: cols * rows };
  };
  const a = layout(s.w, s.h, false);
  const b = layout(s.h, s.w, true);
  return b.perSheet > a.perSheet ? b : a;
}

// A printable sheet (PDF) with the passport photo repeated, with thin cut guides
async function buildPassportSheet({
  photoJpeg,
  size,
  paper,
  pieces,
  guides = true,
}) {
  const pp = PAPERS[paper];
  const cap = capacity(paper, size);
  if (!pp || !cap.perSheet)
    throw new Error("This passport size does not fit on that paper");

  const img = cap.rotated
    ? await sharp(photoJpeg).rotate(90).jpeg({ quality: 92 }).toBuffer()
    : photoJpeg;
  const doc = await PDFDocument.create();
  const emb = await doc.embedJpg(img);

  const gridW = cap.cols * cap.pw + (cap.cols - 1) * GAP;
  const gridH = cap.rows * cap.ph + (cap.rows - 1) * GAP;
  const x0 = (pp.w - gridW) / 2;
  const top0 = (pp.h - gridH) / 2;

  let left = pieces;
  while (left > 0) {
    const page = doc.addPage([pp.w * MM, pp.h * MM]);
    const n = Math.min(left, cap.perSheet);
    for (let i = 0; i < n; i++) {
      const c = i % cap.cols;
      const r = Math.floor(i / cap.cols);
      const x = (x0 + c * (cap.pw + GAP)) * MM;
      const y = (pp.h - top0 - (r + 1) * cap.ph - r * GAP) * MM;
      page.drawImage(emb, { x, y, width: cap.pw * MM, height: cap.ph * MM });
      if (guides) {
        page.drawRectangle({
          x,
          y,
          width: cap.pw * MM,
          height: cap.ph * MM,
          borderWidth: 0.3,
          borderColor: rgb(0.5, 0.5, 0.5),
        });
      }
    }
    left -= n;
  }
  return Buffer.from(await doc.save());
}

module.exports = {
  MIN_DPI,
  WARN_DPI,
  PASSPORT,
  PAPERS,
  prepareA4Photo,
  buildA4Pdf,
  renderPassport,
  capacity,
  buildPassportSheet,
};
