<#
.SYNOPSIS
  Deploys, checks and removes the Rishta Safe demo on Azure App Service for Containers (Linux), in Rishta Safe's own resource group.

.DESCRIPTION
  One window, Windows PowerShell 5.1 or PowerShell 7, from anywhere inside the repository.

  Everything Rishta Safe creates lives in ONE resource group, rg-bayan-demo-<region>: a Basic registry, an identity with AcrPull, one
  Basic (B1) Linux App Service plan, and two web apps on that plan, bayan-api-<suffix> and bayan-web-<suffix> (ADR 0187). It
  shares nothing with any other project. The region is uaenorth (tried first, the design target) or germanywestcentral.
  This script never passes any other resource group to a command: every `az` call goes through Invoke-Az, which refuses it,
  and Teardown deletes only a group named rg-bayan-demo-<region> after you type that exact name.

  Actions
    Validate   Read-only. Bicep build, ARM validate and what-if. Creates nothing.
    Infra      Phase 1: group, registry, identity, AcrPull, App Service plan. Without -Location it tries uaenorth, then
               germanywestcentral; a failed attempt's own new group is deleted and its exact error is printed (record it in
               ADR 0186/0187). Reads the plan back from Azure and prints its live location.
    Build      Logs in to the registry, builds the api image (and the web image with -WithWeb), pushes them.
    Deploy     Infra, Build, the api app, wait until it is healthy, Smoke (api only). With -WithWeb also the web app.
    Warm       Checks both apps are on and always-on, then touches them once.
    Smoke      Runs infra/scripts/smoke.ps1 against the api (and the web app when it exists).
    Status     Read-only. Group, plan, apps, replicas, images, addresses, registry tags, the live location.
    Teardown   Deletes rg-bayan-demo-<region> after you type that exact name. Refuses any other name.

  State and secrets: infra/.secrets/bayan.secrets.json (git-ignored; created when an app is deployed; the session secret is
  generated with System.Security.Cryptography.RandomNumberGenerator and is never printed).

.EXAMPLE
  .\infra\scripts\deploy.ps1 -Action Validate
  .\infra\scripts\deploy.ps1 -Action Deploy -Yes
  .\infra\scripts\deploy.ps1 -Action Deploy -Yes -WithWeb
  .\infra\scripts\deploy.ps1 -Action Teardown
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Validate', 'Infra', 'Build', 'Deploy', 'Warm', 'Smoke', 'Status', 'Teardown')]
    [string]$Action,

    # The region. Empty: Infra tries the two in order; the other actions use the one whose group exists.
    [ValidateSet('', 'uaenorth', 'germanywestcentral')]
    [string]$Location = '',

    # Image tag. Default: the 12-character commit when the work tree is clean, otherwise dev-<timestamp>.
    [string]$Tag = '',

    # Build, Deploy: also build, push and deploy the web app. Without it only the api is built and deployed.
    [switch]$WithWeb,

    # Deploy: reuse the images already in the registry for -Tag instead of building.
    [switch]$SkipBuild,

    # Infra, Deploy: do not ask before creating billable resources.
    [switch]$Yes,

    # Optional deployer identity for GitHub Actions (docs/runbook.md, "Deploying from GitHub"). Empty: none is created.
    [string]$GitHubOwner = '',
    [string]$GitHubOwnerId = '',
    [string]$GitHubRepoId = '',

    # Teardown: the exact group name, for a non-interactive run. Without it you are asked to type it.
    [string]$ConfirmGroupName = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---- constants: the whole blast radius of this script --------------------------------------------------------------------

