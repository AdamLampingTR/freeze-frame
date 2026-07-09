# FreezeFrame infrastructure

Restore-if-needed IaC for the deployed Azure Static Web App. Mirrors the live
resource `ccd-freeze-frame-dashboard` (resource group `dashboards`,
subscription `DCO-ThoughtTrace-N`).

## What's here

- `main.bicep` — the `Microsoft.Web/staticSites` resource (Free SKU, GitHub
  deployment linkage) and its `appsettings` config. Secrets are `@secure()`
  parameters with no default — never committed (see `.claude/rules/secrets.md`).

## Deploying / restoring

```bash
az deployment group create \
  --resource-group dashboards \
  --subscription "DCO-ThoughtTrace-N" \
  --template-file infra/main.bicep \
  --parameters \
      adoReposPat="<ThoughtTrace PAT: Code (read)>" \
      adoWorkItemsPat="<tr-core-ai-data-platforms PAT: Work Items (read)>" \
      skipTableConnectionString="<fluffyttisancusfrontend connection string>" \
      powerAutomateWebhookUrl="<flow HTTP trigger URL>"
```

Preview first with `az deployment group what-if` (same args, swap `create` for
`what-if`) — no changes are applied by `what-if`.

## Notes

- **`dashboardUrl`** defaults to a guess based on `staticWebAppName`, but Azure
  assigns a random hostname (e.g. `yellow-dune-028a21210.7.azurestaticapps.net`)
  on first creation that can't be predicted ahead of deploy. After a from-scratch
  restore, re-run with the real hostname once known (or set a custom domain).
- **`repositoryToken`** is only needed the first time the resource is created,
  to wire up the GitHub Actions deployment workflow. Redeploying against the
  existing, already-linked resource doesn't need it.
- Re-running this template against the *existing* live resource resets a
  couple of Azure-computed fields (`stableInboundIP`, `trafficSplitting`,
  `deploymentAuthPolicy`) that aren't declared here — those are platform-managed,
  not something this app configures, so that's expected and harmless. Confirmed
  via `what-if` before ever running a real deployment.
- For the Power Automate notification flow (not an ARM resource — lives in a
  Power Platform environment), see `power-automate/README.md`.
