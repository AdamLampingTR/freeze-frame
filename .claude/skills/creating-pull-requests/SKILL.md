---
name: creating-pull-requests
description: Open a PR for FreezeFrame the right way — feature branch, draft, ADO work-item link, AI Generated label, target main (human merges).
---
# Creating Pull Requests

- Branch from `main`; never commit to `main` (it auto-deploys).
- Open a **draft** PR targeting `main` with `gh pr create --draft`.
- Description must carry the ADO work-item reference (`AB#<id>` or the full work-item URL).
- Apply the `AI Generated` label: `gh pr edit <pr> --add-label "AI Generated"` (create the label once if missing).
- CI (typecheck + lint + test) must be green. A human merges — the agent does not self-merge.
