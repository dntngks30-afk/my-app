# Codex Team Playbook (Windows Native)

## Quick start
1) Create/choose a ticket in `docs/tickets/`
2) Run Architect for audit/plan
3) Run Implementer (FE/BE)
4) Run Reviewer
5) Run QA

## Commands (from repo root)
- Architect:
  `.\scripts\codex\architect.ps1 -Ticket docs\tickets\AUDIT-000.md`

- FE Implementer:
  `.\scripts\codex\implementer-fe.ps1 -Ticket docs\tickets\TICK-001.md`

- BE Implementer:
  `.\scripts\codex\implementer-be.ps1 -Ticket docs\tickets\TICK-002.md`

- Reviewer:
  `.\scripts\codex\reviewer.ps1 -Ticket docs\tickets\TICK-001.md`

- QA:
  `.\scripts\codex\qa.ps1 -Ticket docs\tickets\TICK-001.md`

## Tips
- Use feature branches per ticket.
- If Codex asks approval for a network command (e.g., npm install), verify the command and approve.
- Keep changes small: 1 ticket = 1 coherent outcome.
