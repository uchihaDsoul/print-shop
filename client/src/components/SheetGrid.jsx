import { useEffect, useMemo, useState } from "react";
import { cropGeometry } from "../photoMath";
import { PAPER_MM, SPACING, describePlan, planOrder, slotLayout } from "../sheetLayout";

const MAX_PIECES = 40;

// pieces: how many photos are ordered. photoMm: { w, h } of one photo in mm.
// preview: { url, w, h } of the framed photo (or null before a photo is chosen).
// view: { zoom, x, y } and ratio: the same values the crop frame uses.
// onFill(n): asks the screen to set the number of photos to n.
export default function SheetGrid({ pieces, photoMm, preview, view, ratio, onFill }) {
  const [page, setPage] = useState(0);

  const plan = useMemo(
    () => planOrder({ pieces, photoW: photoMm.w, photoH: photoMm.h }),
    [pieces, photoMm.w, photoMm.h]
  );
  const total = plan.sheets.length;

  // stay on a valid page when the number of sheets changes
  useEffect(() => {
    if (page > Math.max(0, total - 1)) setPage(Math.max(0, total - 1));
  }, [total, page]);

  if (total === 0) return null;

  const sheet = plan.sheets[Math.min(page, total - 1)];
  const paper = PAPER_MM[sheet.key];
  const L = slotLayout(sheet.key, photoMm.w, photoMm.h);
  const { gap } = SPACING;

  const gridW = L.cols * L.slotW + (L.cols - 1) * gap;
  const gridH = L.rows * L.slotH + (L.rows - 1) * gap;
  const x0 = (paper.w - gridW) / 2;
  const y0 = (paper.h - gridH) / 2;

  // the part of the picture that prints (the same crop the server makes)
  const geo = preview ? cropGeometry(preview.w, preview.h, ratio, view.zoom, view.x, view.y) : null;
  const viewBox = geo ? `${geo.left} ${geo.top} ${geo.bw} ${geo.bh}` : null;

  function photo(x, y) {
    const inner = (
      <svg
        width={photoMm.w}
        height={photoMm.h}
        viewBox={viewBox}
        preserveAspectRatio="none"
        x={L.rotated ? 0 : x}
        y={L.rotated ? 0 : y}
      >
        <image href={preview.url} x="0" y="0" width={preview.w} height={preview.h} />
      </svg>
    );
    // sideways slots turn the photo a quarter turn clockwise, as the server does
    return L.rotated ? (
      <g transform={`translate(${x + L.slotW} ${y}) rotate(90)`}>{inner}</g>
    ) : (
      inner
    );
  }

  const slots = [];
  for (let i = 0; i < L.perSheet; i++) {
    const x = x0 + (i % L.cols) * (L.slotW + gap);
    const y = y0 + Math.floor(i / L.cols) * (L.slotH + gap);
    const filled = i < sheet.count;

    slots.push(
      <g key={i}>
        {filled && !geo && (
          <rect x={x} y={y} width={L.slotW} height={L.slotH} fill="rgba(108,63,209,0.18)" />
        )}
        {filled && geo && photo(x, y)}
        <rect
          x={x}
          y={y}
          width={L.slotW}
          height={L.slotH}
          fill="none"
          stroke={filled ? "#6c3fd1" : "#b8b8c8"}
          strokeWidth={filled ? 0.3 : 0.4}
          strokeDasharray={filled ? undefined : "2 1.5"}
        />
      </g>
    );
  }

  const room = plan.room;
  const canFill = room > 0 && pieces + room <= MAX_PIECES && onFill;

  return (
    <div className="sheet-grid">
      <strong>
        Your order: {describePlan(plan)}
      </strong>

      <svg
        className="sheet-svg"
        viewBox={`0 0 ${paper.w} ${paper.h}`}
        role="img"
        aria-label={`Sheet ${page + 1} of ${total}, ${paper.label}, ${sheet.count} photos`}
      >
        <rect x="0" y="0" width={paper.w} height={paper.h} fill="#ffffff" />
        {slots}
      </svg>

      <div className="sheet-nav">
        <button
          type="button"
          className="small ghost"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </button>
        <span>
          Sheet {page + 1} of {total} · {paper.label} · {sheet.count} photo
          {sheet.count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="small ghost"
          disabled={page >= total - 1}
          onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
        >
          Next
        </button>
      </div>

      <p className="note">
        {L.cols} x {L.rows} slots{L.rotated ? ", photos turned sideways" : ""}. Dashed slots are
        empty. The shop cuts the sheet and confirms the paper when it prints.
      </p>

      {canFill && (
        <div className="actions">
          <span className="note">
            There's room for {room} more photo{room === 1 ? "" : "s"} on the sheets above, with no
            extra paper.
          </span>
          <button type="button" className="small" onClick={() => onFill(pieces + room)}>
            Add {room} more
          </button>
        </div>
      )}
    </div>
  );
}