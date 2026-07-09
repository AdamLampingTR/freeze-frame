---
name: implement-from-spec
description: The mandatory FreezeFrame build loop — implement one spec slice at a time against docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md, test-first, commit per slice.
---
# Implement From Spec

1. Read `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md` and the relevant `docs/conventions/*.md`.
2. Pick the next unbuilt slice in dependency order: discovery → linking → release-tag → rules → skip list → notifications → frontend.
3. Write a failing test first (Vitest), then the minimal implementation, then make it pass.
4. Run `/verify-freeze-frame` before committing.
5. Commit per slice on a feature branch. Open a draft PR via `/creating-pull-requests`. Never commit to `main`.
6. Replace each `throw new Error("not implemented")` stub in `api/src/services/` with the real port of Jared's `code-freeze-dashboard` logic (algorithms, re-expressed over ADO REST).