# Regions in the order they are tried. uaenorth is the design target; germanywestcentral is the fallback (ADR 0187).
$script:Regions = @('uaenorth', 'germanywestcentral')
$script:GroupPattern = '^rg-bayan-demo-(uaenorth|germanywestcentral)$'
$script:Group = ''       # set by Set-Region; the only group Invoke-Az accepts
$script:Region = ''
# Another project's groups. Never passed to anything, not even a read.
$script:ForeignGroups = @('rg-stellarblaze-demo-francecentral', 'rg-stellarblaze-demo-uaenorth')
$script:PlanName = 'asp-bayan-demo'

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:SecretsDir = Join-Path $script:RepoRoot 'infra\.secrets'
$script:SecretsFile = Join-Path $script:SecretsDir 'bayan.secrets.json'
$script:BicepParams = Join-Path $script:RepoRoot 'infra\bicep\main.bicepparam'
$script:BicepMain = Join-Path $script:RepoRoot 'infra\bicep\main.bicep'

# ---- helpers ------------------------------------------------------------------------------------------------------------

function Resolve-Az {
    $cmd = Get-Command az -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $known = Join-Path $env:ProgramFiles 'Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
    if (Test-Path $known) { return $known }
    throw 'The Azure CLI (az) was not found. Install it: winget install --exact --id Microsoft.AzureCLI'
}
$script:Az = Resolve-Az

function Write-Step([string]$Text) { Write-Host ('==> ' + $Text) -ForegroundColor Cyan }
function Write-Pass([string]$Text) { Write-Host ('PASS ' + $Text) -ForegroundColor Green }
function Write-Fail([string]$Text) { Write-Host ('FAIL ' + $Text) -ForegroundColor Red }

function Set-Region([string]$Region) {
    if ($script:Regions -notcontains $Region) { throw "Unknown region '$Region'." }
    $script:Region = $Region
    $script:Group = "rg-bayan-demo-$Region"
}

# Runs az with stdout and stderr kept APART (az prints WARNING lines to stderr, which would corrupt JSON or tsv read from
# stdout) and returns the exit code, stdout and stderr. Stderr goes to a temp file: in Windows PowerShell 5.1 a merged stderr
# line becomes a terminating error under $ErrorActionPreference = 'Stop'.
function Invoke-AzRaw {
    [string[]]$RawArgs = $args
    $errFile = [System.IO.Path]::GetTempFileName()
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $script:Az @RawArgs 2> $errFile
        $code = $LASTEXITCODE
        $err = ''
        if (Test-Path $errFile) { $err = [System.IO.File]::ReadAllText($errFile) }
    } finally {
        $ErrorActionPreference = $prev
        Remove-Item $errFile -Force -ErrorAction SilentlyContinue
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace "`r", ''
    return [pscustomobject]@{ Code = $code; Out = $text.Trim(); Err = ($err -replace "`r", '').Trim() }
}

# The one door to `az`. It refuses any resource group that is not ours and any mention of another project's groups, so a typo
# or a copy-paste cannot aim a write at someone else's resources. Returns stdout as text. A non-zero exit throws with stderr.
function Invoke-Az {
    # No param block on purpose: with one, PowerShell would try to bind `-o` and `-g` as its own (abbreviated) parameters.
    [string[]]$AzArgs = $args
    for ($i = 0; $i -lt $AzArgs.Count; $i++) {
        $a = $AzArgs[$i]
        if ($a -in @('-g', '--resource-group') -and ($i + 1) -lt $AzArgs.Count) {
            if (-not $script:Group -or $AzArgs[$i + 1] -ne $script:Group) {
                throw "Refusing: '$($AzArgs[$i + 1])' is not this script's group ('$($script:Group)'). It touches only its own group."
            }
        }
        foreach ($f in $script:ForeignGroups) {
            if ($a -like "*$f*") { throw "Refusing: an argument names another project's resource group ($f)." }
        }
    }
    $r = Invoke-AzRaw @AzArgs
    if ($r.Code -ne 0) {
        throw ("az " + ($AzArgs[0..([Math]::Min(2, $AzArgs.Count - 1))] -join ' ') + " failed (exit $($r.Code)): " + $r.Err + $(if ($r.Out) { "`n" + $r.Out } else { '' }))
    }
    return $r.Out
}

