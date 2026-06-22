#!/usr/bin/env node
/**
 * Apple Reminders MCP Server for OpenCode
 * 
 * Exposes two tools over stdio MCP:
 *   - apple_reminders_get: Returns all incomplete reminders as JSON.
 *   - apple_reminders_daily_digest: Returns a markdown-formatted digest
 *     ready for an OpenCode agent to merge into a daily note.
 *
 * Requires: Node.js (ships with macOS)
 * macOS Sandbox Note: The server must run as a LOCAL MCP with stdio streaming.
 * First run will trigger Apple permissions prompts for Reminders access.
 */

const { spawn } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = path.join(process.env.HOME, '.config/opencode/scripts');
const REMINDERS_EXPORT = path.join(SCRIPTS_DIR, 'reminders_export.swift');

// --- Logging helper (stderr only so stdout stays pure MCP JSON-RPC) ---
function log(msg) {
  console.error('[apple-reminders-mcp]', msg);
}

// --- Helper: run Swift/EventKit script to fetch reminders ---
function getRemindersJSON() {
  return new Promise((resolve, reject) => {
    const child = spawn('swift', [REMINDERS_EXPORT], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`swift exited ${code}: ${stderr || stdout}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse Swift output as JSON: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

// --- MCP JSON-RPC helpers ---
const tools = [
  {
    name: 'apple_reminders_get',
    description: 'Fetch all incomplete reminders from Apple Reminders app and return them as structured JSON data.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'apple_reminders_daily_digest',
    description: 'Builds a markdown daily digest of incomplete Reminders, grouped by list, suitable for merging into an Obsidian daily note.',
    inputSchema: {
      type: 'object',
      properties: {
        today_only: {
          type: 'boolean',
          description: 'Only include reminders whose dueDate is today. Default: false (show all incomplete)',
          default: false,
        },
        due_soon_days: {
          type: 'number',
          description: 'If today_only is false, only include reminders due within this many days. 0 means all incomplete.',
          default: 0,
        },
      },
      required: [],
    },
  },
];

function sendJSON(data) {
  const line = JSON.stringify(data);
  process.stdout.write(line + '\n');
}

function buildDigest(reminders, { today_only, due_soon_days }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  let filtered = reminders;

  if (today_only) {
    filtered = reminders.filter((r) => {
      if (!r.dueDate || r.dueDate === 'null') return false;
      const d = new Date(r.dueDate);
      return d >= startOfToday && d <= endOfToday;
    });
  } else if (due_soon_days > 0) {
    const cutoff = new Date(startOfToday.getTime() + due_soon_days * 24 * 60 * 60 * 1000);
    filtered = reminders.filter((r) => {
      if (!r.dueDate || r.dueDate === 'null') return false;
      const d = new Date(r.dueDate);
      return d <= cutoff;
    });
  }

  if (filtered.length === 0) {
    return { markdown: '> No reminders match the selected filter.\n', count: 0 };
  }

  // Group by list
  const byList = {};
  for (const r of filtered) {
    const listName = r.list || 'Reminders';
    if (!byList[listName]) byList[listName] = [];
    byList[listName].push(r);
  }

  let md = `## Apple Reminders Digest\n\n`;
  md += `_Generated: ${now.toLocaleDateString()}_\n\n`;

  for (const [listName, items] of Object.entries(byList)) {
    md += `### ${listName}\n\n`;
    for (const item of items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))) {
      const due = item.dueDate && item.dueDate !== 'null' ? item.dueDate : 'No due date';
      md += `- [ ] **${item.name}**  `;
      if (item.priority > 0) {
        const pMap = ['', 'High', 'Medium', 'Low'];
        md += `*(Priority: ${pMap[item.priority] || item.priority})* `;
      }
      md += `— Due: ${due}`;
      if (item.description) {
        md += `  \n  > ${item.description.replace(/\n/g, ' ')}`;
      }
      md += '\n';
    }
    md += '\n';
  }

  return { markdown: md, count: filtered.length };
}

async function handleInvoke(id, params) {
  const tool = params?.name;
  const args = params?.arguments || {};

  try {
    if (tool === 'apple_reminders_get') {
      const data = await getRemindersJSON();
      sendJSON({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        },
      });
      return;
    }

    if (tool === 'apple_reminders_daily_digest') {
      const data = await getRemindersJSON();
      if (!data.success) {
        sendJSON({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: 'Error fetching reminders.' }] },
        });
        return;
      }
      const digest = buildDigest(data.reminders, {
        today_only: args.today_only ?? false,
        due_soon_days: args.due_soon_days ?? 0,
      });
      sendJSON({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: digest.markdown }],
          metadata: { reminder_count: digest.count },
        },
      });
      return;
    }

    sendJSON({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${tool}` } });
  } catch (err) {
    log('ERROR: ' + err.message);
    sendJSON({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
  }
}

// --- Main MCP loop ---
let buffer = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  let lines = buffer.split('\n');
  buffer = lines.pop(); // keep partial line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      const id = msg.id;
      const method = msg.method;

      if (method === 'initialize') {
        sendJSON({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'apple-reminders-mcp', version: '1.0.0' },
          },
        });
      } else if (method === 'tools/list') {
        sendJSON({ jsonrpc: '2.0', id, result: { tools } });
      } else if (method === 'tools/call') {
        await handleInvoke(id, msg.params);
      } else if (method === 'notifications/initialized') {
        // No-op
      } else {
        sendJSON({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
      }
    } catch (err) {
      log('Bad JSON-RPC line: ' + line);
      sendJSON({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
  }
});

log('Apple Reminders MCP server started.');
