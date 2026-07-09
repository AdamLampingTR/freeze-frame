---
---
Never commit PATs, connection strings, or webhook URLs. Config comes from SWA app settings (deployed) or gitignored `api/local.settings.json` (local). Use `NOTIFY_DRY_RUN=1` locally so notifications log instead of sending. See `api/local.settings.json.example`.
