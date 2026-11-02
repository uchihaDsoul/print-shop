import { PDFDocument } from 'pdf-lib';

export async function compileIdCardsToA4Pdf(imageFiles, cardsPerPage = 2) {
  const pdfDoc = await PDFDocument.create();
  
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  
  // Standard ID card size in points (~85.6mm x 53.98mm)
  const ID_WIDTH = 242; 
  const ID_HEIGHT = 153;
  
  const MARGIN_X = 50;
  const MARGIN_Y = 50;
  const GAP_X = 30;
  const GAP_Y = 30;
  
  const COLS = 2;
  const ROWS = cardsPerPage === 2 ? 1 : Math.ceil(cardsPerPage / COLS);
  const CARDS_PER_PAGE = COLS * ROWS;

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let cardCount = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    
    if (cardCount > 0 && cardCount % CARDS_PER_PAGE === 0) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    }

    const indexOnPage = cardCount % CARDS_PER_PAGE;
    const col = indexOnPage % COLS;
    const row = Math.floor(indexOnPage / COLS);

    const x = MARGIN_X + col * (ID_WIDTH + GAP_X);
    const y = A4_HEIGHT - MARGIN_Y - (row + 1) * ID_HEIGHT - row * GAP_Y;

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
      width: ID_WIDTH,
      height: ID_HEIGHT,
    });

    cardCount++;
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}