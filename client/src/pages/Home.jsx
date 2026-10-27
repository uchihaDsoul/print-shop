import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRates, getQuote } from "../api";
import { SHOP } from "../shopConfig";

const Icon = ({ children }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export default function Home() {
  const [rates, setRates] = useState(null);
  const [est, setEst] = useState({ pages: 20, copies: 1, size: "A4", color: false, doubleSided: true });
  const [price, setPrice] = useState(0);

  useEffect(() => {
    getRates().then(setRates).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      getQuote(est)
        .then((d) => !cancelled && setPrice(d.price))
        .catch(() => !cancelled && setPrice(0));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [est]);

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setEst((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const bw = rates?.rates?.A4?.bw;
  const color = rates?.rates?.A4?.color;
  const whatsapp = `https://wa.me/${SHOP.phone}?text=${encodeURIComponent("Hi, I have a question about printing.")}`;

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-text">
          <span className="glass-s pill">Walk in or order online</span>
          <h1>
            Upload it.<br />We print it.<br />
            <span className="grad-text">Pick it up.</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.6, maxWidth: 480 }}>
            Upload your file, choose paper and finish, and see the price instantly. Pay at the counter when you collect.
          </p>
          <div className="btn-row">
            <Link className="btn btn-lg" to="/order">Upload &amp; print</Link>
            <a className="btn btn-lg ghost" href="#pricing">Estimate cost</a>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-box">
            <div className="c1" />
            <div className="c2" />
            <div className="glass panel">
              <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
              </svg>
              <b>Drop your PDF here</b>
              <span className="muted" style={{ fontSize: 13 }}>PDF · JPG · PNG</span>
            </div>
            <div className="glass-s status"><span className="dot-ok" /> Ready for pickup</div>
          </div>
        </div>
      </section>

      <section id="services">
        <div className="sec-head">
          <h2>What we print</h2>
          <p className="muted">Pick what you need.</p>
        </div>
        <div className="services">
          <Link to="/order" className="glass service">
            <div className="ico">
              <Icon><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Icon>
            </div>
            <h3>Document printing</h3>
            <p className="muted">B/W and colour, single or double sided, A4 and A3.</p>
            {bw != null && <span className="from">From ₹{bw} / page</span>}
          </Link>
          <Link to="/order" className="glass service">
            <div className="ico">
              <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.7-1.5 2-2 3-2s2.3.5 3 2" /></Icon>
            </div>
            <h3>Photo and image prints</h3>
            <p className="muted">Upload a JPG or PNG and print it on A4 or A3.</p>
            {color != null && <span className="from">Colour from ₹{color} / page</span>}
          </Link>
          <Link to="/order" className="glass service">
            <div className="ico">
              <Icon><path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4z" /><path d="M8 9h8M8 13h5" /></Icon>
            </div>
            <h3>Binding and stapling</h3>
            <p className="muted">Spiral binding and stapling for reports and notes.</p>
            {rates?.extras && <span className="from">Binding ₹{rates.extras.binding} / copy</span>}
          </Link>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="glass service">
            <div className="ico">
              <Icon><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" /></Icon>
            </div>
            <h3>Something custom?</h3>
            <p className="muted">Banners, cards, mugs or anything else. Message us for a quote.</p>
            <span className="from">Ask on WhatsApp</span>
          </a>
        </div>
      </section>

      <section id="pricing" className="glass estimator">
        <div className="left">
          <div className="sec-head">
            <h2>Pricing estimator</h2>
            <p className="muted">Get a quick estimate before you upload.</p>
          </div>
          <div className="grid2">
            <label>Pages<input type="number" min="1" name="pages" value={est.pages} onChange={set} /></label>
            <label>Copies<input type="number" min="1" name="copies" value={est.copies} onChange={set} /></label>
          </div>
          <div className="grid2">
            <label>Paper size
              <select name="size" value={est.size} onChange={set}><option>A4</option><option>A3</option></select>
            </label>
            <label>Colour
              <select value={est.color ? "c" : "b"} onChange={(e) => setEst((p) => ({ ...p, color: e.target.value === "c" }))}>
                <option value="b">Black &amp; white</option>
                <option value="c">Full colour</option>
              </select>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" name="doubleSided" checked={est.doubleSided} onChange={set} />
            Double sided
          </label>
        </div>
        <div className="right">
          <div className="est-card">
            <span style={{ fontSize: 14, fontWeight: 700 }}>Estimated total</span>
            <span className="total">₹{price}</span>
            <span style={{ fontSize: 14 }}>
              {est.pages} pages × {est.copies} copies · {est.size} · {est.color ? "Colour" : "B/W"}
            </span>
            <Link to="/order" className="btn btn-white btn-lg" style={{ marginTop: 8 }}>Continue to upload</Link>
          </div>
        </div>
      </section>

      <section id="visit" className="visit">
        <div>
          <div className="sec-head"><h2>Visit the shop</h2></div>
          <div className="glass" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 26, marginTop: 28 }}>
            <div className="info-block">
              <div className="ico"><Icon><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></Icon></div>
              <div><b>Address</b><p className="muted" style={{ marginTop: 4 }}>{SHOP.address}</p></div>
            </div>
            <div className="info-block">
              <div className="ico"><Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon></div>
              <div><b>Opening hours</b><p className="muted" style={{ marginTop: 4 }}>{SHOP.hours}</p></div>
            </div>
            <div className="btn-row">
              <a className="btn" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
              <a className="btn ghost" href={`tel:+${SHOP.phone}`}>Call</a>
              <a className="btn ghost" href={SHOP.mapsLink} target="_blank" rel="noreferrer">Directions</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}