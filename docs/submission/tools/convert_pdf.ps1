# Export a PPTX to PDF with the portable LibreOffice (D:\tools\libreoffice). Usage: convert_pdf.ps1 -In deck.pptx -OutDir dir
param([Parameter(Mandatory)][string]$In, [Parameter(Mandatory)][string]$OutDir)
$lo = 'D:\tools\libreoffice\program\soffice.com'
if (-not (Test-Path $lo)) { throw "portable LibreOffice not found at $lo" }
$pdf = Join-Path $OutDir ([IO.Path]::GetFileNameWithoutExtension($In) + '.pdf')
Remove-Item $pdf -ErrorAction SilentlyContinue
$a = @('-env:UserInstallation=file:///D:/tools/lo-profile', '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', $OutDir, $In)
$p = Start-Process -FilePath $lo -ArgumentList $a -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\lo-out.txt" -RedirectStandardError "$env:TEMP\lo-err.txt"
if (-not $p.WaitForExit(300000)) { Stop-Process -Id $p.Id -Force; Get-Process soffice* -ErrorAction SilentlyContinue | Stop-Process -Force; throw 'LibreOffice timed out after 300 s' }
if (-not (Test-Path $pdf)) { Get-Content "$env:TEMP\lo-err.txt" -ErrorAction SilentlyContinue | Select-Object -First 5; throw 'no PDF produced' }
"pdf: $pdf ($([math]::Round((Get-Item $pdf).Length/1KB)) KB)"
