import { useState, useEffect } from "react";
import { getRates, placeWalkInOrder, countPages, getPublicSettings } from "../../api";
import { compileIdCardsToA4Pdf } from "../../utils/idCardCompiler";
import ImageCropModal from "../../components/ImageCropModal";
import useRates from "../../useRates";

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
  paymentStatus: "paid",
};

export default function WalkinTab() {
  const rates = useRates();
  const sizes = rates?.enabledSizes || ["A4"];

  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [counting, setCounting] = useState(false);
  const [price, setPrice] = useState(0);
  const [printPages, setPrintPages] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState(null);
  
  const [isIdLayout, setIsIdLayout] = useState(false);
  const [cardsPerPage, setCardsPerPage] = useState(2);

  // Cropping States
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropImageSrc, setCurrentCropImageSrc] = useState(null);
  const [currentCropIndex, setCurrentCropIndex] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    
    // Strictly restrict phone number to 10 positive digits only
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

  async function handleFile(e) {
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

    setSelectedFiles(chosenFiles);
    await processAndCompileFiles(chosenFiles, isIdLayout, cardsPerPage);
    e.target.value = "";
  }

  async function processAndCompileFiles(filesToProcess, idMode, perPage) {
    setCounting(true);
    try {
      let finalFile = filesToProcess[0];

      if (idMode && filesToProcess.length > 1 && filesToProcess.every(f => f.type.startsWith("image/"))) {
        const compiledBlob = await compileIdCardsToA4Pdf(filesToProcess, perPage);
        finalFile = new File([compiledBlob], "smart-id-layout.pdf", { type: "application/pdf" });
      }

      const { pages } = await countPages(finalFile);
      setFile(finalFile);
      setForm((prev) => ({ ...prev, pages }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCounting(false);
    }
  }

  async function handleCropComplete(croppedFile) {
    const updatedFiles = [...selectedFiles];
    updatedFiles[currentCropIndex] = croppedFile;
    setSelectedFiles(updatedFiles);
    await processAndCompileFiles(updatedFiles, isIdLayout, cardsPerPage);
  }

  async function handleMove(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedFiles.length) return;
    const updatedFiles = [...selectedFiles];
    const temp = updatedFiles[index];
    updatedFiles[index] = updatedFiles[newIndex];
    updatedFiles[newIndex] = temp;
    setSelectedFiles(updatedFiles);
    await processAndCompileFiles(updatedFiles, isIdLayout, cardsPerPage);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Ensure backend schema requirement for customerName is always met
      const submissionForm = {
        ...form,
        customerName: form.customerName.trim() || "Walk-In Customer",
      };

      const order = await placeWalkInOrder(submissionForm, file);
      setSuccessOrder(order);
      setForm(initialForm);
      setFile(null);
      setSelectedFiles([]);
      setFileKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Create Walk-In Order (Counter)</h2>
      {successOrder && (
        <div className="success-banner" style={{ background: "rgba(16, 185, 129, 0.1)", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
          <p>✓ Order <strong>{successOrder.trackingCode}</strong> created successfully! Status: Queued for print.</p>
          <button type="button" className="small" onClick={() => setSuccessOrder(null)}>Create Another</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h3>1. Customer Details</h3>
        <div className="row">
          <label>
            Customer Name
            <input 
              name="customerName" 
              value={form.customerName} 
              onChange={handleChange} 
              placeholder="Leave blank for 'Walk-In Customer'" 
            />
          </label>
          <label>
            Phone Number (10 digits)
            <input 
              name="phone" 
              value={form.phone} 
              onChange={handleChange} 
              placeholder="e.g. 9876543210" 
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              title="Enter exactly 10 digits"
            />
          </label>
        </div>

        <h3>2. Files & Smart Layout</h3>
        
        <label className="check" style={{ marginBottom: "12px", background: "rgba(99, 102, 241, 0.08)", padding: "10px", borderRadius: "8px" }}>
          <input 
            type="checkbox" 
            checked={isIdLayout} 
            onChange={async (e) => {
              const val = e.target.checked;
              setIsIdLayout(val);
              setFile(null);
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
                  await processAndCompileFiles(selectedFiles, true, perPage);
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
          {isIdLayout ? "Upload ID Images (Front & Back)" : "Select Document / Image"}
          <input
            key={fileKey}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple={isIdLayout}
            onChange={handleFile}
            required={!file}
          />
        </label>

        {/* Thumbnail Preview with Reorder, Rotate & Crop triggers */}
        {selectedFiles.length > 0 && selectedFiles[0]?.type?.startsWith("image/") && (
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

        {counting && <p className="note">Processing and compiling layout...</p>}
        {file && (
          <p className="note">
            ✓ {file.name}: <strong>{form.pages}</strong> page(s) ready
          </p>
        )}

        <h3>3. Print Options</h3>
        <div className="row">
          <label>
            Copies
            <input type="number" min="1" name="copies" value={form.copies} onChange={handleChange} required />
          </label>
          <label>
            Color Print
            <input type="checkbox" name="color" checked={form.color} onChange={handleChange} />
          </label>
        </div>

        <button type="submit" disabled={loading || counting || !file}>
          {loading ? "Creating Order..." : "Create Walk-In Order & Print"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {/* Image Crop & Rotate Modal */}
      <ImageCropModal
        open={cropModalOpen}
        imageSrc={currentCropImageSrc}
        aspect={isIdLayout ? 85.6 / 53.98 : undefined}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}