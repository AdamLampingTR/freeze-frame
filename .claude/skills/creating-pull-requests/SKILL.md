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

## Hackathon-POC exception (this repo)

`freeze-frame` is a hackathon POC on a personal repo not wired to Azure Boards, so two of the rules above are relaxed:

- **Draft is optional** — a POC PR may be opened **published** (skip `--draft`).
- **Work-item link is optional** — a POC PR may **omit** the `AB#<id>` / work-item URL; note "hackathon POC" in the description instead.

Everything else still applies: feature branch, `AI Generated` label, green CI, and human merge (the agent never self-merges). Drop this exception once the repo is connected to Azure Boards.
