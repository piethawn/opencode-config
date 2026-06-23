---
name: git-sync
description: "Stages, commits, and pushes all pending changes in ~/.config/opencode/ to origin/main. Trigger when the user says 'sync my config', 'git sync', 'push opencode', 'backup my config', 'save my opencode settings', or any variant of syncing/pushing the OpenCode config repo."
---

# Git Sync

Commits and pushes all pending changes in `~/.config/opencode/` to `git@github.com:piethawn/opencode-config.git` (origin/main).

---

## Step 1 — Stage everything and inspect the diff

```bash
git -C ~/.config/opencode add -A && git -C ~/.config/opencode diff --staged --stat
```

If nothing to stage, skip to "Nothing to sync."

---

## Step 2 — Craft a commit message

Read the staged diff output. Produce a **single-line, lowercase** summary (max 72 characters) of what changed: what was added, removed, or modified, in plain English.

Examples:
- `add git-sync skill and script`
- `fix save-conversation timestamp parsing`
- `remove deprecated apple-reminders helper`

Do not list filenames. Do not include punctuation at the end.

---

## Step 3 — Commit and push

```bash
bash ~/.config/opencode/scripts/git-sync.sh '<your message>'
```

If `git commit` is blank (no changes staged), the script exits with "Nothing to sync."

---

## Notes

- No confirmation prompt — invoking the skill *is* confirmation
- Commit messages are 72 chars max, single-line, lowercase, plain English
- The script does **not** auto-pull, matching the original plan's philosophy of avoiding surprise merge conflicts
- This skill replaces the planned fswatch LaunchAgent daemon — no background processes, failures are visible immediately