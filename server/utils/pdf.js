const { PDFDocument } = require("pdf-lib");

async function countPages(file) {
  if (file.mimetype === "application/pdf") {
    const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  }
  return 1; // an image is one page
}

module.exports = { countPages };