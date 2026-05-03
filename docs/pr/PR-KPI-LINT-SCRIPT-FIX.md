# PR-KPI-LINT-SCRIPT-FIX

## Summary

- Replaced unsupported `next lint` script with ESLint CLI (`eslint .`).
- Added reproducible ESLint dev dependencies for existing flat config.
- Expanded ESLint global ignores for generated/build artifacts and migrations.

## Scope

- package lint script
- ESLint dev dependencies / lockfile
- eslint.config.mjs ignores
- lint command smoke (`scripts/lint-command-smoke.mjs`)

## Non-goals

- Runtime code lint fixes
- TypeScript global error fixes
- Next/React version changes
- CI workflow changes

## Verification

- `npm run test:lint-command`
- `npm run lint`
- Existing KPI smoke scripts (see PR checklist)

## Acceptance notes

- `npm run lint` must no longer fail with `Invalid project directory ... \lint`; it should run ESLint and report rule violations if any remain.

## Lint baseline (post-fix)

- After switching to `eslint .`, the repo reports a **large existing backlog** (order of hundreds of problems across `src/` and `scripts/`). **This PR does not fix application code**; follow-up PR(s) should trim rules or fix files incrementally.
- **`public/worker-*.js`** is ignored alongside other PWA-generated assets under `public/`.
