// Restores the FreezeFrame Azure Static Web App (Microsoft.Web/staticSites)
// and its application settings. Mirrors the resource as deployed:
// ccd-freeze-frame-dashboard, resource group "dashboards".
// Secrets are @secure() params with no default — supply them at deploy time,
// never commit real values here (see .claude/rules/secrets.md).

@description('Azure region for the Static Web App.')
param location string = 'centralus'

@description('Name of the Static Web App resource.')
param staticWebAppName string = 'ccd-freeze-frame-dashboard'

@description('GitHub repository URL backing this Static Web App.')
param repositoryUrl string = 'https://github.com/AdamLampingTR/freeze-frame'

@description('Branch the Static Web App deploys from.')
param branch string = 'main'

@description('GitHub PAT (repo/workflow scope) used once to wire up the GitHub Actions deployment on first create. Not required when redeploying an existing, already-linked resource.')
@secure()
param repositoryToken string = ''

@description('Dashboard URL used in notification payloads. Leave empty to use the resource\'s own assigned hostname (resolved automatically on both fresh-create and redeploy); set explicitly only to override with a custom domain.')
param dashboardUrl string = ''

@secure()
param adoReposPat string

@secure()
param adoWorkItemsPat string

@secure()
param skipTableConnectionString string

@secure()
param powerAutomateWebhookUrl string

@description('Set to "1" so redeploys never re-enable live notifications by accident; flip to "0" deliberately once verified.')
param notifyDryRun string = '1'

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  tags: {
    'tr:application-asset-insight-id': '208239'
    'tr:environment-type': 'Development'
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    repositoryToken: repositoryToken
    provider: 'GitHub'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

resource appSettings 'Microsoft.Web/staticSites/config@2022-09-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    ADO_REPOS_ORG: 'ThoughtTrace'
    ADO_REPOS_PROJECT: 'ThoughtTrace Core'
    ADO_REPOS_PAT: adoReposPat
    ADO_WORKITEMS_ORG: 'tr-core-ai-data-platforms'
    ADO_WORKITEMS_PROJECT: 'CoCounsel'
    ADO_WORKITEMS_PAT: adoWorkItemsPat
    SKIP_TABLE_CONNECTION_STRING: skipTableConnectionString
    POWER_AUTOMATE_WEBHOOK_URL: powerAutomateWebhookUrl
    NOTIFY_DRY_RUN: notifyDryRun
    DASHBOARD_URL: empty(dashboardUrl) ? 'https://${staticWebApp.properties.defaultHostname}' : dashboardUrl
  }
}

output defaultHostname string = staticWebApp.properties.defaultHostname
