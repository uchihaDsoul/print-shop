const API = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}/api/orders${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getQuote = (form) => request("/quote", json("POST", form));

export const countPages = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return request("/pagecount", { method: "POST", body: fd });
};

export const placeOrder = (form, file) => {
  const fd = new FormData();
  Object.entries(form).forEach(([key, value]) => fd.append(key, value));
  fd.append("file", file);
  return request("/online", { method: "POST", body: fd });
};

export const trackOrder = (code) => request(`/track/${encodeURIComponent(code)}`);
export const getRates = () => request("/rates");