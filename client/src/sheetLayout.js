// Layout maths for passport sheets. It mirrors capacity() in server/utils/photo.js,
// so what the customer sees is what the server builds.

export const SPACING = { margin: 5, gap: 3 }; // millimetres

export const PAPER_MM = {
  a4: { label: "A4", w: 210, h: 297 },
  a5: { label: "A5", w: 148.5, h: 210 },
  "3r": { label: "3.5 x 5 in", w: 88.9, h: 127 },
  "4x6": { label: "4 x 6 in", w: 101.6, h: 152.4 },
  "5r": { label: "5 x 7 in", w: 127, h: 177.8 },
};

const A4_AREA = 210 * 297;

// How photos sit on one sheet: columns, rows, and whether they are turned sideways
export function slotLayout(paperKey, photoW, photoH, spacing = SPACING) {
  const paper = PAPER_MM[paperKey];
  if (!paper || !(photoW > 0) || !(photoH > 0)) {
    return { cols: 0, rows: 0, perSheet: 0, rotated: false, slotW: photoW, slotH: photoH };
  }
  const { margin, gap } = spacing;
  const fit = (pw, ph, rotated) => {
    const cols = Math.max(0, Math.floor((paper.w - 2 * margin + gap) / (pw + gap)));
    const rows = Math.max(0, Math.floor((paper.h - 2 * margin + gap) / (ph + gap)));
    return { cols, rows, perSheet: cols * rows, rotated, slotW: pw, slotH: ph };
  };
  const upright = fit(photoW, photoH, false);
  const sideways = fit(photoH, photoW, true);
  return sideways.perSheet > upright.perSheet ? sideways : upright;
}

// The cheapest set of sheets that holds all the photos, using ONLY the papers provided
export function planOrder({
  pieces,
  photoW,
  photoH,
  papers, // Now strictly required: e.g. [{ key: "a4" }]
  spacing = SPACING,
}) {
  const n = Math.round(Number(pieces));
  if (!(n >= 1) || n > 200 || !papers || papers.length === 0) return { sheets: [], room: 0 };

  const options = papers
    .map((p) => {
      const paper = PAPER_MM[p.key];
      if (!paper) return null;
      const perSheet = slotLayout(p.key, photoW, photoH, spacing).perSheet;
      const base = p.price ?? (paper.w * paper.h) / A4_AREA;
      return { key: p.key, perSheet, cost: base + 0.01 };
    })
    .filter((o) => o && o.perSheet > 0);
    
  if (options.length === 0) return { sheets: [], room: 0 };

  const best = Array(n + 1).fill(null);
  best[0] = { cost: 0 };
  for (let i = 1; i <= n; i++) {
    for (const o of options) {
      const from = Math.max(0, i - o.perSheet);
      const cost = best[from].cost + o.cost;
      if (!best[i] || cost < best[i].cost - 1e-9) {
        best[i] = { cost, from, key: o.key, perSheet: o.perSheet };
      }
    }
  }

  const sheets = [];
  for (let i = n; i > 0; i = best[i].from) {
    sheets.push({ key: best[i].key, count: i - best[i].from, perSheet: best[i].perSheet });
  }

  const area = (k) => PAPER_MM[k].w * PAPER_MM[k].h;
  sheets.sort((a, b) => area(b.key) - area(a.key) || b.count - a.count);

  const room = Math.max(...sheets.map((s) => s.perSheet - s.count));
  return { sheets, room };
}

export function describePlan(plan) {
  if (!plan || !plan.sheets) return "";
  const counts = {};
  for (const s of plan.sheets) counts[s.key] = (counts[s.key] || 0) + 1;
  return Object.entries(counts)
    .map(([key, n]) => `${n} x ${PAPER_MM[key].label}`)
    .join(" + ");
}