---
name: save-memory
description: "Exports OpenCode compaction summaries to the Obsidian vault as frontmatter markdown notes. Trigger when the user says 'save this to memory', 'save to memory', 'export to memory', 'save compaction', 'export compaction', 'archive session', 'compact to vault', or any variant of saving/exporting to the vault memory."
---

# Save to Memory

Exports the most recently compacted OpenCode session summary as a frontmatter markdown note in `OpenCode/memory/`.

---

## Step 1 — Preview

Run the preview to see what would be saved:

```bash
node ~/.config/opencode/scripts/compaction-export.js --preview
```

Output: session title, filename, and a snippet of the summary. If the file already exists, shows `(overwriting: ...)`.

---

## Step 2 — Export

```bash
node ~/.config/opencode/scripts/compaction-export.js
```

---

## Step 3 — Confirm

> *Saved as `OpenCode/memory/[filename]`*

---

## Notes

- Finds the most recently updated session with a compaction summary (`$.summary='true'`)
- Idempotent: re-running overwrites the existing file for the same session
- Frontmatter includes `session`, `epoch`, `date`, `title`, `slug`, `tags` for vault-search
- Tags: `opencode-compact`, `memory`