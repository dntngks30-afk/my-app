param(
  [Parameter(Mandatory=$true)][string]$Id,
  [Parameter(Mandatory=$true)][string]$Title
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
$template = Join-Path $root "docs\tickets\TEMPLATE.md"
$out = Join-Path $root ("docs\tickets\{0}.md" -f $Id)
if (Test-Path $out) { throw "Already exists: $out" }

$content = (Get-Content $template -Raw) `
  -replace "<ID>", $Id `
  -replace "<TITLE>", $Title

$content | Set-Content -Encoding UTF8 -Path $out
Write-Host "Created: $out"
