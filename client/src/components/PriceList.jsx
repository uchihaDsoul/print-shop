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

  const a4Photo = data.photo && data.photo.a4;
  const sizes = data.photoSizes
    ? Object.entries(data.photoSizes).filter(([key, s]) => s.enabled)
    : [];

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

      {/* Smart ID Card Layout Mode Pricing */}
      {(data.idCardBw !== undefined || data.idCardColor !== undefined) && (
        <>
          <h3>Smart ID Card Layout Mode</h3>
          <table className="rates">
            <thead>
              <tr>
                <th>Layout</th>
                <th>Black &amp; white</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ID Card Grid Sheet</td>
                <td>₹{data.idCardBw ?? 10} / sheet</td>
                <td>₹{data.idCardColor ?? 20} / sheet</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

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

      {(a4Photo || sizes.length > 0) && (
        <>
          <h3>Photo prints</h3>
          <table className="rates">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Black &amp; white</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {a4Photo && (
                <tr>
                  <td>Full A4 photo</td>
                  <td>₹{a4Photo.bw} / sheet</td>
                  <td>₹{a4Photo.color} / sheet</td>
                </tr>
              )}
              {sizes.map(([key, s]) => (
                <tr key={key}>
                  <td>Passport {s.label}</td>
                  <td>₹{s.bw} / photo</td>
                  <td>₹{s.color} / photo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}