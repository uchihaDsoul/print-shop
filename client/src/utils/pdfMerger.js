import { PDFDocument } from 'pdf-lib';

export async function mergePdfsToSingle(fileList) {
  const mergedPdf = await PDFDocument.create();
  const filePageOffsets = [];
  let currentPageOffset = 0;

  for (const file of fileList) {
    const arrayBuffer = await file.arrayBuffer();
    let filePageCount = 0;
    
    if (file.type === "application/pdf") {
      const pdf = await PDFDocument.load(arrayBuffer);
      filePageCount = pdf.getPageCount();
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPages().map((_, i) => i));
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } else if (file.type.startsWith("image/")) {
      filePageCount = 1;
      const page = mergedPdf.addPage([595.28, 841.89]); // A4 size
      let embeddedImage;
      if (file.type === "image/png") {
        embeddedImage = await mergedPdf.embedPng(arrayBuffer);
      } else {
        embeddedImage = await mergedPdf.embedJpg(arrayBuffer);
      }
      
      const dims = embeddedImage.scaleToFit(515, 761);
      page.drawImage(embeddedImage, {
        x: (595.28 - dims.width) / 2,
        y: (841.89 - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    }

    filePageOffsets.push({
      start: currentPageOffset + 1,
      end: currentPageOffset + filePageCount,
      offset: currentPageOffset,
      pageCount: filePageCount,
    });

    currentPageOffset += filePageCount;
  }

  const pdfBytes = await mergedPdf.save();
  const mergedFile = new File([pdfBytes], "merged-documents.pdf", { type: "application/pdf" });

  return { mergedFile, filePageOffsets };
}