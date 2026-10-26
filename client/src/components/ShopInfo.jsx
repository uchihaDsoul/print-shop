import { SHOP } from "../shopConfig";

export default function ShopInfo() {
  const whatsapp = `https://wa.me/${SHOP.phone}?text=${encodeURIComponent("Hi, I have a question about printing.")}`;

  return (
    <div className="card">
      <h2>Visit us</h2>
      <p className="info-line">📍 {SHOP.address}</p>
      <p className="info-line">🕘 {SHOP.hours}</p>
      <div className="btn-row">
        <a className="btn" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="btn ghost-link" href={`tel:+${SHOP.phone}`}>Call</a>
        <a className="btn ghost-link" href={SHOP.mapsLink} target="_blank" rel="noreferrer">Directions</a>
      </div>
    </div>
  );
}