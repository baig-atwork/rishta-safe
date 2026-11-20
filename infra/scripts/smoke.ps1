<#
.SYNOPSIS
  Smoke test of a running Rishta Safe demo: the api (health, personas, cases, a couple's result in Arabic, the staff view, a refused
  third-party request, the audit chain) and, when a web address is given, the web landing in three locales and the web proxy.

.DESCRIPTION
  Works on Windows PowerShell 5.1 and PowerShell 7 (the deploy workflow runs it with pwsh on Linux). It changes nothing except
  one request that the product must refuse (and log). Exit code 0 when every check passed, 1 otherwise.

  Modes
    -ApiBaseUrl https://<api host>                       api only (the first deployment step: the web app does not exist yet)
    -ApiBaseUrl https://<api host> -BaseUrl https://<web>  api directly, plus the web checks
    -BaseUrl https://<web>                               everything through the web proxy at /api (it forwards /api/v1/* only,
                                                         so the api's own /healthz and /readyz are not reachable that way)

  The calls and shapes are the ones backend/tests/integration/test_demo_flow.py makes (read 2026-11-20): personas are a list of
  objects with id, role and token.access_token; the seeded couples are cpl-demo-01..10; a couple member's persona id is
  cpl-demo-NN-a or -b; the judge persona is the staff view; a third-party request needs no token and is always 403.

.EXAMPLE
  .\infra\scripts\smoke.ps1 -ApiBaseUrl https://bayan-api-abc123.azurewebsites.net
  .\infra\scripts\smoke.ps1 -ApiBaseUrl http://127.0.0.1:8000 -BaseUrl http://localhost:3000
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = '',
    [string]$ApiBaseUrl = '',
    [string]$ApiPrefix = '/api',
    [int]$TimeoutSec = 60,
    [string[]]$Locales = @('en', 'ar', 'ur')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

if (-not $BaseUrl -and -not $ApiBaseUrl) { throw 'Give -ApiBaseUrl (api only), -BaseUrl (through the web app), or both.' }
$BaseUrl = $BaseUrl.TrimEnd('/')
if ($ApiBaseUrl) { $apiRoot = $ApiBaseUrl.TrimEnd('/') } else { $apiRoot = $BaseUrl + '/' + $ApiPrefix.Trim('/') }
$direct = [bool]$ApiBaseUrl

$script:Failures = 0
$script:Client = New-Object System.Net.Http.HttpClient
$script:Client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)

function Send-Http {
    param([string]$Method, [string]$Url, [string]$Token = '', [string]$Json = '')
    $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::new($Method), $Url)
    if ($Token) { $req.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue ('Bearer', $Token) }
    if ($Json) { $req.Content = New-Object System.Net.Http.StringContent ($Json, [System.Text.Encoding]::UTF8, 'application/json') }
    try {
        $resp = $script:Client.SendAsync($req).GetAwaiter().GetResult()
        $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $body; Error = '' }
    } catch {
        return [pscustomobject]@{ Status = 0; Body = ''; Error = $_.Exception.GetBaseException().Message }
    } finally { $req.Dispose() }
}

function Report([string]$Name, [bool]$Ok, [string]$Detail) {
    if ($Ok) { Write-Host ("PASS {0}: {1}" -f $Name, $Detail) -ForegroundColor Green }
    else { Write-Host ("FAIL {0}: {1}" -f $Name, $Detail) -ForegroundColor Red; $script:Failures++ }
}

function ConvertFrom-JsonSafe([string]$Text) { try { return ($Text | ConvertFrom-Json) } catch { return $null } }

# Property read that is safe under Set-StrictMode when the JSON object lacks the property (a 404 body, for example).
function Get-Prop($Obj, [string]$Name) {
    if ($null -ne $Obj -and $Obj.PSObject.Properties.Name -contains $Name) { return $Obj.$Name }
    return $null
}

# A cold or just-deployed app can answer 502/503 for a while: retry the first request of the run.
function Wait-Reachable([string]$Url) {
    $deadline = (Get-Date).AddSeconds(180)
    while ((Get-Date) -lt $deadline) {
        $r = Send-Http 'GET' $Url
        if ($r.Status -eq 200) { return $r }
        Start-Sleep -Seconds 5
    }
    return (Send-Http 'GET' $Url)
}

