import { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Modal from "./Modal";

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export default function ImageCropModal({ open, imageSrc, aspect, onClose, onCropComplete }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const imgRef = useRef(null);

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  function handleReset() {
    setRotation(0);
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  function handleRotate() {
    setRotation((prev) => (prev + 90) % 360);
  }

  async function handleSave() {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Handle dimensions based on rotation
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    if (rotation === 90 || rotation === 270) {
      canvas.width = cropHeight;
      canvas.height = cropWidth;
    } else {
      canvas.width = cropWidth;
      canvas.height = cropHeight;
    }

    ctx.save();
    // Translate and rotate around the center for canvas export
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cropWidth / 2, -cropHeight / 2);

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error("Canvas is empty");
          return;
        }
        const croppedFile = new File([blob], "cropped-rotated-image.jpg", { type: "image/jpeg" });
        onCropComplete(croppedFile);
        onClose();
      },
      "image/jpeg",
      0.95,
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Crop, Rotate & Frame Image">
      <div className="modal-body" style={{ textAlign: "center" }}>
        <p className="note">Rotate or drag corners to frame your photo correctly.</p>
        
        {imageSrc && (
          <div style={{ margin: "16px 0", maxHeight: "60vh", overflow: "auto", position: "relative" }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{
                  maxHeight: "50vh",
                  display: "block",
                  margin: "0 auto",
                  transform: `rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease",
                }}
              />
            </ReactCrop>
          </div>
        )}

        <div className="actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="small ghost" onClick={handleRotate}>
              🔄 Rotate 90°
            </button>
            <button type="button" className="small ghost" onClick={handleReset}>
              Reset
            </button>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" className="small ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="small" onClick={handleSave}>
              Apply & Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}