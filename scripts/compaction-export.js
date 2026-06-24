const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(process.env.HOME, ".local/share/opencode/opencode.db");
const DIR = path.join(process.env.HOME, "Documents/virtual-brain/OpenCode/memory");

const previewOnly = process.argv.includes("--preview") || process.argv.includes("-p");

function q(sql) {
  const out = execSync(
    `sqlite3 -separator $'\\t' "${DB_PATH}" "${sql.replace(/\n/g, " ").replace(/"/g, '\\"')}"`,
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );
  return out.trim();
}

function slugify(t) {
  return (t || "session")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

function dateFromMs(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function alreadySaved(sessionId) {
  try {
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith(".md")) continue;
      const c = fs.readFileSync(path.join(DIR, f), "utf8");
      const m = c.match(/^session:\s*"?(.+?)"?\s*$/m);
      if (m && m[1] === sessionId) return f;
    }
  } catch (_) {}
  return null;
}

try {
  fs.mkdirSync(DIR, { recursive: true });
} catch (_) {}

const row = q(
  "SELECT s.id, s.slug, s.title, s.time_created FROM session s JOIN message m ON m.session_id = s.id WHERE json_extract(m.data,'$.summary')=1 ORDER BY s.time_updated DESC LIMIT 1"
);
if (!row) {
  process.stderr.write("No compacted sessions found.\n");
  process.exit(0);
}
const [sessionId, slug, title, timeCreated] = row.split("\t");
const epoch = parseInt(timeCreated, 10);

const msgRow = q(
  `SELECT m.id FROM message m WHERE m.session_id='${sessionId}' AND json_extract(m.data,'$.summary')=1 ORDER BY m.time_created DESC LIMIT 1`
);
if (!msgRow) {
  process.stderr.write("No compaction summary message found.\n");
  process.exit(0);
}
const msgId = msgRow.split("\t")[0];

const parts = q(
  `SELECT json_extract(p.data,'$.text') FROM part p WHERE p.message_id='${msgId}' AND json_extract(p.data,'$.type')='text' AND json_extract(p.data,'$.text') IS NOT NULL ORDER BY p.time_created`
);
if (!parts) {
  process.stderr.write("No summary text found in compaction message.\n");
  process.exit(0);
}
const summary = parts
  .split("\n")
  .map((r) => r.replace(/\\n/g, "\n"))
  .join("\n")
  .trim();

const shortId = sessionId.slice(0, 8);
const filename = `Compacted_${dateFromMs(epoch)}_${slugify(title)}@${shortId}.md`;

if (previewOnly) {
  const existing = alreadySaved(sessionId);
  if (existing) process.stdout.write(`(overwriting: ${existing})\n`);
  process.stdout.write(`${title || slug}\n${filename}\n${summary.slice(0, 200)}...\n`);
  process.exit(0);
}

const frontmatter = [
  "---",
  `session: "${sessionId}"`,
  `epoch: ${epoch}`,
  `date: "${new Date(epoch).toISOString()}"`,
  `title: "${title}"`,
  `slug: "${slug}"`,
  "tags:",
  "  - opencode-compact",
  "  - memory",
  "---",
  "",
  summary,
  "",
].join("\n");

const outPath = path.join(DIR, filename);
fs.writeFileSync(outPath, frontmatter, "utf8");
process.stdout.write(`${filename}\n`);