# 1. api reachable. Direct: its own liveness and readiness. Through the web: the first proxied v1 route.
if ($direct) {
    $r = Wait-Reachable ($apiRoot + '/healthz')
    $health = ConvertFrom-JsonSafe $r.Body
    Report 'api /healthz' ($r.Status -eq 200 -and (Get-Prop $health 'status') -eq 'ok') ("GET {0}/healthz -> {1} {2}{3}" -f $apiRoot, $r.Status, $r.Body, $r.Error)
    $r = Send-Http 'GET' ($apiRoot + '/readyz')
    $ready = ConvertFrom-JsonSafe $r.Body
    $services = @(Get-Prop $ready 'services')
    Report 'api /readyz' ($r.Status -eq 200 -and (Get-Prop $ready 'status') -eq 'ready' -and $services.Count -ge 5) ("GET /readyz -> {0}, {1} service(s) built" -f $r.Status, $services.Count)
} else {
    $r = Wait-Reachable ($apiRoot + '/v1/demo/personas')
    Report 'web to api' ($r.Status -eq 200) ("GET {0}/v1/demo/personas -> {1} {2} (the api /healthz is not proxied)" -f $apiRoot, $r.Status, $r.Error)
}

# 2. personas: 4 staff personas plus 20 couple members, every token flagged simulated
$r = Send-Http 'GET' ($apiRoot + '/v1/demo/personas')
$personas = @()
if ($r.Status -eq 200) { $personas = @(ConvertFrom-JsonSafe $r.Body) }
$tokens = @{}
$members = 0
$allSimulated = $personas.Count -gt 0
foreach ($p in $personas) {
    $id = [string](Get-Prop $p 'id')
    $tok = Get-Prop $p 'token'
    $access = [string](Get-Prop $tok 'access_token')
    if ($id -and $access) { $tokens[$id] = $access }
    if ((Get-Prop $p 'role') -eq 'couple_member') { $members++ }
    if ((Get-Prop $tok 'simulated') -ne $true) { $allSimulated = $false }
}
$staffOk = ('clinician', 'counsellor', 'programme', 'judge' | Where-Object { $tokens.ContainsKey($_) }).Count -eq 4
Report 'api /v1/demo/personas' ($r.Status -eq 200 -and $staffOk -and $members -eq 20 -and $allSimulated) ("status {0}, {1} persona(s), {2} couple member(s), all tokens simulated: {3}" -f $r.Status, $personas.Count, $members, $allSimulated)

$judge = ''
if ($tokens.ContainsKey('judge')) { $judge = $tokens['judge'] }

# 3. ten seeded synthetic cases
$r = Send-Http 'GET' ($apiRoot + '/v1/demo/cases')
$cases = @()
if ($r.Status -eq 200) { $cases = @(ConvertFrom-JsonSafe $r.Body) }
Report 'api /v1/demo/cases' ($r.Status -eq 200 -and $cases.Count -eq 10) ("status {0}, {1} case(s)" -f $r.Status, $cases.Count)

# 4. a couple member reads a released result in Arabic: the category is in the closed vocabulary, staff-only fields are absent
$memberToken = ''
if ($tokens.ContainsKey('cpl-demo-02-a')) { $memberToken = $tokens['cpl-demo-02-a'] }
$r = Send-Http 'GET' ($apiRoot + '/v1/couples/cpl-demo-02/result?locale=ar') $memberToken
$doc = ConvertFrom-JsonSafe $r.Body
$disclosed = Get-Prop $doc 'disclosed'
$document = Get-Prop $doc 'document'
$category = [string](Get-Prop $disclosed 'category')
$blocks = @(Get-Prop $document 'blocks')
$closed = $category -in @('shared_result_found', 'no_shared_change_found', 'more_information_needed')
$checkOk = (Get-Prop (Get-Prop $document 'check') 'ok') -eq $true
$noStaffField = $null -eq (Get-Prop $disclosed 'review_priority')
Report 'api result, couple member, ar' ($r.Status -eq 200 -and $closed -and $checkOk -and $noStaffField -and $blocks.Count -gt 0) ("GET /v1/couples/cpl-demo-02/result?locale=ar -> {0}, category '{1}', {2} block(s), checker ok: {3}, staff-only fields absent: {4}" -f $r.Status, $category, $blocks.Count, $checkOk, $noStaffField)

