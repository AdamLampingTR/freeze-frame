#!/usr/bin/env bash
# Best-effort format after Edit/Write on TS/TSX files. Never blocks (exit 0).
# Anchored to the repo root so it works regardless of the hook's cwd.
set -uo pipefail
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
file="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
[ -n "$file" ] || exit 0
# Normalize to an absolute path (Claude Code passes absolute; tolerate relative).
[[ "$file" = /* ]] || file="$root/$file"
case "$file" in
  *.ts|*.tsx)
    if [ -f "$root/frontend/package.json" ] && [[ "$file" == *frontend/* ]]; then
      (cd "$root/frontend" && npx --no-install prettier --write "$file") >/dev/null 2>&1 || true
    elif [ -f "$root/api/package.json" ] && [[ "$file" == *api/* ]]; then
      (cd "$root/api" && npx --no-install prettier --write "$file") >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
