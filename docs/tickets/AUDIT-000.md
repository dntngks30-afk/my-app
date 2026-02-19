# Ticket: AUDIT-000 — Full Repo Audit (FE/BE/DB/RLS)

## Context
We have main homepage + free test + result page implemented.
Auth/signup and DB 저장까지 완료. We need a prioritized audit and actionable tickets.

## Goals
- Produce TOP issues list (severity/impact/where)
- Split into 5~12 executable tickets with acceptance criteria + test plan
- Identify Supabase/RLS and auth flow risks

## Acceptance Criteria
- A markdown report: findings + recommended fixes
- Ticket list written to `docs/tickets/` naming: TICK-001, TICK-002, ...

## Test Plan
- Identify available commands (package.json)
- Propose smoke checklist if no tests exist

## Risks / Rollback
- Keep read-only for audit. No code changes in this ticket.
