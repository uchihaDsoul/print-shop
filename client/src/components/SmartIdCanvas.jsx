import { useState, useRef } from "react";
import { rupees } from "../format";

export default function SmartIdCanvas({ files, onUpdateLayout, pricePerSheet = 20 }) {
  // Each placed element keeps track of its file reference, position (x, y), width, height, and rotation
  const [elements, setElements] = useState(
    files.map((file, idx) => ({
      id: file.id || idx,
      name: file.name || `Photo ${idx + 1}`,
      url: file.url || URL.createObjectURL(file),
      x: 20 + (idx * 15), // Default staggered placement
      y: 20 + (idx * 15),
      width: 85.6, // Standard ID card width in mm (CR80)
      height: 54,  // Standard ID card height in mm
      rotation: 0
    }))
  );

  const [selectedId, setSelectedId] = useState(null);
  const containerRef = useRef(null);

  const selectedElement = elements.find(el => el.id === selectedId);

  const handleUpdate = (id, field, value) => {
    setElements(prev =>
      prev.map(el => (el.id === id ? { ...el, [field]: parseFloat(value) || 0 } : el))
    );
  };

  const handleRemove = (id) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
      
      {/* Left: Visual A4 Sheet Canvas Preview */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginBottom: "10px" }}>
          <strong>A4 Sheet Workspace (210 × 297 mm)</strong>
          <span className="note" style={{ fontSize: "12px" }}>Click any card to resize or move</span>
        </div>

        {/* A4 Proportion Box (Aspect ratio ~ 1 : 1.414) */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "450px",
            aspectRatio: "210 / 297",
            background: "#ffffff",
            borderRadius: "4px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            overflow: "hidden",
            cursor: "crosshair"
          }}
        >
          {elements.map((el) => {
            // Convert mm to percentage for responsive canvas rendering (A4 = 210mm x 297mm)
            const leftPct = (el.x / 210) * 100;
            const topPct = (el.y / 297) * 100;
            const widthPct = (el.width / 210) * 100;
            const heightPct = (el.height / 297) * 100;
            const isSelected = el.id === selectedId;

            return (
              <div
                key={el.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(el.id);
                }}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: `rotate(${el.rotation}deg)`,
                  border: isSelected ? "2px solid #10b981" : "1px dashed #cbd5e1",
                  background: "rgba(0,0,0,0.05)",
                  boxShadow: isSelected ? "0 4px 12px rgba(16,185,129,0.3)" : "none",
                  cursor: "move",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderRadius: "4px"
                }}
              >
                <img
                  src={el.url}
                  alt={el.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                />
                <div style={{ position: "absolute", bottom: 2, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "9px", padding: "1px 4px", borderRadius: "2px" }}>
                  {Math.round(el.width)}×{Math.round(el.height)}mm
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Precise Size & Position Inspector Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 style={{ fontSize: "14px", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Card Layout Inspector</h3>

        {selectedElement ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 500, color: "#10b981" }}>{selectedElement.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(selectedElement.id)}
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                Remove
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label className="note" style={{ fontSize: "11px" }}>Width (mm)</label>
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(e) => handleUpdate(selectedElement.id, "width", e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px", borderRadius: "6px" }}
                />
              </div>
              <div>
                <label className="note" style={{ fontSize: "11px" }}>Height (mm)</label>
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(e) => handleUpdate(selectedElement.id, "height", e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px", borderRadius: "6px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label className="note" style={{ fontSize: "11px" }}>Position X (mm)</label>
                <input
                  type="number"
                  value={selectedElement.x}
                  onChange={(e) => handleUpdate(selectedElement.id, "x", e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px", borderRadius: "6px" }}
                />
              </div>
              <div>
                <label className="note" style={{ fontSize: "11px" }}>Position Y (mm)</label>
                <input
                  type="number"
                  value={selectedElement.y}
                  onChange={(e) => handleUpdate(selectedElement.id, "y", e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px", borderRadius: "6px" }}
                />
              </div>
            </div>

            <div>
              <label className="note" style={{ fontSize: "11px" }}>Rotation (Degrees)</label>
              <select
                value={selectedElement.rotation}
                onChange={(e) => handleUpdate(selectedElement.id, "rotation", e.target.value)}
                style={{ width: "100%", background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px", borderRadius: "6px" }}
              >
                <option value="0">0° (Normal)</option>
                <option value="90">90° Clockwise</option>
                <option value="180">180° Inverted</option>
                <option value="270">270° Counter-Clockwise</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => {
                  // Preset for standard CR80 ID Card (85.6 x 54 mm)
                  handleUpdate(selectedElement.id, "width", 85.6);
                  handleUpdate(selectedElement.id, "height", 54);
                }}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "none", color: "#cbd5e1", padding: "6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                Standard ID (85×54)
              </button>
              <button
                type="button"
                onClick={() => {
                  // Preset for Passport Photo size (35 x 45 mm)
                  handleUpdate(selectedElement.id, "width", 35);
                  handleUpdate(selectedElement.id, "height", 45);
                }}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "none", color: "#cbd5e1", padding: "6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                Passport (35×45)
              </button>
            </div>
          </div>
        ) : (
          <p className="note" style={{ textAlign: "center", padding: "30px 0" }}>
            Select any card photo on the A4 sheet canvas to customize its exact size and coordinates.
          </p>
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px", marginTop: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
            <span>Layout Sheets: <strong>1 A4 Sheet</strong></span>
            <strong>{rupees(pricePerSheet)}</strong>
          </div>
          <span className="note" style={{ fontSize: "11px" }}>Coordinates are compiled directly into the print layout engine.</span>
        </div>
      </div>

    </div>
  );
}