function Test-SignedIn {
    Write-Step 'Azure sign-in'
    $r = Invoke-AzRaw account show -o json
    if ($r.Code -ne 0) { throw "Not signed in. Run: az login`n$($r.Err)" }
    $acct = $r.Out | ConvertFrom-Json
    $script:SubscriptionId = $acct.id
    Write-Pass "signed in; subscription '$($acct.name)'"
}

# Group existence by exact name. Only ever called with a rg-bayan-demo-<region> name.
function Test-GroupExists([string]$Name) {
    if ($Name -notmatch $script:GroupPattern) { throw "Refusing to look at '$Name': not a Rishta Safe group." }
    $r = Invoke-AzRaw group exists --name $Name
    if ($r.Code -ne 0) { throw "az group exists failed: $($r.Err)" }
    return ($r.Out -eq 'true')
}

# Picks the region for every action except Infra without -Location: -Location, else the one Rishta Safe group that exists.
function Resolve-Region([bool]$Required) {
    if ($Location) { Set-Region $Location; return }
    $found = @($script:Regions | Where-Object { Test-GroupExists "rg-bayan-demo-$_" })
    if ($found.Count -eq 1) { Set-Region $found[0]; return }
    if ($found.Count -gt 1) { throw "More than one Rishta Safe group exists ($($found -join ', ')). Pass -Location." }
    if ($Required) { throw 'No Rishta Safe resource group exists yet. Run -Action Infra (or Deploy) first.' }
}

function Test-Docker {
    $v = & docker version --format '{{.Server.Version}}' 2>&1
    if ($LASTEXITCODE -ne 0) { throw "The Docker daemon is not reachable. Start Docker Desktop and wait until it says it is running.`n$(($v | Out-String).Trim())" }
    Write-Pass "docker daemon reachable (server $((($v | Out-String).Trim())))"
}

function New-RandomHex([int]$Bytes) {
    $b = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($b) } finally { $rng.Dispose() }
    return (([BitConverter]::ToString($b) -replace '-', '').ToLowerInvariant())
}

# Creates the secrets file once; later runs reuse it so a redeploy keeps the same session secret. Never printed.
function Get-SessionSecret {
    if (-not (Test-Path $script:SecretsFile)) {
        New-Item -ItemType Directory -Force -Path $script:SecretsDir | Out-Null
        $obj = [ordered]@{ sessionSecret = (New-RandomHex 32); createdUtc = (Get-Date).ToUniversalTime().ToString('o') }
        ($obj | ConvertTo-Json) | Set-Content -Path $script:SecretsFile -Encoding ascii
        # Readable (and deletable) by this Windows account only.
        & icacls $script:SecretsFile /inheritance:r /grant:r "$($env:USERNAME):(F)" | Out-Null
        Write-Pass 'session secret generated and stored in infra\.secrets\bayan.secrets.json (git-ignored, not printed)'
    }
    $s = (Get-Content -Raw $script:SecretsFile | ConvertFrom-Json).sessionSecret
    if (-not $s -or $s.Length -lt 64) { throw 'infra\.secrets\bayan.secrets.json has no usable sessionSecret. Delete the file and run again.' }
    return $s
}

function Get-OperatorObjectId {
    try { return (Invoke-Az ad signed-in-user show --query id -o tsv) } catch { return '' }
}

