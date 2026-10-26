import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { listUsers, createUser, updateUser, deleteUser } from "../adminApi";

export default function UsersPage() {
  const { user } = useAuth();
  const allowedRoles = user.role === "superadmin" ? ["admin", "manager"] : ["manager"];

  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", name: "", password: "", role: allowedRoles[allowedRoles.length - 1] });

  async function load() {
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function run(action) {
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCreate(e) {
    e.preventDefault();
    run(async () => {
      await createUser(form);
      setForm({ ...form, username: "", name: "", password: "" });
    });
  }

  return (
    <>
      <div className="bar">
        <Link to="/admin">← Back to orders</Link>
      </div>
      {error && <p className="error">{error}</p>}

      <form className="card" onSubmit={handleCreate}>
        <h2>Add staff user</h2>
        <div className="row">
          <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
        </div>
        <div className="row">
          <label>Password (8+ characters)<input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <button type="submit">Create user</button>
      </form>

      <div className="card">
        <h2>Staff</h2>
        {users.length === 0 && <p>No users yet.</p>}
        {users.map((u) => (
          <div className="order" key={u.id}>
            <div>
              <strong>{u.name}</strong> ({u.username}) · {u.role} ·{" "}
              {u.active ? "Active" : "Disabled"}
            </div>
            <div className="actions">
              <button className="small" onClick={() => run(() => updateUser(u.id, { active: !u.active }))}>
                {u.active ? "Disable" : "Enable"}
              </button>
              <button
                className="small"
                onClick={() => {
                  const pw = window.prompt("New password (8+ characters):");
                  if (pw) run(() => updateUser(u.id, { password: pw }));
                }}
              >
                Reset password
              </button>
              <button
                className="small danger"
                onClick={() => window.confirm(`Delete ${u.name}?`) && run(() => deleteUser(u.id))}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}