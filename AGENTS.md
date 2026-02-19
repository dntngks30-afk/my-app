# AGENTS.md — PostureLab / my-app (Agent Operating Manual)

## Goal
You are a coding agent working in this repository. Optimize for: correctness, minimal diffs, security (Supabase/RLS), and reproducible steps.

## Hard rules (must follow)
- Never use: `--yolo` / `--dangerously-bypass-approvals-and-sandbox`.
- Prefer minimal, reviewable changes. Do not refactor unrelated code.
- Do not modify secrets, .env files, or production credentials. If needed, ask to use placeholder names.
- Do not change database schema or RLS policies without an explicit ticket section "DB/RLS Changes" and a rollback plan.
- Do not run destructive commands (rm -rf, format, registry changes).
- For Windows: provide PowerShell commands (not bash), unless explicitly asked.

## Repo workflow
- Work from a feature branch. If on main, warn and suggest creating a branch.
- After changes: run the best-effort checks:
  - `npm run lint` (if available)
  - `npm run build`
  - any test command found in package.json (or propose a smoke checklist)

## Output format
- Always summarize: What changed / Why / Files touched / How to test / Risks & rollback.