# 5. the staff (judge) view of the same couple carries the engine's category and a review priority
$r = Send-Http 'GET' ($apiRoot + '/v1/couples/cpl-demo-02/result?locale=en') $judge
$doc = ConvertFrom-JsonSafe $r.Body
$disclosed = Get-Prop $doc 'disclosed'
$priority = [string](Get-Prop $disclosed 'review_priority')
Report 'api result, staff view' ($r.Status -eq 200 -and (Get-Prop $disclosed 'category') -eq 'shared_result_found' -and $priority -in @('routine', 'priority', 'urgent')) ("GET /v1/couples/cpl-demo-02/result?locale=en as judge -> {0}, category '{1}', review priority '{2}'" -f $r.Status, (Get-Prop $disclosed 'category'), $priority)

# 6. audit chain verifies; then a third-party (employer) request is refused and logged, and the chain grew and still verifies
$r = Send-Http 'GET' ($apiRoot + '/v1/audit/verify') $judge
$v = ConvertFrom-JsonSafe $r.Body
$before = [int](Get-Prop $v 'length')
Report 'api audit chain' ($r.Status -eq 200 -and (Get-Prop $v 'ok') -eq $true) ("GET /v1/audit/verify -> {0}, ok {1}, length {2}" -f $r.Status, (Get-Prop $v 'ok'), $before)

$r = Send-Http 'POST' ($apiRoot + '/v1/third-party-requests') '' '{"couple_id":"cpl-demo-01","kind":"employer"}'
Report 'api third-party refusal' ($r.Status -eq 403 -and $r.Body -match 'Art\. 19 to 21') ("POST /v1/third-party-requests (kind employer, no token) -> {0}, cites Art. 19 to 21: {1}" -f $r.Status, ($r.Body -match 'Art\. 19 to 21'))

$r = Send-Http 'GET' ($apiRoot + '/v1/audit/verify') $judge
$v = ConvertFrom-JsonSafe $r.Body
$after = [int](Get-Prop $v 'length')
Report 'api refusal was logged' ($r.Status -eq 200 -and (Get-Prop $v 'ok') -eq $true -and $after -gt $before) ("audit length {0} -> {1}, chain still ok: {2}" -f $before, $after, (Get-Prop $v 'ok'))

# 7. web checks (only when a web address was given): the landing page in three locales. Arabic and Urdu are right-to-left.
if ($BaseUrl) {
    foreach ($loc in $Locales) {
        $r = Send-Http 'GET' ("{0}/{1}" -f $BaseUrl, $loc)
        $ok = $r.Status -eq 200 -and $r.Body -match '<html'
        $detail = "GET /$loc -> $($r.Status) $($r.Error)"
        if ($ok -and $loc -in @('ar', 'ur')) {
            $rtl = $r.Body -match '<html[^>]*\sdir="rtl"'
            $ok = $rtl
            $detail += $(if ($rtl) { ', dir="rtl"' } else { ', MISSING dir="rtl" on <html>' })
        }
        Report "web /$loc" $ok $detail
    }
    if ($direct) {
        $r = Send-Http 'GET' ($BaseUrl + '/' + $ApiPrefix.Trim('/') + '/v1/demo/cases')
        $viaWeb = @()
        if ($r.Status -eq 200) { $viaWeb = @(ConvertFrom-JsonSafe $r.Body) }
        Report 'web to api proxy' ($r.Status -eq 200 -and $viaWeb.Count -eq 10) ("GET {0}{1}/v1/demo/cases -> {2}, {3} case(s)" -f $BaseUrl, $ApiPrefix, $r.Status, $viaWeb.Count)
    }
}

$script:Client.Dispose()
Write-Host ''
if ($script:Failures -eq 0) { Write-Host 'SMOKE OK' -ForegroundColor Green; exit 0 }
Write-Host ("SMOKE FAILED: {0} check(s)" -f $script:Failures) -ForegroundColor Red
exit 1
