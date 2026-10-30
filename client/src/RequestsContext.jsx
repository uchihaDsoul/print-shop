import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getRequests } from "./adminApi";

const Ctx = createContext(null);
export const useRequests = () => useContext(Ctx);

const POLL_MS = 5000;

// A short two-note chime made in the browser (no sound file needed)
function playChime(ctx) {
  const t0 = ctx.currentTime;
  [880, 1175].forEach((freq, i) => {
    const start = t0 + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.22);
  });
}

export function RequestsProvider({ children }) {
  const [requests, setRequests] = useState([]);
  const [unpaid, setUnpaid] = useState([]);
  const [queued, setQueued] = useState(0);
  const [toasts, setToasts] = useState([]); // new requests shown as pop-ups
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  // the user wanted sound last time, but the browser needs one click before it allows it
  const [needsClick, setNeedsClick] = useState(localStorage.getItem("sound") === "1");

  const audio = useRef(null);
  const soundRef = useRef(false);
  const seen = useRef(null); // ids already shown (null until the first load)
  const baseTitle = useRef(document.title);

  const unlock = useCallback((silent) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!audio.current) audio.current = new AC();
      audio.current.resume();
      soundRef.current = true;
      setSoundOn(true);
      setNeedsClick(false);
      localStorage.setItem("sound", "1");
      if (!silent) playChime(audio.current);
    } catch {
      /* this browser has no audio support */
    }
  }, []);

  const enableSound = useCallback(() => unlock(false), [unlock]);

  const disableSound = useCallback(() => {
    soundRef.current = false;
    setSoundOn(false);
    setNeedsClick(false);
    localStorage.setItem("sound", "0");
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t._id !== id));
  }, []);

  // returning users: the first click anywhere switches the sound back on quietly
  useEffect(() => {
    if (!needsClick) return;
    const onClick = () => unlock(true);
    window.addEventListener("pointerdown", onClick, { once: true });
    return () => window.removeEventListener("pointerdown", onClick);
  }, [needsClick, unlock]);

  const refresh = useCallback(async () => {
    try {
      const data = await getRequests();
      setRequests(data.requests);
      setUnpaid(data.unpaid || []);
      setQueued(data.queued);
      setError("");

      // orders we haven't seen before (nothing counts as new on the very first load)
      const fresh = seen.current
        ? data.requests.filter((r) => !seen.current.has(r._id))
        : [];

      const waiting = new Set(data.requests.map((r) => r._id));
      setToasts((prev) => [...fresh, ...prev].filter((t) => waiting.has(t._id)));

      if (fresh.length > 0 && soundRef.current && audio.current) {
        audio.current.resume();
        playChime(audio.current);
      }

      seen.current = waiting;
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // show the count in the browser tab, for example "(2) Payment requests"
  useEffect(() => {
    document.title =
      requests.length > 0 ? `(${requests.length}) Payment requests` : baseTitle.current;
  }, [requests.length]);
  useEffect(() => () => (document.title = baseTitle.current), []);

  return (
    <Ctx.Provider
      value={{
        requests,
        unpaid,
        queued,
        toasts,
        dismissToast,
        error,
        refresh,
        soundOn,
        needsClick,
        enableSound,
        disableSound,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}