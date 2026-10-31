import { useRef } from "react";
import { cropGeometry } from "../photoMath";

const unit = (n) => Math.min(1, Math.max(0, n));

// src: a preview picture (w x h pixels), ratio: shape of the printed area (width / height).
// fit "fit" shows the whole picture with white margins. Otherwise the picture can be dragged.
export default function CropFrame({
  src,
  w,
  h,
  ratio,
  fit = "fill",
  zoom = 1,
  x = 0.5,
  y = 0.5,
  onMove,
  maxWidth = 300,
}) {
  const frame = useRef(null);
  const drag = useRef(null);

  const g = cropGeometry(w, h, ratio, zoom, x, y);
  const canDrag = fit !== "fit" && (g.slackX > 0.5 || g.slackY > 0.5);

  function down(e) {
    if (!canDrag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, left: g.left, top: g.top };
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const rect = frame.current.getBoundingClientRect();
    // dragging the photo right means the printed window moves left
    const left = d.left - ((e.clientX - d.px) / rect.width) * g.bw;
    const top = d.top - ((e.clientY - d.py) / rect.height) * g.bh;
    onMove({
      x: g.slackX > 0.5 ? unit(left / g.slackX) : x,
      y: g.slackY > 0.5 ? unit(top / g.slackY) : y,
    });
  }

  function up() {
    drag.current = null;
  }

  function key(e) {
    if (!canDrag) return;
    const step = 0.03;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!moves) return;
    e.preventDefault();
    onMove({
      x: g.slackX > 0.5 ? unit(x + moves[0]) : x,
      y: g.slackY > 0.5 ? unit(y + moves[1]) : y,
    });
  }

  return (
    <div
      ref={frame}
      className={"crop-frame" + (canDrag ? " drag" : "")}
      style={{ aspectRatio: ratio, maxWidth }}
      tabIndex={canDrag ? 0 : -1}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      role="img"
      aria-label="Preview of the printed area. Drag to move the photo."
    >
      {fit === "fit" ? (
        <img className="crop-fit" src={src} alt="" draggable={false} />
      ) : (
        <img
          className="crop-img"
          src={src}
          alt=""
          draggable={false}
          style={{
            width: `${(w / g.bw) * 100}%`,
            height: `${(h / g.bh) * 100}%`,
            left: `${-(g.left / g.bw) * 100}%`,
            top: `${-(g.top / g.bh) * 100}%`,
          }}
        />
      )}
    </div>
  );
}