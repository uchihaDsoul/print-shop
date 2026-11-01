import { useEffect, useState } from "react";
import { getPaper, setPaper, getPricingAdmin } from "../../adminApi";

const DRY_SECONDS = 60; // photo prints need time to dry before they are handled
const PASSPORT_PAPER = { a4: "A4 sheet", "4x6": "4 x 6 inch" };

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// The Ready button for photo orders stays locked while the print dries
export function ReadyButton({ order, busy, onClick }) {
  const now = useNow();
  const isPhoto = order.orderType && order.orderType !== "document";
  const left =
    isPhoto && order.printedAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(order.printedAt).getTime() + DRY_SECONDS * 1000 - now) /
              1000,
          ),
        )
      : 0;
  return (
    <button className="small" disabled={busy || left > 0} onClick={onClick}>
      {left > 0 ? `Drying ${left}s` : "Ready"}
    </button>
  );
}

export default function PaperCards() {
  const [state, setState] = useState(null);
  const [choice, setChoice] = useState("a4");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [papers, setPapers] = useState(null);

  async function load() {
    try {
      setState(await getPaper());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getPricingAdmin()
      .then((p) => setPapers(p.papers))
      .catch(() => {});
  }, []);

  async function choose(paper, passportPaper) {
    setError("");
    setBusy(true);
    try {
      await setPaper(paper, passportPaper);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const { loaded, counts, passportSheets } = state;
  const left = {
    photo_a4: counts.photo_a4.queued + counts.photo_a4.printing,
    passport: counts.passport.queued + counts.passport.printing,
  };

  const label =
    loaded === "plain"
      ? "Plain paper"
      : loaded === "photo_a4"
        ? "A4 photo paper"
        : `Passport paper (${PASSPORT_PAPER[state.passportPaper]})`;

  return (
    <div>
      <p className="ph-muted">
        Paper the shop says is in the printer: <strong>{label}</strong>
      </p>
      {error && <p className="ph-error">{error}</p>}

      {counts.photo_a4.queued > 0 && loaded !== "photo_a4" && (
        <div className="ph-card ph-code">
          <strong>A4 photo orders waiting: {counts.photo_a4.queued}</strong>
          <p className="ph-muted">
            Load A4 photo paper (glossy side up as your paper says), then tap
            the button. Nothing prints before that.
          </p>
          <button
            disabled={busy}
            onClick={() => choose("photo_a4", state.passportPaper)}
          >
            A4 photo paper loaded
          </button>
        </div>
      )}

      {counts.passport.queued > 0 && loaded !== "passport" && (
        <div className="ph-card ph-code">
          <strong>
            Passport photo orders waiting: {counts.passport.queued}
          </strong>
          <p className="ph-muted">Which passport paper are you loading?</p>
          <div className="ph-row">
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              {papers?.a4?.enabled && (
                <option value="a4">
                  A4 sheet (about {passportSheets.a4} sheet(s) needed)
                </option>
              )}
              {papers?.["4x6"]?.enabled && (
                <option value="4x6">
                  4 x 6 inch (about {passportSheets["4x6"]} sheet(s) needed)
                </option>
              )}
            </select>
            <button disabled={busy} onClick={() => choose("passport", choice)}>
              Passport paper loaded
            </button>
          </div>
        </div>
      )}

      {loaded === "passport" &&
        counts.passport.queued > 0 &&
        papers?.[state.passportPaper === "a4" ? "4x6" : "a4"]?.enabled && (
          <div className="ph-row">
            <span className="ph-muted">Loaded the other size?</span>
            <button
              className="small ghost"
              disabled={busy}
              onClick={() =>
                choose("passport", state.passportPaper === "a4" ? "4x6" : "a4")
              }
            >
              Switch to{" "}
              {PASSPORT_PAPER[state.passportPaper === "a4" ? "4x6" : "a4"]}
            </button>
          </div>
        )}

      {loaded !== "plain" && left[loaded] === 0 && (
        <div className="ph-card ph-code">
          <strong>Photo batch finished</strong>
          <p className="ph-muted">
            Take the photo paper out and put plain paper back.
            {counts.document.queued > 0 &&
              ` ${counts.document.queued} document order(s) are waiting for plain paper.`}
          </p>
          <button
            disabled={busy}
            onClick={() => choose("plain", state.passportPaper)}
          >
            Plain paper loaded
          </button>
        </div>
      )}

      {loaded !== "plain" && left[loaded] > 0 && counts.document.queued > 0 && (
        <div className="ph-banner">
          {counts.document.queued} document order(s) are held until plain paper
          is back.
        </div>
      )}
    </div>
  );
}
