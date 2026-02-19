param(
  [string]$Ticket
)
$ErrorActionPreference = "Stop"
if (!$Ticket) { throw "Usage: implementer-be.ps1 -Ticket docs\tickets\TICK-002.md" }
$root = (Resolve-Path ".").Path
$ticketPath = Join-Path $root $Ticket
if (!(Test-Path $ticketPath)) { throw "Ticket not found: $ticketPath" }

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if ($branch -eq "main") {
  Write-Host "⚠ You are on main. Recommended: git checkout -b feat/<ticket-id>" -ForegroundColor Yellow
}

$prompt = @"
ROLE: IMPLEMENTER-BE (workspace-write, untrusted approvals)
Follow AGENTS.md + docs/codex/RULES.md.
Be strict about auth/RLS/security. Do not change DB/RLS unless ticket explicitly allows it with rollback.
After changes: summarize + how to test. Run best-effort build/lint/tests.

TICKET:
$(Get-Content $ticketPath -Raw)
"@

codex exec -C $root -s workspace-write -c 'approval_policy="untrusted"' $prompt

