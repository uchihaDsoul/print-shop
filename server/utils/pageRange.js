// "1-5, 8, 10-12" with a 20-page file -> { count: 9, normalized: "1-5,8,10-12" }
function parsePageRange(input, total) {
  const text = String(input || "").trim();
  if (!text) return { count: total, normalized: "" };

  const pages = new Set();
  for (const raw of text.split(",")) {
    const part = raw.trim();
    if (!part) continue;

    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) throw new Error(`Invalid page range "${part}". Use a format like 1-5, 8, 10-12`);

    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) throw new Error(`Invalid page range "${part}"`);
    if (to > total) throw new Error(`Page ${to} is beyond the last page (${total})`);

    for (let i = from; i <= to; i++) pages.add(i);
  }

  if (pages.size === 0) throw new Error("Enter at least one page");
  return { count: pages.size, normalized: text.replace(/\s+/g, "") };
}

module.exports = { parsePageRange };