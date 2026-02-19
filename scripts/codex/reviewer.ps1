param(
  [string]$Ticket
)
$ErrorActionPreference = "Stop"
if (!$Ticket) { throw "Usage: reviewer.ps1 -Ticket docs\tickets\TICK-001.md" }
$root = (Resolve-Path ".").Path
$ticketPath = Join-Path $root $Ticket
if (!(Test-Path $ticketPath)) { throw "Ticket not found: $ticketPath" }

$prompt = @"
ROLE: REVIEWER (read-only)
Follow AGENTS.md + docs/codex/RULES.md.
Review current working tree changes vs ticket requirements.
Output must include:
- Must-fix / Should-fix / Nice-to-have
- Security/auth/RLS concerns (if any)
- Regression risks + extra tests to run

TICKET:
$(Get-Content $ticketPath -Raw)
"@

codex exec -C $root -s read-only -c 'approval_policy="on-request"' $prompt

