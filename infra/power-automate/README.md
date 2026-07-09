# Power Automate flow — backup / restore

The notification flow isn't an Azure Resource Manager resource — it's a cloud
flow in a Power Platform environment, so there's no Bicep/ARM type for it.
This is a lightweight backup, not full CI/CD: an export package checked into
source control as a disaster-recovery artifact, restorable by hand.

## Backing up the current flow

1. Open the flow in [make.powerautomate.com](https://make.powerautomate.com).
2. `...` (more actions) → **Export** → **Package (.zip)**.
3. Download the package and save it here as `freezeframe-notify.zip`
   (gitignored by default for zips containing connection references with
   embedded environment/tenant info — confirm nothing secret is embedded
   before committing; the export does **not** include your PAT/webhook
   secrets themselves, but does include the connection reference metadata).
4. Note the export date and flow version in this file (below), so it's clear
   how stale the backup is relative to the last known-working edit — e.g. the
   `notifyVia`-conditional fix (email/Teams routed independently based on the
   webhook payload's `notifyVia` field, matching `shared/types.ts`'s
   `NotifyVia` type).

## Restoring

1. `make.powerautomate.com` → **Solutions** (or **My flows**) → **Import** →
   select the `.zip` package.
2. On import, you'll be prompted to re-select/re-authenticate connection
   references (Office 365 Outlook, Teams) — these are tenant-specific and
   aren't captured in the package.
3. Re-verify the trigger's **Request Body JSON Schema** includes `notifyVia`
   as a top-level string property — if the imported package predates that
   fix, dynamic content won't offer it and the routing conditions will need
   re-wiring (see the conditional-routing fix in the project's working notes:
   both Conditions must reference `@triggerBody()?['notifyVia']`, joined
   internally with **Or** — `email`/`both` gate the email action, `teams`/`both`
   gate the Teams action).
4. Re-test with `NOTIFY_DRY_RUN=1` first (see `docs/conventions/local-dev.md`)
   before pointing anything at real recipients.

## Backup log

| Date | Notes |
|---|---|
| _(fill in when you export)_ | Flow confirmed working: email/Teams routed independently via `notifyVia` condition (Or-grouped, dynamic-content bound). |
