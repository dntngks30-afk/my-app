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

## Cursor Cloud specific instructions

### Overview
PostureLab / Move Re — a Next.js 16 (App Router) posture analysis & corrective exercise platform. Single app (not monorepo). Uses Supabase for auth/DB/storage, OpenAI for AI features, Stripe/Toss for payments.

### Running the dev server
```bash
npm run dev          # starts at http://localhost:3000
npm run build        # production build
```

### Linting
`npm run lint` is configured as `next lint`, but **Next.js 16 dropped the built-in `next lint` command** and ESLint/eslint-config-next are not in `package.json` dependencies. Lint is currently non-functional — this is a pre-existing repo issue, not an environment problem.

### Environment variables
A `.env.local` file is required. At minimum, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set (even to placeholders) or the app will crash at module load time due to a guard in `src/lib/supabase.ts`. For full functionality, real Supabase project credentials plus OpenAI/Stripe/Resend/Toss/VAPID/Kakao keys are needed.

### Key gotchas
- **Node.js ≥ 18** required (22.x works fine).
- **Package manager:** npm (`package-lock.json`).
- `next.config.ts` has `typescript: { ignoreBuildErrors: true }`, so `npm run build` always succeeds even with TS errors.
- The Supabase client (`src/lib/supabase.ts`) is eagerly initialized at import time — missing env vars cause immediate crashes, not lazy errors.
- No automated test suite exists (`package.json` has no `test` script).
