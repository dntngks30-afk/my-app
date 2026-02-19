param(
  [string]$Ticket
)
$ErrorActionPreference = "Stop"
if (!$Ticket) { throw "Usage: qa.ps1 -Ticket docs\tickets\TICK-001.md" }
$root = (Resolve-Path ".").Path
$ticketPath = Join-Path $root $Ticket
if (!(Test-Path $ticketPath)) { throw "Ticket not found: $ticketPath" }

$prompt = @"
ROLE: QA (workspace-write)
Follow AGENTS.md + docs/codex/RULES.md.
Goal: validate the ticket outcome with best-effort checks.
- Suggest/execute smoke tests
- If missing: add a minimal smoke checklist or lightweight test (only if ticket allows)
- Ensure build/lint commands are documented

TICKET:
$(Get-Content $ticketPath -Raw)
"@

codex exec -C $root -s workspace-write -c 'approval_policy="on-request"' $prompt