# Everything main.bicepparam reads. Variables live in this process only; the secret is never on a command line. Phase 1 needs
# no secret, so none is created or passed for it.
function Set-BicepEnvironment([bool]$DeployApi, [bool]$DeployWeb, [string]$ApiImage, [string]$WebImage, [bool]$Ephemeral = $false) {
    $env:BAYAN_LOCATION = $script:Region
    $env:DEPLOY_API = $DeployApi.ToString().ToLowerInvariant()
    $env:DEPLOY_WEB = $DeployWeb.ToString().ToLowerInvariant()
    $env:API_IMAGE = $ApiImage
    $env:WEB_IMAGE = $WebImage
    if (-not ($DeployApi -or $DeployWeb)) { $env:BAYAN_SESSION_SECRET = '' }
    elseif ($Ephemeral) { $env:BAYAN_SESSION_SECRET = New-RandomHex 32 }   # Validate: a throwaway, so it never writes the secrets file
    else { $env:BAYAN_SESSION_SECRET = Get-SessionSecret }
    $env:OPERATOR_PRINCIPAL_ID = Get-OperatorObjectId
    $env:GITHUB_OWNER = $GitHubOwner
    $env:GITHUB_OWNER_ID = $GitHubOwnerId
    $env:GITHUB_REPO_ID = $GitHubRepoId
}

function Clear-BicepEnvironment {
    foreach ($n in 'BAYAN_LOCATION', 'DEPLOY_API', 'DEPLOY_WEB', 'API_IMAGE', 'WEB_IMAGE', 'BAYAN_SESSION_SECRET', 'OPERATOR_PRINCIPAL_ID', 'GITHUB_OWNER', 'GITHUB_OWNER_ID', 'GITHUB_REPO_ID') {
        Remove-Item -Path "Env:$n" -ErrorAction SilentlyContinue
    }
}

function Resolve-Tag {
    if ($Tag) { return $Tag }
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        $dirty = (& git -C $script:RepoRoot status --porcelain 2>$null | Out-String).Trim()
        $sha = (& git -C $script:RepoRoot rev-parse --short=12 HEAD 2>$null | Out-String).Trim()
        if ($sha -and -not $dirty) { return $sha }
        if ($sha) { return "$sha-dirty-$((Get-Date).ToString('yyyyMMddHHmmss'))" }
    }
    return "dev-$((Get-Date).ToString('yyyyMMddHHmmss'))"
}

function Get-AcrLogin {
    $name = Invoke-Az acr list --resource-group $script:Group --query '[0].name' -o tsv
    if (-not $name) { throw "No registry in $($script:Group) yet. Run -Action Infra." }
    return @{ Name = $name; Server = "$name.azurecr.io" }
}

function Confirm-Billable([string]$What) {
    if ($Yes) { return }
    Write-Host ''
    Write-Host $What -ForegroundColor Yellow
    $answer = Read-Host "Type 'yes' to continue"
    if ($answer -ne 'yes') { throw 'Cancelled. Nothing was created.' }
}

# The web app's name begins bayan-web-, the api's bayan-api-; the suffix is derived in Bicep from the subscription id, so it is
# not computed here: it is read back from the group.
function Get-AppName([string]$Prefix) {
    $names = Invoke-Az webapp list --resource-group $script:Group --query "[].name" -o tsv
    $hit = @($names -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -like "$Prefix*" })
    if ($hit.Count -eq 0) { return '' }
    return $hit[0]
}

function Get-AppHost([string]$App) {
    return (Invoke-Az webapp show --name $App --resource-group $script:Group --query defaultHostName -o tsv)
}

# Reads the App Service plan back from Azure and checks it. The location is read from the live resource: the hosting wording
# (ADR 0187) may only name a region this check has seen.
function Test-OwnPlan {
    Write-Step "App Service plan $($script:PlanName) (read back from Azure)"
    $json = Invoke-Az appservice plan show --name $script:PlanName --resource-group $script:Group --query '{sku:sku.name, tier:sku.tier, workers:sku.capacity, location:location, status:status, reserved:reserved}' -o json
    $p = $json | ConvertFrom-Json
    if ($p.sku -ne 'B1' -or -not $p.reserved) { throw "The plan is '$($p.sku)' reserved=$($p.reserved), not a Linux B1." }
    if ($p.status -ne 'Ready') { throw "The plan status is '$($p.status)', not Ready." }
    $live = ($p.location -replace ' ', '').ToLowerInvariant()
    if ($live -ne $script:Region) { throw "The plan reports location '$($p.location)', not $($script:Region)." }
    Write-Pass "plan Ready, Linux $($p.sku), $($p.workers) instance, live location '$($p.location)'"
}

