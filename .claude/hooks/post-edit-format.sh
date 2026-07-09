#!/usr/bin/env bash
# Best-effort format after Edit/Write on TS/TSX files. Never blocks (exit 0).
set -uo pipefail
file="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
case "$file" in
  *.ts|*.tsx)
    if [ -f frontend/package.json ] && [[ "$file" == *frontend/* ]]; then
      (cd frontend && npx --no-install prettier --write "${file#frontend/}") >/dev/null 2>&1 || true
    elif [ -f api/package.json ] && [[ "$file" == *api/* ]]; then
      (cd api && npx --no-install prettier --write "${file#api/}") >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
