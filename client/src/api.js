const API = import.meta.env.VITE_API_URL;

async function request(path, options) {
  const res = await fetch(`${API}/api/orders${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const getQuote = (form) =>
  request("/quote", { method: "POST", body: JSON.stringify(form) });

export const placeOrder = (form) =>
  request("/online", { method: "POST", body: JSON.stringify(form) });

export const trackOrder = (code) =>
  request(`/track/${encodeURIComponent(code)}`);