function Invoke-WebRequestStatus([string]$Url, [int]$TimeoutSec) {
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
    try { return [int]$client.GetAsync($Url).GetAwaiter().GetResult().StatusCode } catch { return 0 } finally { $client.Dispose() }
}

# ---- actions ------------------------------------------------------------------------------------------------------------

function Invoke-Validate {
    Test-SignedIn
    if (-not $Location) { Set-Region 'uaenorth' } else { Set-Region $Location }
    Write-Step 'Bicep build and lint'
    Invoke-Az bicep build --file $script:BicepMain --stdout | Out-Null
    Invoke-Az bicep lint --file $script:BicepMain | Out-Null
    Write-Pass 'bicep build and lint'
    foreach ($full in @($false, $true)) {
        $label = if ($full) { 'everything (api and web apps)' } else { 'phase 1 (group, registry, identity, plan)' }
        Set-BicepEnvironment -DeployApi $full -DeployWeb $full -ApiImage 'acrbayanplaceholder.azurecr.io/bayan-api:validate' -WebImage 'acrbayanplaceholder.azurecr.io/bayan-web:validate' -Ephemeral $true
        try {
            Write-Step "ARM validate, $label, $($script:Region)"
            Invoke-Az deployment sub validate --location $script:Region --name "bayan-validate-$($full.ToString().ToLower())" --parameters $script:BicepParams --only-show-errors -o none | Out-Null
            Write-Pass "validate, $label"
            Write-Step "what-if, $label"
            $ids = Invoke-Az deployment sub what-if --location $script:Region --name "bayan-whatif-$($full.ToString().ToLower())" --parameters $script:BicepParams --only-show-errors --no-pretty-print --query 'changes[].[changeType, resourceId]' -o tsv
            $outside = @($ids -split "`n" | Where-Object { $_ -notmatch "/resourceGroups/$($script:Group)(/|\s|$)" })
            if ($outside.Count -gt 0) { throw "what-if lists a change outside $($script:Group): $($outside -join '; ')" }
            $ids -split "`n" | ForEach-Object { Write-Host ('     ' + ($_ -replace '/subscriptions/[^/]+', '')) }
            Write-Pass "what-if, ${label}: every change is inside $($script:Group)"
        } finally { Clear-BicepEnvironment }
    }
    Write-Host 'Validate: done. (ARM validate alone does not run the resource providers preflight; what-if does. Neither tests the App Service quota of the subscription: only creating the plan does.)'
}

function Invoke-Phase1([string]$Stamp) {
    Set-BicepEnvironment -DeployApi $false -DeployWeb $false -ApiImage '' -WebImage ''
    try {
        Invoke-Az deployment sub create --location $script:Region --name "bayan-p1-$($script:Region)-$Stamp" --parameters $script:BicepParams --only-show-errors -o none | Out-Null
    } finally { Clear-BicepEnvironment }
}

# Deletes a group THIS RUN created in a failed attempt, by exact name, and nothing else.
function Remove-FailedAttempt([string]$Region) {
    $name = "rg-bayan-demo-$Region"
    if ($name -notmatch $script:GroupPattern) { throw "Refusing to delete '$name'." }
    if (-not (Test-GroupExists $name)) { Write-Host "     nothing to clean up: $name does not exist"; return }
    Write-Step "Cleaning up the failed attempt: deleting only its own new group $name (waits until it is gone)"
    $r = Invoke-AzRaw group delete --name $name --yes
    if ($r.Code -ne 0) { throw "Could not delete the failed attempt's group ${name}: $($r.Err)" }
    Write-Pass "deleted $name"
}

