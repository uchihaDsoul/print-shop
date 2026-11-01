// One readable line describing what an order is, for staff pages
const SIZE_LABEL = {
  "35x45": "35 x 45 mm",
  "35x35": "35 x 35 mm",
  "51x51": "2 x 2 inch",
  "25x35": "25 x 35 mm",
};

export function orderSummary(o) {
  const color = o.color ? "Color" : "B/W";

  if (o.orderType === "passport") {
    const parts = [
      `Passport photos ${SIZE_LABEL[o.passportSize] || o.passportSize}`,
      `${o.passportPieces} piece${o.passportPieces === 1 ? "" : "s"}`,
      color,
    ];
    if (o.passportPaper) parts.push(`on ${o.passportPaper === "4x6" ? "4 x 6 inch" : "A4"} paper`);
    return parts.join(" · ");
  }

  if (o.orderType === "photo_a4") {
    const sheets = o.printPages || o.pages;
    return `A4 photo print · ${sheets} sheet${sheets === 1 ? "" : "s"} · ${color}`;
  }

  return (
    `${o.printPages || o.pages} of ${o.pages} pages` +
    (o.pageRange ? ` (${o.pageRange})` : "") +
    ` × ${o.copies} · ${o.size} · ${color} · ${o.doubleSided ? "Double" : "Single"}-sided`
  );
}