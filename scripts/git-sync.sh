#!/bin/bash
set -uo pipefail
MSG="${1:-}"

if [ -z "${SSH_AUTH_SOCK:-}" ]; then
  echo "✗ SSH agent not detected. Your hardware key won't be reachable."
  echo "  Ensure you're running OpenCode from a terminal where 'ssh-add -L' works."
  exit 1
fi

cd ~/.config/opencode

if [ -z "$MSG" ]; then
  echo "✗ Commit message required as first argument."
  echo "  Usage: git-sync.sh '<message>'"
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "✓ Working tree clean. Nothing to sync."
  exit 0
fi

git add -A
git commit -m "$MSG"
git push origin main
echo "✓ Synced to origin/main."