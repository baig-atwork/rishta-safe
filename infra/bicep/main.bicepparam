// Every value comes from an environment variable, so no inline `--parameters key=value` is mixed with this file (the Azure
// CLI does not combine a .bicepparam file with inline parameters). infra/scripts/deploy.ps1 and deploy.yml export them.
// Secrets reach Bicep only this way; none is written here, none is passed on a command line.
//
// Required:
//   BAYAN_LOCATION  uaenorth | germanywestcentral: the region; the group is named rg-bayan-demo-<region>
//   DEPLOY_API      false = phase 1 only (group, registry, identity, plan); true = also the api app
//   DEPLOY_WEB      false = no web app; true = also the web app (implies the api app)
// Needed when an app is deployed:
//   API_IMAGE (and WEB_IMAGE for the web app)  BAYAN_SESSION_SECRET (secret, 64 hex characters)
// Optional (default in brackets):
//   OPERATOR_PRINCIPAL_ID ['']   object id of the signed-in user: gets AcrPush on the registry
//   GITHUB_OWNER ['']  GITHUB_REPO [bayan]  GITHUB_OWNER_ID ['']  GITHUB_REPO_ID ['']   deployer identity for GitHub Actions

using 'main.bicep'

param location = readEnvironmentVariable('BAYAN_LOCATION')
param deployApi = bool(readEnvironmentVariable('DEPLOY_API'))
param deployWeb = bool(readEnvironmentVariable('DEPLOY_WEB'))
param apiImage = readEnvironmentVariable('API_IMAGE', '')
param webImage = readEnvironmentVariable('WEB_IMAGE', '')
param sessionSecret = readEnvironmentVariable('BAYAN_SESSION_SECRET', '')
param operatorPrincipalId = readEnvironmentVariable('OPERATOR_PRINCIPAL_ID', '')
param githubOwner = readEnvironmentVariable('GITHUB_OWNER', '')
param githubRepo = readEnvironmentVariable('GITHUB_REPO', 'bayan')
param githubOwnerId = readEnvironmentVariable('GITHUB_OWNER_ID', '')
param githubRepoId = readEnvironmentVariable('GITHUB_REPO_ID', '')
