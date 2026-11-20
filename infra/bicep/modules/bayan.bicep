// Everything Rishta Safe owns, inside rg-bayan-demo-<region>: container registry, identity, role assignments, a Linux App Service
// plan and (in later phases) the two web apps that run the api and web images on that plan. Nothing here refers to any other
// project's resource.

targetScope = 'resourceGroup'

param location string

param tags object

@description('true: create the api web app (needs apiImage in the registry).')
param deployApi bool

@description('true: also create the web app (needs webImage; implies deployApi).')
param deployWeb bool

param apiImage string

param webImage string

@secure()
param sessionSecret string

param operatorPrincipalId string

param githubOwner string

param githubRepo string

param githubOwnerId string

param githubRepoId string

@description('GitHub environment whose jobs may sign in as the deployer identity.')
param githubEnvironment string = 'demo'

// ---- built-in roles (Microsoft Learn, Azure built-in roles) ------------------------------------------------------------
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'
var contributorRoleId = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

var acrName = 'acrbayan${take(uniqueString(resourceGroup().id), 13)}'

// Web app names are global (<name>.azurewebsites.net), so each carries a short suffix that is stable for this subscription: the
// same subscription always gets the same names, another subscription gets different ones.
var suffix = take(uniqueString(subscription().subscriptionId), 6)
var apiAppName = 'bayan-api-${suffix}'
var webAppName = 'bayan-web-${suffix}'

// ---- identity and registry ---------------------------------------------------------------------------------------------

// Pulls images for both apps: managed-identity pull, no registry admin user, no stored registry password.
resource appsIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: 'id-bayan-apps'
  location: location
  tags: tags
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    // AcrPull and AcrPush are not honoured in an ABAC-mode registry (and ABAC is announced to become the default), so the
    // permission model is pinned. Revisit together with the role assignments below.
    roleAssignmentMode: 'LegacyRegistryPermissions'
    policies: {
      // A managed-identity image pull authenticates with an ARM-audience token.
      azureADAuthenticationAsArmPolicy: {
        status: 'enabled'
      }
    }
  }
}

// Names use resource ids (known at the start of the deployment); principal ids are only known after the identity exists,
// and a role assignment name may not depend on them.
resource appsAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, appsIdentity.id, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: appsIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource operatorAcrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(operatorPrincipalId)) {
  name: guid(registry.id, operatorPrincipalId, acrPushRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
    principalId: operatorPrincipalId
    principalType: 'User'
  }
}

// ---- deployer identity for GitHub Actions (optional; no repository exists yet, so this is unverified) ---------------------

// The subject GitHub puts in the token must match exactly (case-sensitive) or Azure answers AADSTS700213. With only one of the
// two ids the classic subject is used, never a half-formed one.
var immutableSubject = !empty(githubOwnerId) && !empty(githubRepoId)
var classicGithubSubject = 'repo:${githubOwner}/${githubRepo}:environment:${githubEnvironment}'
var immutableGithubSubject = 'repo:${githubOwner}@${githubOwnerId}/${githubRepo}@${githubRepoId}:environment:${githubEnvironment}'

resource deployerIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = if (!empty(githubOwner)) {
  name: 'id-bayan-deployer'
  location: location
  tags: tags
}

resource githubCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2024-11-30' = if (!empty(githubOwner)) {
  parent: deployerIdentity
  name: 'github-${githubEnvironment}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: immutableSubject ? immutableGithubSubject : classicGithubSubject
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

resource deployerAcrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(githubOwner)) {
  name: guid(registry.id, 'deployer', acrPushRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
    principalId: deployerIdentity!.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// No `scope`: the assignment lands on THIS resource group, which holds the apps too.
resource deployerContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(githubOwner)) {
  name: guid(resourceGroup().id, 'deployer', contributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributorRoleId)
    principalId: deployerIdentity!.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---- App Service plan --------------------------------------------------------------------------------------------------

// One Basic (B1) Linux plan, one instance, always on, shared by both apps (an app costs nothing extra on a plan). One instance
// on purpose: the api keeps its state in memory (ADR 0182), so a second instance would be a second, empty demo. B1 has no
// autoscale. The plan fee is fixed per hour whatever the traffic (docs/runbook.md, cost).
resource plan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: 'asp-bayan-demo'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

// ---- apps --------------------------------------------------------------------------------------------------------------

// The api CANNOT be internal-only on App Service Basic: there is no virtual network or private endpoint at this tier, so
// bayan-api has a public https address. It is token-guarded and serves synthetic data only (ADR 0187). Exactly one instance.
module api 'web-app.bicep' = if (deployApi || deployWeb) {
  name: 'app-bayan-api'
  params: {
    name: apiAppName
    location: location
    tags: tags
    planId: plan.id
    identityId: appsIdentity.id
    identityClientId: appsIdentity.properties.clientId
    image: apiImage
    port: 8000
    healthCheckPath: '/healthz'
    appSettings: [
      { name: 'BAYAN_ENV', value: 'demo' }
      { name: 'BAYAN_DEMO_MODE', value: 'true' }
      { name: 'BAYAN_LOG_JSON', value: 'true' }
    ]
    secretSettings: {
      BAYAN_SESSION_SECRET: sessionSecret
    }
  }
}

// bayan-web reaches the api at its public https address; the web server reads BAYAN_API_URL at request time.
module web 'web-app.bicep' = if (deployWeb) {
  name: 'app-bayan-web'
  params: {
    name: webAppName
    location: location
    tags: tags
    planId: plan.id
    identityId: appsIdentity.id
    identityClientId: appsIdentity.properties.clientId
    image: webImage
    port: 3000
    healthCheckPath: ''
    appSettings: [
      { name: 'BAYAN_API_URL', value: 'https://${api!.outputs.defaultHostName}' }
    ]
    secretSettings: {}
  }
}

output acrName string = registry.name
output acrLoginServer string = registry.properties.loginServer
output appsIdentityId string = appsIdentity.id
output planName string = plan.name
output deployerClientId string = !empty(githubOwner) ? deployerIdentity!.properties.clientId : ''
output apiAppName string = apiAppName
output webAppName string = webAppName
@description('Public host of bayan-api (empty until it is deployed).')
output apiHostName string = api.?outputs.?defaultHostName ?? ''
@description('Public host of bayan-web (empty until it is deployed).')
output webHostName string = web.?outputs.?defaultHostName ?? ''
