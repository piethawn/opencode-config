---
name: save-conversation
description: "Saves the current OpenCode session to Obsidian vault as a markdown file matching the Copilot plugin format. Trigger when the user says 'save this convo', 'save our conversation', 'save conversation to vault', 'export this chat', or any variant of saving/exporting the chat to Obsidian."
---

# Save Conversation to Vault

Exports the most recently updated OpenCode session as a markdown file in `OpenCode/conversations/`.

---

## Step 1 — Identify the Session

Run the preview command to see which session would be saved:

```bash
node ~/.config/opencode/scripts/save-conversation.js --preview
```

The output is three lines:
- Line 1: session title
- Line 2: filename that would be created
- Line 3: message count

---

## Step 2 — Ask for Confirmation

Present to the user:

> *Save session **"[title]"** (N messages) to vault as `[filename]`? [y/n]*

Wait for a yes/no response. Accept "y", "yes", or "yeah" as yes. Accept "n", "no", or "nah" as no.

If **no**: tell the user you won't save and stop here.

---

## Step 3 — Export

```bash
node ~/.config/opencode/scripts/save-conversation.js
```

The script writes the file to vault and prints the filename on success.

---

## Step 4 — Confirm

Tell the user the file was saved and show the vault path:

> *Saved as `OpenCode/conversations/[filename]`*

---

## Notes

- Always use `--preview` first so the user can confirm before writing
- The script always targets the **most recently updated** session — typically the current one
- Output format matches the existing Copilot plugin convention (same frontmatter, same body format)
- If the same session was already saved, the file is **overwritten** with the full updated conversation