import { useEffect, useState } from "react";
import {
  listComputers,
  addComputer,
  newComputerCode,
  deleteComputer,
} from "../../adminApi";

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function CodeBox({ info, onClose }) {
  const now = useNow();
  const left = Math.max(0, Math.floor((new Date(info.expiresAt).getTime() - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="ph-card ph-code">
      <p>
        Pairing code for <strong>{info.name}</strong>. It is shown <strong>only once</strong>, so
        copy it now.
      </p>
      <div className="ph-code-text">{info.code}</div>
      <p>
        {left > 0 ? `Valid for ${mm}:${ss} more.` : "This code has expired. Make a new one."}
      </p>
      <p className="ph-muted">Enter it in the print agent on the shop PC (Phase 4).</p>
      <button className="small ghost" onClick={onClose}>
        Hide code
      </button>
    </div>
  );
}

export default function ComputersTab() {
  const [computers, setComputers] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeInfo, setCodeInfo] = useState(null);

  async function load() {
    try {
      setComputers(await listComputers());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await addComputer(name.trim());
      setCodeInfo({ name: r.computer.name, code: r.code, expiresAt: r.expiresAt });
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleNewCode(c) {
    if (
      c.paired &&
      !window.confirm(
        `Making a new code disconnects "${c.name}" until it is paired again. Continue?`
      )
    )
      return;
    setError("");
    try {
      const r = await newComputerCode(c._id);
      setCodeInfo({ name: c.name, code: r.code, expiresAt: r.expiresAt });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Remove "${c.name}" and all its printers?`)) return;
    setError("");
    try {
      await deleteComputer(c._id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function state(c) {
    if (!c.paired) return c.codePending ? "Waiting to pair" : "Not paired";
    return c.online ? "Online" : "Offline";
  }

  return (
    <div>
      <h1>Computers</h1>
      <p className="ph-muted">
        A computer is a shop PC that runs the print agent. Add one, then enter its one-time code
        on that PC.
      </p>

      {error && <p className="ph-error">{error}</p>}
      {codeInfo && <CodeBox info={codeInfo} onClose={() => setCodeInfo(null)} />}

      <form className="ph-card ph-row" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, for example Shop PC"
          maxLength={60}
          required
        />
        <button disabled={busy || !name.trim()}>Add computer</button>
      </form>

      <div className="ph-list">
        {computers.length === 0 && <p className="ph-muted">No computers yet.</p>}
        {computers.map((c) => (
          <div className="ph-card" key={c._id}>
            <div className="ph-row ph-between">
              <div>
                <strong>{c.name}</strong>
                <span className={`ph-pill ph-${c.online ? "good" : "idle"}`}>{state(c)}</span>
              </div>
              <div className="ph-row">
                <button className="small ghost" onClick={() => handleNewCode(c)}>
                  New code
                </button>
                <button className="small ghost" onClick={() => handleDelete(c)}>
                  Remove
                </button>
              </div>
            </div>
            <p className="ph-muted">
              {c.lastSeenAt
                ? `Last seen ${new Date(c.lastSeenAt).toLocaleString("en-IN")}`
                : "Never seen yet"}
              {c.agentVersion ? ` · agent ${c.agentVersion}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}