function Invoke-Infra {
    Test-SignedIn
    $candidates = $script:Regions
    if ($Location) { $candidates = @($Location) }
    Confirm-Billable ("This creates billable Azure resources in rg-bayan-demo-<region> (region tried: $($candidates -join ', ')): a Basic Linux App Service plan B1 (always on, billed per hour whatever the traffic) " +
        "and a Basic registry (about USD 5 a month). No app yet. It writes nothing into any other project's resource group.")
    $stamp = (Get-Date).ToString('yyyyMMddHHmmss')
    $attempts = @()
    foreach ($region in $candidates) {
        Set-Region $region
        $existed = Test-GroupExists $script:Group
        Write-Step "Attempt: phase 1 in $region (group $($script:Group), $(if ($existed) { 'already exists' } else { 'new' }))"
        try {
            Invoke-Phase1 $stamp
            Test-OwnPlan
            Write-Pass "infrastructure ready in $region"
            return
        } catch {
            $msg = $_.Exception.Message
            Write-Fail "attempt in $region failed. EXACT ERROR (record it in the ADR):"
            Write-Host $msg
            $attempts += "$region :: $msg"
            if (-not $existed) { Remove-FailedAttempt $region }
            else { Write-Host "     the group existed before this attempt, so it is left alone" }
        }
    }
    $script:Group = ''
    throw ("No region worked. Attempts:`n" + ($attempts -join "`n"))
}

function Invoke-Build {
    Test-Docker
    $acr = Get-AcrLogin
    $tag = $script:ImageTag
    $apiImage = "$($acr.Server)/bayan-api:$tag"
    $webImage = "$($acr.Server)/bayan-web:$tag"
    Write-Step "Registry login ($($acr.Name))"
    Invoke-Az acr login --name $acr.Name | Out-Null
    Write-Pass 'registry login'
    Write-Step "docker build bayan-api:$tag"
    & docker build --platform linux/amd64 -f (Join-Path $script:RepoRoot 'infra\docker\backend.Dockerfile') -t $apiImage (Join-Path $script:RepoRoot 'backend')
    if ($LASTEXITCODE -ne 0) { throw 'docker build of the api failed.' }
    $images = @($apiImage)
    if ($script:DeployWeb) {
        $apiName = Get-AppName 'bayan-api-'
        if (-not $apiName) { throw 'The api app must exist before the web image is built: its address is the web server setting.' }
        $apiUrl = "https://$(Get-AppHost $apiName)"
        Write-Step "docker build bayan-web:$tag (BAYAN_API_URL $apiUrl)"
        & docker build --platform linux/amd64 -f (Join-Path $script:RepoRoot 'infra\docker\frontend.Dockerfile') --build-arg "BAYAN_API_URL=$apiUrl" -t $webImage (Join-Path $script:RepoRoot 'frontend')
        if ($LASTEXITCODE -ne 0) { throw 'docker build of the web app failed.' }
        $images += $webImage
    }
    foreach ($img in $images) {
        Write-Step "docker push $img"
        & docker push $img
        if ($LASTEXITCODE -ne 0) { throw "docker push of $img failed. If it says unauthorized right after Infra, the AcrPush role is still propagating: wait 5 minutes and run -Action Build again." }
    }
    Write-Pass "images pushed with tag $tag"
    return @{ Api = $apiImage; Web = $webImage }
}

function Invoke-PhaseApps([string]$ApiImage, [string]$WebImage) {
    Write-Step "Bicep: the api app$(if ($script:DeployWeb) { ' and the web app' }) on the plan"
    Set-BicepEnvironment -DeployApi $true -DeployWeb $script:DeployWeb -ApiImage $ApiImage -WebImage $WebImage
    try {
        Invoke-Az deployment sub create --location $script:Region --name "bayan-apps-$($script:Region)-$($script:ImageTag)" --parameters $script:BicepParams --only-show-errors -o none | Out-Null
    } finally { Clear-BicepEnvironment }
    Write-Pass 'apps deployed'
}

