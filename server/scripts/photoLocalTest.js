// Usage: node scripts/photoApiTest.js "C:\path\to\photo.jpg" [http://localhost:5000]
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
const api = (process.argv[3] || "http://localhost:5000").replace(/\/+$/, "");
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/photoApiTest.js "C:\\path\\to\\photo.jpg" [server address]');
  process.exit(1);
}

function ask(question, hidden) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setEncoding("utf8");
    if (!hidden) {
      stdin.once("data", (d) => { stdin.pause(); resolve(String(d).trim()); });
      return;
    }
    let text = "";
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(text);
      } else if (ch === "\u0003") process.exit(1);
      else if (ch === "\u007f" || ch === "\b") text = text.slice(0, -1);
      else text += ch;
    };
    stdin.on("data", onData);
  });
}

const buf = fs.readFileSync(file);
const type = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const photoBlob = () => new Blob([buf], { type });

async function post(url, body, token, asJson) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (asJson) headers["Content-Type"] = "application/json";
  const res = await fetch(api + url, { method: "POST", headers, body: asJson ? JSON.stringify(body) : body });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  const username = await ask("Admin username: ", false);
  const password = await ask("Admin password (hidden): ", true);
  const login = await post("/api/auth/login", { username, password }, null, true);
  if (!login.ok) throw new Error("Login failed: " + (login.data.error || login.status));
  const token = login.data.token;
  console.log("Logged in.");

  let r = await post("/api/photo-orders/quote", { orderType: "photo_a4", sheets: 3, color: true }, null, true);
  console.log("Quote A4 photo, 3 sheets, color:", r.data);
  r = await post("/api/photo-orders/quote", { orderType: "passport", passportSize: "35x45", pieces: 6, color: false }, null, true);
  console.log("Quote passport 35x45, 6 pieces, B/W:", r.data);

  // A4 photo walk-in (cash, so it is paid and queued)
  let fd = new FormData();
  fd.append("customerName", "Photo Test");
  fd.append("phone", "9999999999");
  fd.append("orderType", "photo_a4");
  fd.append("color", "true");
  fd.append("payment", "cash");
  fd.append("items", JSON.stringify([{ copies: 2, fit: "fill" }, { copies: 1, fit: "fit" }]));
  fd.append("photos", photoBlob(), "a" + path.extname(file));
  fd.append("photos", photoBlob(), "b" + path.extname(file));
  r = await post("/api/photo-orders/walkin", fd, token, false);
  console.log("A4 photo walk-in:", r.ok ? { code: r.data.trackingCode, type: r.data.orderType, status: r.data.status, pages: r.data.pages, price: r.data.price, warnings: r.data.warnings } : r.data);

  // passport walk-in (not paid yet)
  fd = new FormData();
  fd.append("customerName", "Passport Test");
  fd.append("phone", "9999999999");
  fd.append("orderType", "passport");
  fd.append("passportSize", "35x45");
  fd.append("pieces", "6");
  fd.append("color", "false");
  fd.append("payment", "none");
  fd.append("photos", photoBlob(), "p" + path.extname(file));
  r = await post("/api/photo-orders/walkin", fd, token, false);
  console.log("Passport walk-in:", r.ok ? { code: r.data.trackingCode, type: r.data.orderType, status: r.data.status, size: r.data.passportSize, pieces: r.data.passportPieces, price: r.data.price } : r.data);

  // a bad request must be refused
  fd = new FormData();
  fd.append("customerName", "Bad Test");
  fd.append("phone", "9999999999");
  fd.append("orderType", "passport");
  fd.append("passportSize", "35x45");
  fd.append("pieces", "99");
  fd.append("payment", "none");
  fd.append("photos", photoBlob(), "p" + path.extname(file));
  r = await post("/api/photo-orders/walkin", fd, token, false);
  console.log("99 passport pieces (must be refused):", r.status, r.data.error);

  // test sheet
  fd = new FormData();
  fd.append("passportSize", "35x45");
  fd.append("paper", "4x6");
  fd.append("pieces", "6");
  fd.append("photos", photoBlob(), "t" + path.extname(file));
  r = await post("/api/photo-orders/test-sheet", fd, token, false);
  if (r.ok) {
    const out = path.join(__dirname, "..", "..", "printer-test", "api-sheet-test.pdf");
    fs.writeFileSync(out, r.data);
    console.log("Test sheet saved:", out);
  } else console.log("Test sheet failed:", r.data);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});