// One Linux container web app on an App Service plan: image pulled from the registry with a managed identity (no admin user, no
// stored registry password), HTTPS only, TLS 1.2 minimum, FTP and FTPS disabled, always on.

targetScope = 'resourceGroup'

@description('App name; also the first label of <name>.azurewebsites.net, so it is global.')
@minLength(8)
param name string

param location string

param tags object

@description('Resource id of the App Service plan.')
param planId string

@description('Resource id of the user-assigned identity with AcrPull on the registry.')
param identityId string

@description('Client id of that identity (the platform wants the client id for the registry pull).')
param identityClientId string

@description('Full image reference, for example acrname.azurecr.io/bayan-api:<tag>.')
param image string

@description('Container port (WEBSITES_PORT).')
@minValue(1)
@maxValue(65535)
param port int

@description('Health check path. Empty: none.')
param healthCheckPath string

@description('Plain app settings: { name, value } entries.')
param appSettings array

@secure()
@description('Secret app settings as an object: name to value. A secure object, so Azure redacts it from the deployment history; the array the platform wants is built below. App settings are encrypted at rest and are not readable with Reader access.')
param secretSettings object

var secretEntries = [for settingName in objectKeys(secretSettings): {
  name: settingName
  value: secretSettings[settingName]
}]

var platformSettings = [
  { name: 'WEBSITES_PORT', value: string(port) }
  // The container's file system is the platform's scratch space; nothing needs the persistent /home share.
  { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
]

resource site 'Microsoft.Web/sites@2025-03-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOCKER|${image}'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: identityClientId
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      numberOfWorkers: 1
      healthCheckPath: empty(healthCheckPath) ? null : healthCheckPath
      appSettings: concat(platformSettings, appSettings, secretEntries)
    }
  }
}

output name string = site.name
output defaultHostName string = site.properties.defaultHostName
