param(
  [string]$Ticket = "docs\tickets\AUDIT-000.md"
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
$ticketPath = Join-Path $root $Ticket
if (!(Test-Path $ticketPath)) { throw "Ticket not found: $ticketPath" }

$prompt = @"
ROLE: ARCHITECT (read-only)
You must follow AGENTS.md + docs/codex/RULES.md.
Read and execute this ticket (do not modify files in this run):

TICKET:
$(Get-Content $ticketPath -Raw)

OUTPUT:
- Findings TOP10 (severity, evidence, file/area)
- Quick wins (<=1h), Medium (1-4h), Large (>1d)
- Proposed tickets (TICK-001..): each with Goal, Acceptance Criteria, Test Plan, Files
"@

codex exec -C $root -s read-only -c 'approval_policy="on-request"' $prompt

