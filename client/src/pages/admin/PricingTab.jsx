import { useEffect, useState } from "react";
import { getRates } from "../../api";
import { rupees } from "../../format";

export default function PricingTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getRates()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <header className="page-head">
        <h1>Pricing</h1>
      </header>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="note">Loading...</p>}

      {data && (
        <>
          <section className="grid-3">
            {Object.entries(data.rates).map(([size, r]) => (
              <div className="tile" key={size}>
                <span className="av">{size}</span>
                <h3>{size} paper</h3>
                <div className="price-line">
                  <span>Black and white</span>
                  <strong>
                    {rupees(r.bw)} <small>/ page</small>
                  </strong>
                </div>
                <div className="price-line">
                  <span>Color</span>
                  <strong>
                    {rupees(r.color)} <small>/ page</small>
                  </strong>
                </div>
              </div>
            ))}

            <div className="tile">
              <span className="av">+</span>
              <h3>Extras</h3>
              <div className="price-line">
                <span>Stapling</span>
                <strong>
                  {data.extras?.stapling ? rupees(data.extras.stapling) : "Free"} <small>/ copy</small>
                </strong>
              </div>
              <div className="price-line">
                <span>Spiral binding</span>
                <strong>
                  {rupees(data.extras?.binding)} <small>/ copy</small>
                </strong>
              </div>
              <div className="price-line">
                <span>Urgent</span>
                <strong>
                  {rupees(data.extras?.urgent)} <small>/ order</small>
                </strong>
              </div>
            </div>
          </section>

          <p className="note">
            Double-sided printing: {data.doubleSidedDiscountPercent}% off. To change prices, edit
            <code> server/utils/pricing.js</code> for now. Editing from this page comes in the next step.
          </p>
        </>
      )}
    </>
  );
}