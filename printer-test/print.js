// print.js - prints one PDF using SumatraPDF
// Example: node print.js --printer "Brother DCP-T436W" --file test.pdf --pages 1-2 --copies 1 --color bw

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

// 1. Read the options typed after "node print.js"
function readArgs() {
  const args = {};
  const list = process.argv.slice(2);
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "--dry-run") {
      args.dryRun = true; // a switch with no value
    } else if (list[i].startsWith("--")) {
      args[list[i].slice(2)] = list[i + 1];
      i++;
    }
  }
  return args;
}

const args = readArgs();
const printer = args.printer;
const file = args.file;
const pages = args.pages; // optional, like "1-5,8"
const copies = parseInt(args.copies || "1", 10);
const color = args.color || "bw"; // "bw" or "color"

// 2. Check everything before we touch the printer
function fail(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}

if (!printer)
  fail('Missing --printer, for example --printer "Brother DCP-T436W"');
if (!file) fail("Missing --file, for example --file test.pdf");
if (!fs.existsSync(file)) fail("File not found: " + file);
const ext = path.extname(file).toLowerCase();
if (![".pdf", ".jpg", ".jpeg", ".png"].includes(ext))
  fail("Only PDF, JPG or PNG files.");
const isImage = ext !== ".pdf";
if (isImage && args.pages) fail("--pages does not apply to images.");
if (!(copies >= 1 && copies <= 99))
  fail("--copies must be a number from 1 to 99");
if (color !== "bw" && color !== "color")
  fail('--color must be "bw" or "color"');
if (pages && !/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(pages)) {
  fail('--pages looks wrong. Use something like "1-5,8"');
}

const sumatra = path.join(__dirname, "tools", "SumatraPDF.exe");
if (!fs.existsSync(sumatra))
  fail("SumatraPDF.exe not found in the tools folder.");

// 3. Build the print settings text for SumatraPDF
const settings = [];
if (pages) settings.push(pages);
if (copies > 1) settings.push(copies + "x");
settings.push(color === "bw" ? "monochrome" : "color");
settings.push("simplex"); // one-sided
settings.push("paper=A4");
const settingsText = settings.join(",");

const sumatraArgs = [
  "-print-to",
  printer,
  "-print-settings",
  settingsText,
  "-silent",
  file,
];

console.log("Printer  :", printer);
console.log("File     :", file);
console.log("Settings :", settingsText);

if (args.dryRun) {
  console.log("Dry run: nothing was sent to the printer.");
  process.exit(0);
}

// 4. Send the job
execFile(sumatra, sumatraArgs, { timeout: 60000 }, (error) => {
  if (error) {
    console.error("Print command failed:", error.message);
    process.exit(1);
  }
  console.log(
    "Job accepted by Windows. Check the paper to be sure it printed.",
  );
});