# Waits until the app answers 200 on its health path over https. The first start pulls the image with the managed identity;
# a role that has not propagated yet makes the first pull fail and the platform retries.
function Wait-AppHealthy([string]$App, [string]$Path, [int]$TimeoutSec = 600) {
    Write-Step "Waiting for $App to answer 200 on $Path"
    $host_ = Get-AppHost $App
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $last = 0
    while ((Get-Date) -lt $deadline) {
        $last = Invoke-WebRequestStatus "https://$host_$Path" 30
        if ($last -eq 200) { Write-Pass "$App healthy: https://$host_$Path -> 200"; return }
        Start-Sleep -Seconds 10
    }
    throw "$App did not answer 200 on $Path within $TimeoutSec s (last status $last). Look: az webapp log tail --name $App --resource-group $($script:Group)"
}

function Enable-ContainerLogging([string]$App) {
    Invoke-Az webapp log config --name $App --resource-group $script:Group --docker-container-logging filesystem -o none | Out-Null
}

function Invoke-Warm {
    foreach ($pair in @(@('bayan-api-', '/healthz'), @('bayan-web-', '/en'))) {
        $app = Get-AppName $pair[0]
        if (-not $app) { Write-Host "     no $($pair[0])* app yet: skipped"; continue }
        $always = Invoke-Az webapp config show --name $app --resource-group $script:Group --query alwaysOn -o tsv
        if ($always -ne 'true') {
            Write-Step "$app is not always-on: setting it (the only change Warm makes)"
            Invoke-Az webapp config set --name $app --resource-group $script:Group --always-on true -o none | Out-Null
        }
        Wait-AppHealthy $app $pair[1] 300
    }
    Write-Pass 'warm: the deployed apps are always-on and answering'
}

function Invoke-SmokeTest {
    $apiName = Get-AppName 'bayan-api-'
    if (-not $apiName) { throw 'No api app exists yet.' }
    $smokeArgs = @{ ApiBaseUrl = "https://$(Get-AppHost $apiName)" }
    $webName = Get-AppName 'bayan-web-'
    if ($webName) { $smokeArgs['BaseUrl'] = "https://$(Get-AppHost $webName)" }
    & (Join-Path $PSScriptRoot 'smoke.ps1') @smokeArgs
    if ($LASTEXITCODE -ne 0) { throw 'The smoke test failed.' }
}

function Invoke-Status {
    Test-SignedIn
    Resolve-Region $false
    if (-not $script:Group) { Write-Host 'No Rishta Safe resource group exists (nothing deployed, or already torn down).'; return }
    Write-Step "Resource group $($script:Group)"
    Invoke-Az resource list --resource-group $script:Group --query '[].{name:name, type:type, location:location}' -o table | Write-Host
    try { Test-OwnPlan } catch { Write-Host $_.Exception.Message }
    foreach ($prefix in 'bayan-api-', 'bayan-web-') {
        $app = Get-AppName $prefix
        if (-not $app) { Write-Host "no $prefix* app yet"; continue }
        Write-Step $app
        $q = '{state:state, host:defaultHostName, httpsOnly:httpsOnly, image:siteConfig.linuxFxVersion, location:location}'
        Invoke-Az webapp show --name $app --resource-group $script:Group --query $q -o json | Write-Host
        $c = Invoke-Az webapp config show --name $app --resource-group $script:Group --query '{alwaysOn:alwaysOn, minTls:minTlsVersion, ftps:ftpsState, health:healthCheckPath, workers:numberOfWorkers}' -o json
        Write-Host $c
    }
    try {
        $acr = Get-AcrLogin
        foreach ($repo in 'bayan-api', 'bayan-web') {
            Write-Step "registry $($acr.Name): newest tags of $repo"
            try { Invoke-Az acr repository show-tags --name $acr.Name --repository $repo --orderby time_desc --top 5 -o tsv | Write-Host } catch { Write-Host 'no image yet' }
        }
    } catch { Write-Host $_.Exception.Message }
    Write-Host ''
    $api = Get-AppName 'bayan-api-'
    if ($api) { Write-Host "Logs : az webapp log tail --name $api --resource-group $($script:Group)" }
}

