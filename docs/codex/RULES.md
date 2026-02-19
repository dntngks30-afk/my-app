# Codex Team Rules (Local Windows / PowerShell)

## Roles
- Architect: read-only audit, plan, split into tickets.
- Implementer-FE: UI/UX, Next.js pages/components, client logic.
- Implementer-BE: API routes, server actions, Supabase integration, RLS checks (with extreme care).
- Reviewer: diff-based review, security, edge cases, regression risks.
- QA: reproduce issues, add smoke tests, check build/lint, tighten acceptance criteria.

## Guardrails
- Default to read-only for audits and reviews.
- For implementation, allow workspace-write but keep approvals on-request/untrusted for commands.
- No schema migrations unless explicitly authorized in the ticket.

## Definition of Done (DoD)
- Acceptance criteria met
- Build passes (best effort)
- Clear test steps
- Rollback plan (even if simple)
