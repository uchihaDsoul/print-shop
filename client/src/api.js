const API = import.meta.env.VITE_API_URL;

async function request(path, options = {}, isAdmin = false) {
  const headers = { ...(options.headers || {}) };
  
  if (isAdmin) {
    const token = localStorage.getItem("token") || localStorage.getItem("adminToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API}/api/orders${path}`, { ...options, headers });
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

export const countMultiplePages = (files) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return request("/pagecount-multi", { method: "POST", body: fd });
};

export const placeOrder = (form, file) => {
  const fd = new FormData();
  Object.entries(form).forEach(([key, value]) => fd.append(key, value));
  fd.append("file", file);
  return request("/online", { method: "POST", body: fd });
};

export const createWalkInOrder = (form, file) => {
  const fd = new FormData();
  Object.entries(form).forEach(([key, value]) => fd.append(key, value));
  if (file) fd.append("file", file);
  return request("/walkin", { method: "POST", body: fd }, true);
};

export const placeWalkInOrder = createWalkInOrder;

export const trackOrder = (code) =>
  request(`/track/${encodeURIComponent(code)}`);
export const getRates = () => request("/rates");

export const getPublicSettings = () =>
  fetch(`${API}/api/settings/public`).then((r) => r.json());

export const submitUpi = (code, reference) =>
  request(
    `/track/${encodeURIComponent(code)}/upi`,
    json("POST", { reference }),
  );

export const chooseCash = (code) =>
  request(`/track/${encodeURIComponent(code)}/cash`, json("POST", {}));

export const atCounter = (code) =>
  request(`/track/${encodeURIComponent(code)}/counter`, json("POST", {}));

export const cancelOrder = (code) =>
  request(`/track/${encodeURIComponent(code)}/cancel`, json("POST", {}));

// ---------- photo orders ----------
async function photoRequest(path, options = {}) {
  const res = await fetch(`${API}/api/photo-orders${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const getPhotoQuote = (data) => photoRequest("/quote", json("POST", data));

export function placePhotoOrder(fields, files) {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    fd.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  files.forEach((f) => fd.append("photos", f));
  return photoRequest("/online", { method: "POST", body: fd });
}