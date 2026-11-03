import { useState, useRef, useEffect } from "react";
import { createWalkInOrder, countPages, getRates, getQuote } from "../../api";
import { compileIdCardsToA4Pdf } from "../../utils/idCardCompiler";
import { mergePdfsToSingle } from "../../utils/pdfMerger";
import ImageCropModal from "../../components/ImageCropModal";
import Modal from "../../components/Modal";
import { PDFDocument } from 'pdf-lib';

const initialForm = {
  customerName: "",
  phone: "",
  pages: 0,
  pageRange: "",
  copies: 1,
  color: false,
  size: "A4",
  doubleSided: false,
  stapling: false,
  binding: false,
  urgent: false,
  payment: "cash",
  note: "",
};

export default function WalkinTab({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState(null);

  const fileInputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [isIdLayout, setIsIdLayout] = useState(false);
  
  // Interactive Free-Placement Canvas States
  const [idElements, setIdElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);

  // Mouse Interaction States (Dragging vs Resizing)
  const [interactionMode, setInteractionMode] = useState(null); // 'drag' | 'resize-se'
  const [activeElId, setActiveElId] = useState(null);
  const [interactionStart, setInteractionStart] = useState({ x: 0, y: 0, elX: 0, elY: 0, elW: 0, elH: 0 });
  const canvasRef = useRef(null);

  // Cropping States
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropImageSrc, setCurrentCropImageSrc] = useState(null);
  const [currentCropIndex, setCurrentCropIndex] = useState(null);

  // Multi-File & Page Ranges
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileOffsets, setFileOffsets] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    getRates()
      .then(setRates)
      .catch(() => {});
  }, []);

  const sizes = rates?.enabledSizes || ["A4"];

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (name === "phone") {
      const numericValue = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: numericValue }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleFiles(e) {
    const chosenFiles = Array.from(e.target.files);
    setError("");
    if (chosenFiles.length === 0) return;

    for (const f of chosenFiles) {
      if (f.size > 20 * 1024 * 1024) {
        setError(`File ${f.name} is too large (max 20 MB)`);
        e.target.value = "";
        return;
      }
    }

    setCounting(true);
    try {
      if (isIdLayout) {
        const combinedSelected = [...selectedFiles, ...chosenFiles];
        setSelectedFiles(combinedSelected);

        const newElements = combinedSelected.map((f, idx) => ({
          id: `id-el-${Date.now()}-${idx}`,
          file: f,
          name: f.name,
          url: URL.createObjectURL(f),
          x: 15 + ((idx % 2) * 95),
          y: 15 + (Math.floor(idx / 2) * 62),
          width: 85.6,
          height: 54,
          rotation: 0
        }));
        setIdElements(newElements);
        if (!selectedElementId && newElements.length > 0) {
          setSelectedElementId(newElements[0].id);
        }

        const compiledBlob = await compileIdCardsToA4Pdf(newElements, 2);
        const compiledFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
        const { pages } = await countPages(compiledFile);
        setFile(compiledFile);
        setForm((prev) => ({ ...prev, pages }));
        setUploadedFiles([{ file: compiledFile, pageCount: pages, pageRange: "", rangeError: "" }]);
        setFileOffsets([{ start: 1, end: pages, offset: 0, pageCount: pages }]);
      } else {
        const newFileDetails = [];
        for (const f of chosenFiles) {
          const { pages } = await countPages(f);
          newFileDetails.push({ file: f, pageCount: pages, pageRange: "", rangeError: "" });
        }
        const updatedList = [...uploadedFiles, ...newFileDetails];
        setUploadedFiles(updatedList);

        const allRawFiles = updatedList.map((item) => item.file);
        const { mergedFile, filePageOffsets } = await mergePdfsToSingle(allRawFiles);
        setFileOffsets(filePageOffsets);
        
        const { pages } = await countPages(mergedFile);
        setFile(mergedFile);
        setForm((prev) => ({ ...prev, pages }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCounting(false);
    }
    e.target.value = "";
  }

  function handleCanvasElementUpdate(id, field, value) {
    setIdElements(prev => {
      const updated = prev.map(el => el.id === id ? { ...el, [field]: parseFloat(value) || 0 } : el);
      compileIdCardsToA4Pdf(updated, 2).then(async (compiledBlob) => {
        const compiledFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
        const { pages } = await countPages(compiledFile);
        setFile(compiledFile);
        setForm(f => ({ ...f, pages }));
      }).catch(() => {});
      return updated;
    });
  }

  function handleMouseDown(e, el, mode) {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setInteractionMode(mode);
    setActiveElId(el.id);

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pxToMmX = 210 / rect.width;
      const pxToMmY = 297 / rect.height;

      setInteractionStart({
        mouseX: (e.clientX - rect.left) * pxToMmX,
        mouseY: (e.clientY - rect.top) * pxToMmY,
        elX: el.x,
        elY: el.y,
        elW: el.width,
        elH: el.height
      });
    }
  }

  function handleMouseMove(e) {
    if (!iteractionActiveCheck() || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pxToMmX = 210 / rect.width;
    const pxToMmY = 297 / rect.height;

    const currentMouseX = (e.clientX - rect.left) * pxToMmX;
    const currentMouseY = (e.clientY - rect.top) * pxToMmY;

    const deltaX = currentMouseX - interactionStart.mouseX;
    const deltaY = currentMouseY - interactionStart.mouseY;

    setIdElements(prev =>
      prev.map(el => {
        if (el.id !== activeElId) return el;

        if (interactionMode === 'drag') {
          const newX = Math.max(0, Math.min(210 - el.width, interactionStart.elX + deltaX));
          const newY = Math.max(0, Math.min(297 - el.height, interactionStart.elY + deltaY));
          return { ...el, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
        } else if (interactionMode === 'resize-se') {
          const newW = Math.max(15, Math.min(210 - el.x, interactionStart.elW + deltaX));
          const newH = Math.max(15, Math.min(297 - el.y, interactionStart.elH + deltaY));
          return { ...el, width: Math.round(newW * 10) / 10, height: Math.round(newH * 10) / 10 };
        }
        return el;
      })
    );
  }

  function iteractionActiveCheck() {
    return interactionMode !== null && activeElId !== null;
  }

  function handleMouseUp() {
    if (interactionMode) {
      setInteractionMode(null);
      setActiveElId(null);
      compileIdCardsToA4Pdf(idElements, 2).then(async (compiledBlob) => {
        const compiledFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
        const { pages } = await countPages(compiledFile);
        setFile(compiledFile);
        setForm(f => ({ ...f, pages }));
      }).catch(() => {});
    }
  }

  function removeCanvasElement(id) {
    setIdElements(prev => {
      const updated = prev.filter(el => el.id !== id);
      setSelectedFiles(updated.map(el => el.file));
      if (selectedElementId === id) {
        setSelectedElementId(updated.length > 0 ? updated[0].id : null);
      }
      compileIdCardsToA4Pdf(updated, 2).then(async (compiledBlob) => {
        const compiledFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
        const { pages } = await countPages(compiledFile);
        setFile(compiledFile);
        setForm(f => ({ ...f, pages }));
      }).catch(() => {});
      return updated;
    });
  }

  const selectedCanvasItem = idElements.find(el => el.id === selectedElementId);

  // Crop Complete: Reads natural width/height of cropped blob to automatically set canvas dimensions in mm
  async function handleCropComplete(croppedFile) {
    if (currentCropIndex === null) return;
    const updatedFiles = [...selectedFiles];
    updatedFiles[currentCropIndex] = croppedFile;
    setSelectedFiles(updatedFiles);

    const url = URL.createObjectURL(croppedFile);
    const img = new Image();
    img.src = url;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const naturalWidth = img.naturalWidth || 100;
    const naturalHeight = img.naturalHeight || 100;
    const ratio = naturalWidth / naturalHeight;

    const baseWidth = 85.6; // standard reference width in mm
    const calculatedHeight = Math.round((baseWidth / ratio) * 10) / 10;

    const updatedElements = [...idElements];
    if (updatedElements[currentCropIndex]) {
      updatedElements[currentCropIndex] = {
        ...updatedElements[currentCropIndex],
        file: croppedFile,
        url: url,
        width: baseWidth,
        height: calculatedHeight
      };
    }
    setIdElements(updatedElements);
    setCropModalOpen(false);

    const compiledBlob = await compileIdCardsToA4Pdf(updatedElements, 2);
    const compiledFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
    const { pages } = await countPages(compiledFile);
    setFile(compiledFile);
    setForm(prev => ({ ...prev, pages }));
  }

  function removeFile(indexToRemove) {
    const updatedList = uploadedFiles.filter((_, idx) => idx !== indexToRemove);
    setUploadedFiles(updatedList);
    if (updatedList.length === 0) {
      setFile(null);
      setForm((prev) => ({ ...prev, pages: 0, pageRange: "" }));
      setFileOffsets([]);
      return;
    }
    rebuildMergedFile(updatedList);
  }

  async function rebuildMergedFile(currentList) {
    setCounting(true);
    try {
      const allRawFiles = currentList.map((item) => item.file);
      const { mergedFile, filePageOffsets } = await mergePdfsToSingle(allRawFiles);
      setFileOffsets(filePageOffsets);
      const { pages } = await countPages(mergedFile);
      setFile(mergedFile);
      setForm((prev) => ({ ...prev, pages }));
      updateGlobalPageRange(currentList, filePageOffsets);
    } catch (err) {
      setError(err.message);
    } finally {
      setCounting(false);
    }
  }

  function handleFileRangeChange(index, rangeValue) {
    const updated = [...uploadedFiles];
    updated[index].pageRange = rangeValue;
    const maxPages = fileOffsets[index]?.pageCount || updated[index].pageCount;
    let rangeErr = "";

    if (rangeValue.trim()) {
      const parts = rangeValue.split(",");
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes("-")) {
          const [start, end] = trimmed.split("-").map(n => parseInt(n.trim(), 10));
          if (isNaN(start) || isNaN(end) || start < 1 || end > maxPages || start > end) {
            rangeErr = `Invalid range "${trimmed}". Max page is ${maxPages}.`;
            break;
          }
        } else {
          const pageNum = parseInt(trimmed, 10);
          if (isNaN(pageNum) || pageNum < 1 || pageNum > maxPages) {
            rangeErr = `Page ${pageNum} does not exist (Max: ${maxPages}).`;
            break;
          }
        }
      }
    }

    updated[index].rangeError = rangeErr;
    setUploadedFiles(updated);
    updateGlobalPageRange(updated, fileOffsets);
  }

  function updateGlobalPageRange(list, offsets) {
    const allBlank = list.every(item => !item.pageRange.trim());
    if (allBlank) {
      setForm((prev) => ({ ...prev, pageRange: "" }));
      return;
    }

    const absoluteRanges = [];
    list.forEach((item, idx) => {
      if (item.rangeError) return;
      const fileOffset = offsets[idx];
      if (!fileOffset) return;
      const rangeVal = item.pageRange.trim();
      
      if (!rangeVal) {
        absoluteRanges.push(`${fileOffset.start}-${fileOffset.end}`);
      } else {
        const parts = rangeVal.split(",");
        const translatedParts = parts.map((part) => {
          part = part.trim();
          const offset = fileOffset.offset;
          if (part.includes("-")) {
            const [start, end] = part.split("-").map(n => parseInt(n.trim(), 10));
            return `${start + offset}-${end + offset}`;
          } else {
            return `${parseInt(part, 10) + offset}`;
          }
        });
        absoluteRanges.push(translatedParts.join(", "));
      }
    });

    setForm((prev) => ({ ...prev, pageRange: absoluteRanges.filter(Boolean).join(", ") }));
  }

  async function generateSelectedPagesPreview() {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      let pagesToInclude = [];
      if (!form.pageRange.trim()) {
        pagesToInclude = Array.from({ length: totalPages }, (_, i) => i);
      } else {
        const parts = form.pageRange.split(",");
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes("-")) {
            const [start, end] = trimmed.split("-").map(n => parseInt(n.trim(), 10));
            for (let p = start; p <= end; p++) {
              if (p >= 1 && p <= totalPages) pagesToInclude.push(p - 1);
            }
          } else {
            const p = parseInt(trimmed, 10);
            if (p >= 1 && p <= totalPages) pagesToInclude.push(p - 1);
          }
        }
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(pdfDoc, pagesToInclude);
      copiedPages.forEach((pg) => newPdf.addPage(pg));

      const pdfBytes = await newPdf.save();
      const previewBlob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(previewBlob);
      
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err) {
      console.error("Failed to generate preview:", err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getQuote({ ...form, isIdLayout })
        .then((data) => {
          if (cancelled) return;
          setPrice(data.price);
          setPrintPages(data.printPages || 0);
          setRangeError(data.error || "");
        })
        .catch(() => !cancelled && setPrice(0));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    form.pages,
    form.pageRange,
    form.copies,
    form.color,
    form.size,
    form.doubleSided,
    form.stapling,
    form.binding,
    form.urgent,
    isIdLayout,
  ]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const submissionForm = {
        ...form,
        customerName: form.customerName.trim() || "Walk-in Customer",
        isIdLayout,
      };

      const order = await createWalkInOrder(submissionForm, file);
      setForm(initialForm);
      setFile(null);
      setUploadedFiles([]);
      setSelectedFiles([]);
      setIdElements([]);
      setFileKey((k) => k + 1);
      setPrice(0);
      setPrintPages(0);
      setRangeError("");
      if (onCreated) onCreated(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const hasAnyFileError = uploadedFiles.some((item) => Boolean(item.rangeError));

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>New Walk-in Order</h2>
      <p className="note">Create a print order directly from the counter.</p>

      <h3>1. Customer Details</h3>
      <div className="row">
        <label>
          Customer Name
          <input
            name="customerName"
            value={form.customerName}
            onChange={handleChange}
            placeholder="Leave blank for 'Walk-in Customer'"
          />
        </label>
        <label>
          Phone Number (10 digits)
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            title="Enter exactly 10 digits"
            placeholder="e.g. 9876543210"
          />
        </label>
      </div>

      <h3>2. Files & Documents</h3>

      <label className="check" style={{ marginBottom: "12px", background: "rgba(99, 102, 241, 0.08)", padding: "10px", borderRadius: "8px" }}>
        <input 
          type="checkbox" 
          checked={isIdLayout} 
          onChange={async (e) => {
            const val = e.target.checked;
            setIsIdLayout(val);
            setFile(null);
            setUploadedFiles([]);
            setSelectedFiles([]);
            setIdElements([]);
            setForm(prev => ({ ...prev, pages: 0 }));
          }} 
        />
        <strong>Interactive Custom ID / Photo Placement Canvas</strong> (Crop sets size, drag/resize handles, manual overrides)
      </label>

      <label>
        {isIdLayout ? "Upload ID or Photo Images (Front/Back/Passports)" : "Upload PDF, JPG or PNG (max 20 MB each)"}
        <input
          ref={fileInputRef}
          key={fileKey}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple={true}
          onChange={handleFiles}
          style={{ display: uploadedFiles.length > 0 && !isIdLayout ? "none" : "block" }}
        />
      </label>

      {/* Interactive Free-Placement Canvas Workspace */}
      {isIdLayout && idElements.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px", background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", margin: "14px 0" }}>
          
          {/* Left: Visual A4 Canvas Preview */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>A4 Sheet Canvas (210 × 297 mm)</span>
              <span className="note" style={{ fontSize: "11px" }}>Crop dictates card dimensions</span>
            </div>

            <div
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "380px",
                aspectRatio: "210 / 297",
                background: "#ffffff",
                borderRadius: "4px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
                overflow: "hidden",
                cursor: interactionMode ? "grabbing" : "default"
              }}
            >
              {idElements.map((el) => {
                const leftPct = (el.x / 210) * 100;
                const topPct = (el.y / 297) * 100;
                const widthPct = (el.width / 210) * 100;
                const heightPct = (el.height / 297) * 100;
                const isSelected = el.id === selectedElementId;

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleMouseDown(e, el, 'drag')}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      transform: `rotate(${el.rotation}deg)`,
                      border: isSelected ? "2px solid #10b981" : "1px dashed #94a3b8",
                      background: "rgba(0,0,0,0.04)",
                      cursor: "move",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      borderRadius: "3px",
                      userSelect: "none"
                    }}
                  >
                    <img
                      src={el.url}
                      alt={el.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                    />
                    
                    {/* Dimension Badge */}
                    <div style={{ position: "absolute", bottom: 2, right: 3, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "8px", padding: "1px 3px", borderRadius: "2px" }}>
                      {Math.round(el.width)}×{Math.round(el.height)}mm
                    </div>

                    {/* Resize Handle at Bottom-Right Corner */}
                    {isSelected && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, el, 'resize-se');
                        }}
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: "12px",
                          height: "12px",
                          background: "#10b981",
                          cursor: "se-resize",
                          borderRadius: "2px 0 0 0"
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Inspector Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h4 style={{ fontSize: "13px", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Card Inspector</h4>

            {selectedCanvasItem ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 500, color: "#10b981", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>{selectedCanvasItem.name}</span>
                  <button
                    type="button"
                    onClick={() => removeCanvasElement(selectedCanvasItem.id)}
                    style={{ background: "#ef4444", color: "#fff", border: "none", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div>
                    <label className="note" style={{ fontSize: "10px" }}>Width (mm)</label>
                    <input
                      type="number"
                      value={selectedCanvasItem.width}
                      onChange={(e) => handleCanvasElementUpdate(selectedCanvasItem.id, "width", e.target.value)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "4px", borderRadius: "4px", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label className="note" style={{ fontSize: "10px" }}>Height (mm)</label>
                    <input
                      type="number"
                      value={selectedCanvasItem.height}
                      onChange={(e) => handleCanvasElementUpdate(selectedCanvasItem.id, "height", e.target.value)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "4px", borderRadius: "4px", fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div>
                    <label className="note" style={{ fontSize: "10px" }}>X Pos (mm)</label>
                    <input
                      type="number"
                      value={selectedCanvasItem.x}
                      onChange={(e) => handleCanvasElementUpdate(selectedCanvasItem.id, "x", e.target.value)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "4px", borderRadius: "4px", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label className="note" style={{ fontSize: "10px" }}>Y Pos (mm)</label>
                    <input
                      type="number"
                      value={selectedCanvasItem.y}
                      onChange={(e) => handleCanvasElementUpdate(selectedCanvasItem.id, "y", e.target.value)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "4px", borderRadius: "4px", fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="note" style={{ fontSize: "10px" }}>Rotation</label>
                  <select
                    value={selectedCanvasItem.rotation}
                    onChange={(e) => handleCanvasElementUpdate(selectedCanvasItem.id, "rotation", e.target.value)}
                    style={{ width: "100%", background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "4px", borderRadius: "4px", fontSize: "12px" }}
                  >
                    <option value="0">0° (Normal)</option>
                    <option value="90">90° Clockwise</option>
                    <option value="180">180° Inverted</option>
                    <option value="270">270° Counter-Clockwise</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleCanvasElementUpdate(selectedCanvasItem.id, "width", 85.6);
                      handleCanvasElementUpdate(selectedCanvasItem.id, "height", 54);
                    }}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "none", color: "#cbd5e1", padding: "4px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}
                  >
                    ID (85×54)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCanvasElementUpdate(selectedCanvasItem.id, "width", 35);
                      handleCanvasElementUpdate(selectedCanvasItem.id, "height", 45);
                    }}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "none", color: "#cbd5e1", padding: "4px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}
                  >
                    Passport (35×45)
                  </button>
                </div>

                <button
                  type="button"
                  className="small ghost"
                  style={{ fontSize: "11px", padding: "6px", width: "100%", marginTop: "4px" }}
                  onClick={() => {
                    setCurrentCropImageSrc(selectedCanvasItem.url);
                    setCurrentCropIndex(idElements.findIndex(el => el.id === selectedCanvasItem.id));
                    setCropModalOpen(true);
                  }}
                >
                  ✏️ Open Crop & Rotate Editor (Auto-sizes)
                </button>
              </div>
            ) : (
              <p className="note" style={{ textAlign: "center", padding: "20px 0", fontSize: "12px" }}>
                Click any card on the canvas to inspect or resize.
              </p>
            )}

            <button
              type="button"
              className="small ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: "11px", marginTop: "auto" }}
            >
              ➕ Add more photos
            </button>
          </div>

        </div>
      )}

      {/* Multiple File List for Standard Mode */}
      {uploadedFiles.length > 0 && !isIdLayout && (
        <div style={{ margin: "14px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="note" style={{ margin: 0 }}>Uploaded files & specific page selections:</p>
            <button
              type="button"
              className="small ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: "12px" }}
            >
              ➕ Add more PDFs/Images
            </button>
          </div>

          {uploadedFiles.map((item, index) => (
            <div key={index} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>📄 {item.file.name}</strong>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="note">{item.pageCount} page(s)</span>
                  <button
                    type="button"
                    className="small ghost"
                    style={{ color: "#ef4444", fontSize: "11px", padding: "2px 6px" }}
                    onClick={() => removeFile(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Pages to print e.g. 1-3, 5 (leave blank = all pages)"
                value={item.pageRange}
                onChange={(e) => handleFileRangeChange(index, e.target.value)}
                style={{ fontSize: "13px", padding: "6px" }}
              />
              {item.rangeError && <span className="error" style={{ fontSize: "12px" }}>{item.rangeError}</span>}
            </div>
          ))}
        </div>
      )}

      {counting && <p className="note">Processing and compiling your files...</p>}
      {file && (
        <p className="note">
          ✓ Total compiled pages: <strong>{form.pages}</strong>
        </p>
      )}

      {rangeError && <p className="error">{rangeError}</p>}
      {file && !rangeError && !hasAnyFileError && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0", background: "rgba(99, 102, 241, 0.08)", padding: "10px", borderRadius: "8px" }}>
          <p className="note" style={{ margin: 0 }}>
            Printing <strong>{printPages}</strong> of {form.pages} page(s)
          </p>
          <button
            type="button"
            className="small ghost"
            onClick={generateSelectedPagesPreview}
            style={{ fontSize: "12px" }}
          >
            👁️ Preview Selected Pages
          </button>
        </div>
      )}

      <h3>3. Print Options</h3>
      <div className="row">
        <label>
          Copies
          <input
            type="number"
            min="1"
            name="copies"
            value={form.copies}
            onChange={handleChange}
            required
          />
        </label>
        {sizes.length > 1 && (
          <label>
            Paper Size
            <select name="size" value={form.size} onChange={handleChange}>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="check">
        <input type="checkbox" name="color" checked={form.color} onChange={handleChange} />
        Color Print
      </label>

      <h3>4. Finishing</h3>
      <label className="check">
        <input type="checkbox" name="stapling" checked={form.stapling} onChange={handleChange} />
        Stapling
      </label>
      <label className="check">
        <input type="checkbox" name="binding" checked={form.binding} onChange={handleChange} />
        Spiral Binding
      </label>
      <label className="check">
        <input type="checkbox" name="urgent" checked={form.urgent} onChange={handleChange} />
        Urgent Priority
      </label>

      <div className="price">
        <span>Estimated price</span>
        <strong>₹{price}</strong>
      </div>

      <h3>5. Payment Method</h3>
      <div className="row">
        <label>
          Payment Status / Mode
          <select name="payment" value={form.payment} onChange={handleChange}>
            <option value="cash">Paid via Cash</option>
            <option value="upi">Paid via UPI</option>
            <option value="">Pay Later / Unpaid</option>
          </select>
        </label>
      </div>

      <label>
        Note for Counter Staff (optional)
        <textarea
          name="note"
          value={form.note}
          onChange={handleChange}
          maxLength={300}
          rows={2}
          placeholder="e.g. Customer waiting at counter"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading || counting || Boolean(rangeError) || hasAnyFileError} style={{ marginTop: "16px" }}>
        {loading ? "Creating order..." : `Create Walk-in Order (₹{price})`}
      </button>

      {/* Selected Pages Preview Modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Selected Pages Preview">
        <div className="modal-body" style={{ width: "100%", maxWidth: "700px", height: "80vh" }}>
          <p className="note" style={{ marginBottom: "10px" }}>
            Previewing exactly {printPages} page(s) matching your counter print range configuration.
          </p>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="Selected Pages Preview"
              style={{ width: "100%", height: "calc(100% - 60px)", border: "none", borderRadius: "8px" }}
            />
          ) : (
            <p>Generating preview...</p>
          )}
          <button type="button" className="ghost" onClick={() => setPreviewOpen(false)} style={{ marginTop: "10px" }}>
            Close Preview
          </button>
        </div>
      </Modal>

      {/* Image Crop Modal */}
      <ImageCropModal
        open={cropModalOpen}
        imageSrc={currentCropImageSrc}
        aspect={undefined}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </form>
  );
}