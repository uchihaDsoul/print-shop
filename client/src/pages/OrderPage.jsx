import { useState, useRef, useEffect } from "react";
import { getQuote, placeOrder, countPages, trackOrder, getPublicSettings } from "../api";
import { compileIdCardsToA4Pdf } from "../utils/idCardCompiler";
import { mergePdfsToSingle } from "../utils/pdfMerger";
import PriceList from "../components/PriceList";
import ShopInfo from "../components/ShopInfo";
import PaymentPanel from "../components/PaymentPanel";
import PhotoOrder from "../components/PhotoOrder";
import Modal from "../components/Modal";
import ImageCropModal from "../components/ImageCropModal";
import useRates from "../useRates";
import { statusLabel } from "../statusMeta";
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
  note: "",
};

const HEADLINE = {
  awaiting_confirmation: "Sent to the shop",
  queued: "Payment confirmed",
  printing: "Printing now",
  printed: "Printed, being checked",
  print_failed: "Printing problem, the shop is fixing it",
  ready: "Ready for pickup",
  collected: "Collected, thank you",
  rejected: "Payment not accepted",
  cancelled: "Order cancelled",
};

export default function OrderPage() {
  const rates = useRates();
  const sizes = rates?.enabledSizes || ["A4"];
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("paper"); 
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); 
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null); 
  const [orderCode, setOrderCode] = useState(""); 
  const [showPay, setShowPay] = useState(false); 
  const [copied, setCopied] = useState(false);
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [isIdLayout, setIsIdLayout] = useState(false);
  const [cardsPerPage, setCardsPerPage] = useState(2);

  // Multi-File & Per-file Page Ranges + Validation
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [fileOffsets, setFileOffsets] = useState([]);

  // Cropping States
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropImageSrc, setCurrentCropImageSrc] = useState(null);
  const [currentCropIndex, setCurrentCropIndex] = useState(null);
  
  const [publicSettings, setPublicSettings] = useState({
    guestShowPaper: true,
    guestShowPhoto: true,
    guestShowStapling: true,
    guestShowBinding: true,
    guestShowUrgent: true,
    guestShowDoubleSided: false,
    guestShowCash: true,
    guestShowUPI: true,
  });

  useEffect(() => {
    getPublicSettings()
      .then((data) => {
        if (data && typeof data.guestShowPaper !== 'undefined') {
          setPublicSettings(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load settings from server:", err);
      });
  }, []);

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
        const compiledBlob = await compileIdCardsToA4Pdf(combinedSelected, cardsPerPage);
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

  async function handleCropComplete(croppedFile) {
    const updatedFiles = [...selectedFiles];
    updatedFiles[currentCropIndex] = croppedFile;
    setSelectedFiles(updatedFiles);
    
    const compiledBlob = await compileIdCardsToA4Pdf(updatedFiles, cardsPerPage);
    const finalFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
    const { pages } = await countPages(finalFile);
    setFile(finalFile);
    setForm((prev) => ({ ...prev, pages }));
  }

  async function handleMove(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedFiles.length) return;
    const updatedFiles = [...selectedFiles];
    const temp = updatedFiles[index];
    updatedFiles[index] = updatedFiles[newIndex];
    updatedFiles[newIndex] = temp;
    setSelectedFiles(updatedFiles);

    const compiledBlob = await compileIdCardsToA4Pdf(updatedFiles, cardsPerPage);
    const finalFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
    const { pages } = await countPages(finalFile);
    setFile(finalFile);
    setForm((prev) => ({ ...prev, pages }));
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

  function updatePlaced(next) {
    setPlaced((prev) => ({
      ...prev,
      ...next,
      trackingCode: next?.trackingCode || prev?.trackingCode,
    }));
  }

  useEffect(() => {
    if (!placed) return;
    if (["collected", "rejected", "cancelled"].includes(placed.status)) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      trackOrder(placed.trackingCode || orderCode)
        .then(updatePlaced)
        .catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, [placed?.trackingCode, placed?.status, orderCode]);

  function openPayment(order) {
    setOrderCode(order?.trackingCode || "");
    setPlaced(order);
    try {
      if (order?.trackingCode) localStorage.setItem("lastTrack", order.trackingCode);
    } catch {}
    setShowPay(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const submissionForm = {
        ...form,
        customerName: form.customerName.trim() || "Guest Customer",
        isIdLayout,
      };

      const order = await placeOrder(submissionForm, file);
      openPayment(order);
      setForm(initialForm);
      setFile(null);
      setUploadedFiles([]);
      setSelectedFiles([]);
      setFileKey((k) => k + 1);
      setPrice(0);
      setPrintPages(0);
      setRangeError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    setShowPay(false);
    if (placed && ["collected", "rejected", "cancelled"].includes(placed.status)) {
      setPlaced(null);
      setOrderCode("");
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const shownCode = placed?.trackingCode || orderCode;
  const paying = placed?.status === "awaiting_payment";

  const hasAnyFileError = uploadedFiles.some((item) => Boolean(item.rangeError));

  return (
    <>
      <div className="hero">
        <h2>Print in minutes</h2>
        <p>Upload your file, pick your options, collect it at the shop.</p>
      </div>

      {placed && !showPay && (
        <div className="card pending-order">
          <div>
            <strong>Order {shownCode}</strong>
            <div className="note">
              {paying
                ? "Waiting for your payment"
                : HEADLINE[placed.status] || statusLabel(placed.status)}
            </div>
          </div>
          <div className="actions">
            <button type="button" className="small" onClick={() => setShowPay(true)}>
              {paying ? "Pay now" : "View"}
            </button>
            {!paying && (
              <button
                type="button"
                className="small ghost"
                onClick={() => {
                  setPlaced(null);
                  setOrderCode("");
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {publicSettings && (publicSettings.guestShowPaper || publicSettings.guestShowPhoto) ? (
        <div className="card">
          <h3>What would you like to print?</h3>
          <div className="choice-grid">
            {publicSettings.guestShowPaper && (
              <button
                type="button"
                className={"choice" + (mode === "paper" ? " on" : "")}
                onClick={() => setMode("paper")}
              >
                Paper print
                <small>Documents, PDFs, notes and images</small>
              </button>
            )}
            {publicSettings.guestShowPhoto && (
              <button
                type="button"
                className={"choice" + (mode === "photo" ? " on" : "")}
                onClick={() => setMode("photo")}
              >
                Photo print
                <small>Full A4 photos and passport photos</small>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <h3>Printing is currently paused</h3>
          <p className="note">The shop is not accepting online orders at this moment. Please check back later.</p>
        </div>
      )}

      {mode === "photo" && publicSettings?.guestShowPhoto && <PhotoOrder onPlaced={openPayment} />}

      {mode === "paper" && publicSettings?.guestShowPaper && (
        <form className="card" onSubmit={handleSubmit}>
          <h3>Your details</h3>
          <div className="row">
            <label>
              Your name
              <input
                name="customerName"
                value={form.customerName}
                onChange={handleChange}
                placeholder="Leave blank for 'Guest Customer'"
              />
            </label>
            <label>
              Phone number (10 digits)
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

          <h3>2. Your files</h3>
          
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
                setForm(prev => ({ ...prev, pages: 0 }));
              }} 
            />
            <strong>Smart ID Card Layout Mode</strong> (Automatically arranges multiple ID photos into an A4 card grid)
          </label>

          {isIdLayout && (
            <label style={{ marginBottom: "12px" }}>
              Photos per A4 Page
              <select
                value={cardsPerPage}
                onChange={async (e) => {
                  const perPage = Number(e.target.value);
                  setCardsPerPage(perPage);
                  if (selectedFiles.length > 0) {
                    const compiledBlob = await compileIdCardsToA4Pdf(selectedFiles, perPage);
                    const finalFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
                    const { pages } = await countPages(finalFile);
                    setFile(finalFile);
                    setForm(prev => ({ ...prev, pages }));
                  }
                }}
              >
                <option value={2}>2 Cards per page (Standard Front/Back)</option>
                <option value={4}>4 Cards per page (Compact Sheet)</option>
                <option value={6}>6 Cards per page (Dense Sheet)</option>
              </select>
            </label>
          )}

          <label>
            {isIdLayout ? "Upload multiple ID images (Front & Back)" : "Upload PDF, JPG or PNG (max 20 MB each)"}
            <input
              ref={fileInputRef}
              key={fileKey}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple={true}
              onChange={handleFiles}
              style={{ display: uploadedFiles.length > 0 && !isIdLayout ? "none" : "block" }}
              required={!file}
            />
          </label>

          {/* Multiple File List with Individual Page Range Inputs & Add More Button */}
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

          {/* Staged files thumbnail preview for ID Layout mode */}
          {selectedFiles.length > 0 && isIdLayout && selectedFiles[0]?.type?.startsWith("image/") && (
            <div style={{ margin: "14px 0" }}>
              <p className="note" style={{ marginBottom: "6px" }}>Crop, rotate & arrange photo order:</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                {selectedFiles.map((f, index) => {
                  const previewUrl = URL.createObjectURL(f);
                  return (
                    <div key={index} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                      <img src={previewUrl} alt={`Upload ${index}`} style={{ width: "100%", height: "70px", objectFit: "cover", borderRadius: "4px" }} />
                      
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", gap: "4px" }}>
                        <button
                          type="button"
                          className="small ghost"
                          disabled={index === 0}
                          style={{ fontSize: "10px", padding: "2px 4px", flex: 1 }}
                          onClick={() => handleMove(index, -1)}
                        >
                          ⬅️
                        </button>
                        <button
                          type="button"
                          className="small ghost"
                          disabled={index === selectedFiles.length - 1}
                          style={{ fontSize: "10px", padding: "2px 4px", flex: 1 }}
                          onClick={() => handleMove(index, 1)}
                        >
                          ➡️
                        </button>
                      </div>

                      <button
                        type="button"
                        className="small ghost"
                        style={{ fontSize: "11px", padding: "4px 6px", width: "100%", marginTop: "6px" }}
                        onClick={() => {
                          setCurrentCropImageSrc(previewUrl);
                          setCurrentCropIndex(index);
                          setCropModalOpen(true);
                        }}
                      >
                        ✏️ Crop & Rotate
                      </button>
                    </div>
                  );
                })}
              </div>
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

          <h3>3. Print options</h3>
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
                Paper size
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
            Color print
          </label>

          {(publicSettings?.guestShowStapling || publicSettings?.guestShowBinding || publicSettings?.guestShowUrgent || publicSettings?.guestShowDoubleSided) && (
            <h3>4. Finishing</h3>
          )}
          {publicSettings?.guestShowStapling && (
            <label className="check">
              <input
                type="checkbox"
                name="stapling"
                checked={form.stapling}
                onChange={handleChange}
              />
              Stapling
            </label>
          )}
          {publicSettings?.guestShowBinding && (
            <label className="check">
              <input
                type="checkbox"
                name="binding"
                checked={form.binding}
                onChange={handleChange}
              />
              Spiral binding
            </label>
          )}
          {publicSettings?.guestShowDoubleSided && (
            <label className="check">
              <input
                type="checkbox"
                name="doubleSided"
                checked={form.doubleSided}
                onChange={handleChange}
              />
              Double-sided printing (Assisted flip)
            </label>
          )}
          {publicSettings?.guestShowUrgent && (
            <label className="check">
              <input type="checkbox" name="urgent" checked={form.urgent} onChange={handleChange} />
              Urgent (priority printing)
            </label>
          )}
          <label>
            Note for the shop (optional)
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              maxLength={300}
              rows={3}
              placeholder="e.g. Staple top-left, use thick paper"
            />
          </label>

          <div className="price">
            <span>Estimated price</span>
            <strong>₹{price}</strong>
          </div>

          <p className="note">🔒 Your file is deleted after you collect your prints.</p>
          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            disabled={loading || counting || !file || Boolean(rangeError) || hasAnyFileError}
          >
            {loading ? "Placing order..." : "Place order"}
          </button>
        </form>
      )}

      <PriceList />
      <ShopInfo />

      {/* Selected Pages Preview Modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Selected Pages Preview">
        <div className="modal-body" style={{ width: "100%", maxWidth: "700px", height: "80vh" }}>
          <p className="note" style={{ marginBottom: "10px" }}>
            Previewing exactly {printPages} page(s) matching your print range configuration.
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
        aspect={isIdLayout ? 85.6 / 53.98 : undefined}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />

      <Modal open={Boolean(placed) && showPay} onClose={closeModal} title="Payment">
        {placed && (
          <div className="modal-body">
            {paying ? (
              <>
                <span className="step-label">Almost done</span>
                <h2>Choose how to pay</h2>
                <p>
                  Total to pay: <strong>₹{placed.price}</strong>
                </p>
              </>
            ) : (
              <>
                {["rejected", "cancelled"].includes(placed.status) ? (
                  <div className="tick bad">✕</div>
                ) : (
                  <div className="tick">✓</div>
                )}
                <h2>{HEADLINE[placed.status] || statusLabel(placed.status)}</h2>
              </>
            )}

            <p className="note">Your tracking code:</p>
            {shownCode ? (
              <>
                <p className="code">{shownCode}</p>
                <button type="button" className="small ghost" onClick={() => copyCode(shownCode)}>
                  {copied ? "Copied" : "Copy code"}
                </button>
              </>
            ) : (
              <p className="error">
                The tracking code didn't arrive. Please tell the shop. They can find your order on
                their Orders page.
              </p>
            )}

            {placed.warnings?.length > 0 && (
              <div className="order-note">
                {placed.warnings.map((w) => (
                  <div key={w}>⚠ {w}</div>
                ))}
              </div>
            )}

            {placed.status === "rejected" && placed.rejectReason && (
              <p className="error">{placed.rejectReason}</p>
            )}

            <PaymentPanel order={{ ...placed, trackingCode: shownCode }} onUpdate={updatePlaced} settings={publicSettings} />

            {paying ? (
              <p className="note">
                Your order is saved. If you close this window, tap <strong>Pay now</strong> on
                the page, or pay later from Track order with this code.
              </p>
            ) : (
              <button type="button" className="ghost" onClick={closeModal}>
                Done
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}