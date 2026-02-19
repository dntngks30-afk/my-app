param(
  [string]$Ticket
)
$ErrorActionPreference = "Stop"
if (!$Ticket) { throw "Usage: implementer-fe.ps1 -Ticket docs\tickets\TICK-001.md" }
$root = (Resolve-Path ".").Path
$ticketPath = Join-Path $root $Ticket
if (!(Test-Path $ticketPath)) { throw "Ticket not found: $ticketPath" }

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if ($branch -eq "main") {
  Write-Host "⚠ You are on main. Recommended: git checkout -b feat/<ticket-id>" -ForegroundColor Yellow
}

$prompt = @"
ROLE: IMPLEMENTER-FE (workspace-write)
Follow AGENTS.md + docs/codex/RULES.md.
Implement ONLY what the ticket asks. Minimal diff. No unrelated refactors.
After changes: summarize + how to test. Run best-effort: npm run lint/build if available.

TICKET:
$(Get-Content $ticketPath -Raw)
"@

codex exec -C $root --full-auto $prompt
