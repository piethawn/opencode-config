---
name: apple-reminders-digest
description: "Reads incomplete reminders from the Apple Reminders app via an MCP server and builds a markdown daily digest, which it can then write to a daily note in the Obsidian vault. Trigger this skill when the user asks for a daily digest, wants to review reminders, asks about to-dos, or says anything like 'read my reminders', 'make a daily note', 'sync reminders to Obsidian', 'reminder digest', or 'what do I need to do today'."
---

# Apple Reminders Daily Digest Skill

Connects OpenCode to the macOS Apple Reminders app through a local MCP server (`apple-reminders`), reads incomplete reminders, and produces a markdown digest that can be merged into the user's Obsidian vault as a daily note.

## Architecture

1. **MCP Server** (`apple-reminders`):
   - `apple_reminders_get` — raw JSON dump of all incomplete reminders.
   - `apple_reminders_daily_digest` — pre-formatted markdown grouped by list, with optional filtering (`today_only`, `due_soon_days`).

2. **Vault Integration** (`vault-search` MCP):
   - Writes the final digest into `Daily Notes/YYYY-MM-DD.md` inside `~/Documents/virtual-brain`.

## Usage Flow

### Step 1 — Detect Intent
Trigger on any of these user intents:
- "make my daily note"
- "what are my reminders"
- "read my reminders"
- "daily digest"
- "sync reminders"
- "what do I need to do today"

### Step 2 — Fetch Reminders
Call the `apple-reminders` MCP server with **one** of the following based on user intent:
- `apple_reminders_get` — if the user wants raw data or full control.
- `apple_reminders_daily_digest` with `due_soon_days=7` — default digest: what's due this week.
- `apple_reminders_daily_digest` with `today_only=true` — if the user explicitly asks for *today only*.

### Step 3 — Enrich with Vault Context (Optional)
Before writing the digest, optionally query the `vault-search` MCP to surface:
- Notes tagged `#inbox` or `#daily`.
- Notes from the last 24 hours that mention tasks, to-dos, or deadlines.
- The user's existing daily note for today (if one exists) to avoid overwriting.

### Step 4 — Generate the Daily Note
If no daily note exists for today, create one:
- Path: `~/Documents/virtual-brain/Daily Notes/YYYY-MM-DD.md`
- Content structure:
  ```markdown
  # YYYY-MM-DD — Daily Plan

  ## Focus Areas
  <!-- Optional: infer 2-3 themes from reminders + vault context -->

  ## Reminders
  <!-- Paste the markdown digest from Step 2 here -->

  ## Notes / Thoughts
  <!-- Leave a blank section for the user to free-write -->
  
  ## Created
  <!-- Auto-generated timestamp -->
  ```

If a daily note **already exists**, append the digest under an `## Updates from Reminders` heading rather than overwriting.

### Step 5 — Suggest Next Actions
After writing the note, read the reminders back and suggest up to 3 high-impact next actions based on:
- Due dates coming up soon.
- High-priority reminders.
- Recurring themes across lists.

## Rules
- Never mark reminders as completed. This skill is read-only for Reminders.
- Always write to `Daily Notes` under Obsidian `~/Documents/virtual-brain`.
- If a note already exists, append rather than overwrite.
- Keep the output concise. The digest is a starting point, not a novel.
