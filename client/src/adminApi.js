const API = import.meta.env.VITE_API_URL;

export const getToken = () => localStorage.getItem("token");

async function call(path, options = {}, isForm = false) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API}/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) localStorage.removeItem("token");
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

const body = (method, data) => ({ method, body: JSON.stringify(data) });

export const login = (username, password) =>
  call("/auth/login", body("POST", { username, password }));
export const getMe = () => call("/auth/me");

export const listOrders = (query = "") => call(`/orders${query}`);
export const updateOrder = (id, data) =>
  call(`/orders/${id}`, body("PATCH", data));
export const deleteOrder = (id) => call(`/orders/${id}`, { method: "DELETE" });
export const getStats = () => call("/orders/stats");
export const createWalkin = (form, file) => {
  const fd = new FormData();
  Object.entries(form).forEach(([k, v]) => fd.append(k, v));
  if (file) fd.append("file", file);
  return call("/orders/walkin", { method: "POST", body: fd }, true);
};

export const listUsers = () => call("/users");
export const createUser = (data) => call("/users", body("POST", data));
export const updateUser = (id, data) =>
  call(`/users/${id}`, body("PATCH", data));
export const deleteUser = (id) => call(`/users/${id}`, { method: "DELETE" });
export const getFileLink = (id) => call(`/orders/${id}/file`);
export const updatePricing = (data) =>
  call("/setting/pricing", body("PUT", data));

export const getShopSettings = () => call("/settings/shop");
export const updateShopSettings = (data) =>
  call("/settings/shop", body("PUT", data));

export const getRequests = () => call("/orders/requests");
export const confirmPayment = (id, method) =>
  call(`/orders/${id}/confirm`, body("POST", { method }));
export const rejectPayment = (id, reason) =>
  call(`/orders/${id}/reject`, body("POST", { reason }));


export const listComputers = () => call("/computers");
export const addComputer = (name) => call("/computers", body("POST", { name }));
export const newComputerCode = (id) => call(`/computers/${id}/code`, { method: "POST" });
export const deleteComputer = (id) => call(`/computers/${id}`, { method: "DELETE" });

export const listPrinters = () => call("/printers");
export const printerAction = (id, action) =>
  call(`/printers/${id}/${action}`, { method: "POST" });
export const updatePrinter = (id, data) =>
  call(`/printers/${id}`, body("PATCH", data));