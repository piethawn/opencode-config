const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(process.env.HOME, ".local/share/opencode/opencode.db");
const VAULT_DIR = path.join(process.env.HOME, "Documents/virtual-brain/OpenCode/conversations");

const previewOnly = process.argv.includes("--preview") || process.argv.includes("-p");

function query(sql) {
  const out = execSync(`sqlite3 -separator $'\t' "${DB_PATH}" "${sql.replace(/\n/g, " ").replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return out.trim();
}

function ts(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function filenameDate(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function slugify(text) {
  return (text || "OpenCode_Session")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

try {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
} catch (_) {}

const sessRows = query(
  "SELECT id, slug, title, time_created FROM session ORDER BY time_updated DESC LIMIT 1"
);
if (!sessRows) {
  process.stderr.write("No sessions found in the database.\n");
  process.exit(1);
}
const [sessionId, slug, title, timeCreated] = sessRows.split("\t");
const epoch = parseInt(timeCreated, 10);

const msgRows = query(
  `SELECT m.id, m.time_created, json_extract(m.data, '$.role'), json_extract(m.data, '$.modelID'), json_extract(m.data, '$.providerID') FROM message m WHERE m.session_id='${sessionId}' ORDER BY m.time_created`
);
if (!msgRows) {
  process.stderr.write("No messages found in this session.\n");
  process.exit(1);
}

const msgs = [];
let modelKey = "unknown";
for (const line of msgRows.split("\n")) {
  const [id, tc, role, modelID, providerID] = line.split("\t");
  if (
    !msgs.find((m) => m.id === id) &&
    (role === "user" || role === "assistant")
  ) {
    const parts = query(
      `SELECT json_extract(p.data,'$.text') FROM part p WHERE p.message_id='${id}' AND json_extract(p.data,'$.type')='text' AND json_extract(p.data,'$.text') IS NOT NULL ORDER BY p.time_created`
    );
    const text = parts ? parts.split("\n").map((p) => p.replace(/\\n/g, "\n")).join("\n") : "";
    if (text.trim()) {
      msgs.push({ role, text, tc: parseInt(tc, 10) });
    }
  }
  if (role === "assistant" && modelID && providerID) {
    modelKey = `${modelID}|${providerID}`;
  }
}

const topic = title || slug || "OpenCode_Session";
const topicSlug = slugify(topic);
const fname = `${topicSlug}@${filenameDate(epoch)}.md`;

if (previewOnly) {
  process.stdout.write(`${topic}\n${fname}\n${msgs.length} messages`);
  process.exit(0);
}

let md = "---\n";
md += `epoch: ${epoch}\n`;
md += `modelKey: "${modelKey}"\n`;
md += `topic: "${topic}"\n`;
md += "tags:\n";
md += "  - copilot-conversation\n";
md += "---\n\n";

for (const msg of msgs) {
  const roleLabel = msg.role === "user" ? "user" : "ai";
  md += `**${roleLabel}**: ${msg.text.trim()}\n`;
  md += `[Timestamp: ${ts(msg.tc)}]\n\n`;
}

const outPath = path.join(VAULT_DIR, fname);
fs.writeFileSync(outPath, md, "utf8");
process.stdout.write(`${fname}`);