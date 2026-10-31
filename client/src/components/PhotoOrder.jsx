import { useState } from "react";

// onPlaced(order) will open the payment popup once the upload screens exist
export default function PhotoOrder({ onPlaced }) {
  const [kind, setKind] = useState("a4"); // "a4" or "passport"

  return (
    <div className="card">
      <h3>1. Choose the photo type</h3>
      <div className="choice-grid">
        <button
          type="button"
          className={"choice" + (kind === "a4" ? " on" : "")}
          onClick={() => setKind("a4")}
        >
          Full A4 photo
          <small>Up to 10 photos, each with its own copies. One A4 sheet per photo.</small>
        </button>
        <button
          type="button"
          className={"choice" + (kind === "passport" ? " on" : "")}
          onClick={() => setKind("passport")}
        >
          Passport photos
          <small>One photo cut into 35 x 45 mm or 51 x 51 mm pieces.</small>
        </button>
      </div>

      {kind === "a4" && (
        <p className="note">
          Fill crops the edges to cover the paper. Fit keeps the whole photo with white margins.
        </p>
      )}
      {kind === "passport" && (
        <p className="note">
          Use a plain, light background with your face straight ahead. The shop prints what you
          upload and can't promise that any office or embassy will accept it.
        </p>
      )}

      <p className="note">The photo upload screen arrives in the next step.</p>
    </div>
  );
}