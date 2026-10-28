import { useEffect, useState } from "react";
import { getRates } from "../api";

export default function PriceList() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getRates()
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="card">
      <h2>Price list</h2>
      <table className="rates">
        <thead>
          <tr>
            <th>Size</th>
            <th>Black &amp; white</th>
            <th>Color</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.rates)
            .filter(([size]) => (data.enabledSizes || ["A4"]).includes(size))
            .map(([size, r]) => (
              <tr key={size}>
                <td>{size}</td>
                <td>₹{r.bw} / page</td>
                <td>₹{r.color} / page</td>
              </tr>
            ))}
        </tbody>
      </table>
      {data.doubleSidedDiscountPercent > 0 && (
        <p className="note">
          Double-sided printing: {data.doubleSidedDiscountPercent}% off.
        </p>
      )}

      {data.extras && (
        <>
          <h3>Extras</h3>
          <p className="note">
            Stapling:{" "}
            {data.extras.stapling
              ? `₹${data.extras.stapling} per copy`
              : "free"}{" "}
            · Spiral binding: ₹{data.extras.binding} per copy · Urgent: ₹
            {data.extras.urgent} per order
          </p>
        </>
      )}
    </div>
  );
}
