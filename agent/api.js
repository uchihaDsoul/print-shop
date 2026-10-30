// One helper to talk to the server
async function call(config, path, body, withKey = true) {
  const headers = { "Content-Type": "application/json" };
  if (withKey) headers["x-agent-key"] = config.key;

  const res = await fetch(`${config.serverUrl}/api/agent${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(40000), // Render may take 30-60 s to wake up
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Server answered ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

module.exports = { call };