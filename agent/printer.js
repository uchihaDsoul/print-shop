// Downloads a job's file and prints it with SumatraPDF
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SUMATRA = path.join(__dirname, "tools", "SumatraPDF.exe");
const TMP = path.join(__dirname, "tmp");
const MAX_BYTES = 25 * 1024 * 1024; // a little above the 20 MB upload limit

async function downloadTo(url, ext) {
  fs.mkdirSync(TMP, { recursive: true });
  const file = path.join(TMP, crypto.randomBytes(8).toString("hex") + ext);

  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error("Downloaded file is empty");
  if (buffer.length > MAX_BYTES)
    throw new Error("Downloaded file is too large");
  fs.writeFileSync(file, buffer);
  return file;
}

function runSumatra(printer, settingsText, file) {
  return new Promise((resolve, reject) => {
    execFile(
      SUMATRA,
      ["-print-to", printer, "-print-settings", settingsText, "-silent", file],
      { timeout: 120000, windowsHide: true },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

// job = what the server's claim route returned
async function printJob(job) {
  if (!fs.existsSync(SUMATRA))
    throw new Error("SumatraPDF.exe is missing from agent\\tools");

  const format = String(job.format || "").toLowerCase();
  if (!["pdf", "jpg", "jpeg", "png"].includes(format))
    throw new Error("Unsupported file type");
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(job.pages || "1"))
    throw new Error("Bad page range");

  const copies = Number(job.copies);
  if (!(copies >= 1 && copies <= 99)) throw new Error("Bad copies value");

  const settings = [];
  if (job.pages && format === "pdf") settings.push(job.pages); // ranges apply to PDFs only
  if (copies > 1) settings.push(copies + "x");
  settings.push(job.color ? "color" : "monochrome");
  settings.push("simplex");
  settings.push("paper=A4");

  const file = await downloadTo(
    job.url,
    "." + (format === "jpeg" ? "jpg" : format),
  );
  try {
    await runSumatra(job.printer, settings.join(","), file);
  } finally {
    // the customer's file must not stay on this PC
    setTimeout(() => fs.rm(file, { force: true }, () => {}), 30000);
  }
}

module.exports = { printJob };
