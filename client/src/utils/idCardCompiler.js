import { PDFDocument } from 'pdf-lib';

export async function compileIdCardsToA4Pdf(elements, cardsPerPage = 2) {
  const pdfDoc = await PDFDocument.create();
  
  // A4 dimensions in points (1 mm = 2.83465 points)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MM_TO_POINTS = 2.83465;

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  // Check if elements are custom layout objects with x, y, width, height, rotation
  const isCustomLayout = elements.length > 0 && typeof elements[0] === 'object' && ('x' in elements[0] || 'width' in elements[0]);

  for (let i = 0; i < elements.length; i++) {
    let file, xMm, yMm, widthMm, heightMm, rotation;

    if (isCustomLayout) {
      const el = elements[i];
      file = el.file;
      xMm = el.x ?? 15;
      yMm = el.y ?? 15;
      widthMm = el.width ?? 85.6;
      heightMm = el.height ?? 54;
      rotation = el.rotation ?? 0;
    } else {
      // Fallback for plain File objects array
      file = elements[i];
      const COLS = 2;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      
      if (i > 0 && i % (COLS * 2) === 0) {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      }
      
      xMm = 20 + (col * 95);
      yMm = 20 + (row * 65);
      widthMm = 85.6;
      heightMm = 54;
      rotation = 0;
    }

    // Convert millimeters to PDF points
    const x = xMm * MM_TO_POINTS;
    const width = widthMm * MM_TO_POINTS;
    const height = heightMm * MM_TO_POINTS;
    
    // PDF coordinate system origin is bottom-left, so invert Y axis from top-left mm
    const y = A4_HEIGHT - (yMm * MM_TO_POINTS) - height;

    const arrayBuffer = await file.arrayBuffer();
    let embeddedImage;
    
    if (file.type === "image/png") {
      embeddedImage = await pdfDoc.embedPng(arrayBuffer);
    } else {
      embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
    }

    page.drawImage(embeddedImage, {
      x,
      y,
      width,
      height,
      rotate: { type: 'degrees', angle: Number(rotation) || 0 },
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}