function Invoke-Teardown {
    Test-SignedIn
    Resolve-Region $true
    Write-Step "Teardown deletes the resource group $($script:Group) and everything in it"
    # Refuse any other name, however it arrives.
    $typed = $ConfirmGroupName
    if (-not $typed) {
        Write-Host 'This permanently deletes: the apps, the plan, the registry and its images, the identity. It does not touch any other resource group.'
        $typed = Read-Host "Type the exact resource group name to delete ($($script:Group))"
    }
    if ($typed -ne $script:Group) {
        throw "Refused: '$typed' is not '$($script:Group)'. Teardown deletes only that group."
    }
    if ($script:ForeignGroups -contains $typed -or $typed -notmatch $script:GroupPattern) { throw "Refused: '$typed' is not a Rishta Safe group." }
    Invoke-Az resource list --resource-group $script:Group --query '[].name' -o tsv | ForEach-Object { Write-Host ('     deleting ' + $_) }
    Invoke-Az group delete --name $script:Group --yes --no-wait | Out-Null
    Write-Pass "deletion of $($script:Group) started (it returns at once). Confirm in about 10 minutes: az group exists --name $($script:Group)  ->  false"
}

function Invoke-Deploy {
    if (-not $SkipBuild) { Test-Docker }
    Invoke-Infra
    $null = Get-SessionSecret
    $script:ImageTag = Resolve-Tag
    Write-Pass "image tag $($script:ImageTag)"
    $acr = Get-AcrLogin
    $apiExists = [bool](Get-AppName 'bayan-api-')
    if ($script:DeployWeb -and -not $apiExists) {
        # The web image needs the api's address, which exists only once the api app does: deploy the api first, then the web app.
        $script:DeployWeb = $false
        $null = Invoke-DeployStage $acr
        $script:DeployWeb = $true
    }
    $null = Invoke-DeployStage $acr
    Write-Host ''
    $api = Get-AppName 'bayan-api-'
    Write-Host ("Api (public, token-guarded): https://" + (Get-AppHost $api))
    if ($script:DeployWeb) { Write-Host ("Web (public)               : https://" + (Get-AppHost (Get-AppName 'bayan-web-'))) }
}

function Invoke-DeployStage($Acr) {
    if ($SkipBuild) {
        $images = @{ Api = "$($Acr.Server)/bayan-api:$($script:ImageTag)"; Web = "$($Acr.Server)/bayan-web:$($script:ImageTag)" }
    } else {
        $images = Invoke-Build
    }
    Invoke-PhaseApps $images.Api $images.Web
    $api = Get-AppName 'bayan-api-'
    Enable-ContainerLogging $api
    Wait-AppHealthy $api '/healthz'
    if ($script:DeployWeb) {
        $web = Get-AppName 'bayan-web-'
        Enable-ContainerLogging $web
        Wait-AppHealthy $web '/en'
    }
    Invoke-SmokeTest
    return $true
}

# ---- dispatch -----------------------------------------------------------------------------------------------------------

$script:DeployWeb = [bool]$WithWeb

try {
    switch ($Action) {
        'Validate' { Invoke-Validate }
        'Infra' { Invoke-Infra }
        'Build' {
            Test-SignedIn
            Resolve-Region $true
            Test-OwnPlan
            $script:ImageTag = Resolve-Tag
            $null = Invoke-Build
        }
        'Deploy' { Test-SignedIn; Invoke-Deploy }
        'Warm' { Test-SignedIn; Resolve-Region $true; Invoke-Warm }
        'Smoke' { Test-SignedIn; Resolve-Region $true; Invoke-SmokeTest }
        'Status' { Invoke-Status }
        'Teardown' { Invoke-Teardown }
    }
} catch {
    Write-Fail $_.Exception.Message
    exit 1
}
