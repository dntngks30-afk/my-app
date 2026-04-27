# PR-PILOT-TEMPLATE-SESSION-GATE-01

## Parent SSOT

[docs/pilot/PILOT_SMOKE_SSOT_2026_05_01.md](PILOT_SMOKE_SSOT_2026_05_01.md)

## Purpose

- Verify production Supabase `exercise_templates` against deterministic fixture-48 expectations (read-only).
- Run existing session composer / fixture smokes in a fixed order with a pilot-readable summary.
- **Detection only:** if a product blocker is found, report it; do not fix product behavior in this PR.

## Files changed (this PR)

- `scripts/pilot-template-parity-check.mjs`
- `scripts/pilot-session-smoke-bundle.mjs`
- `docs/pilot/PR-PILOT-TEMPLATE-SESSION-GATE-01.md`
- `package.json` (additive scripts only)

## Package scripts added

```json
"test:pilot-template-parity": "node scripts/pilot-template-parity-check.mjs",
"test:pilot-session": "node scripts/pilot-session-smoke-bundle.mjs"
```

## validate-session-template-fixture.mjs interface

- Supports a **custom fixture path** as `process.argv[2]` (see script header: `node scripts/validate-session-template-fixture.mjs <path-to-fixture.json>`).
- Does **not** export reusable validation logic; this PR builds a temp JSON from DB rows and invokes that script via subprocess. **`scripts/validate-session-template-fixture.mjs` is not modified.**

## Template parity behavior

- **Env missing** (`NEXT_PUBLIC_SUPABASE_URL` and/or `SUPABASE_SERVICE_ROLE_KEY`): prints only **key names** (never values), `STATUS: MANUAL_REQUIRED`, `PILOT_STATUS: MANUAL_REQUIRED`, exit **0**.
- **Env present** but `@supabase/supabase-js` import fails, query fails, non-array result, or `validate-session-template-fixture.mjs` fails on DB-derived JSON: `STATUS: FAIL`, `PILOT_STATUS: FAIL`, exit **1** (no silent downgrade to MANUAL_REQUIRED).
- **PASS**: structural/metadata rules satisfied by validator + row count/id coverage; **warnings** for `name` / `duration_sec` / `media_ref` drift vs golden [`scripts/fixtures/exercise-templates-session-plan-m01-m48.v1.json`](../../scripts/fixtures/exercise-templates-session-plan-m01-m48.v1.json).

Stable machine-readable lines (for PR-4 aggregation):

- `STATUS: PASS|FAIL|MANUAL_REQUIRED`
- `PILOT_STATUS: PASS|FAIL|MANUAL_REQUIRED`

`MANUAL_REQUIRED` is never printed as `PASS`.

## Session smoke bundle behavior

Runs in order:

1. `validate:session-template-fixture`
2. `test:first-session-anchor-fixture-48`
3. `test:session-2plus-continuity-fixture-48`
4. `test:full-rail-type-continuity-fixture-48`
5. `test:full-rail-adaptive-branch-fixture-48`
6. `test:adaptive-real-next-session`
7. `test:session-rationale-copy`
8. `test:session-rail-fixture-48`

- Any command **non-zero** exit → bundle **FAIL**.
- **SKIP** detection (narrow patterns to avoid false positives on phrases like “SKIP policy”): line exactly `SKIP`, or contains `[SKIP]`, or `STATUS: SKIP`, or word `SKIPPED`, or `status: skipped`. Unapproved SKIP → **FAIL** unless the **same** command output contains `PILOT_STATUS: MANUAL_REQUIRED` (session fixtures normally should not).
- Prints `SKIP_DETECTED: true|false` in the summary.
- Prints `STATUS` / `PILOT_STATUS` as `PASS` or `FAIL` only.

## Hard-fail rules (summary)

- Template: DB/query/import/validate failures; incomplete M01–M48; validator errors on DB-shaped JSON.
- Session: any bundled npm script fails or unapproved SKIP patterns appear.

## Warning rules (template)

- Non-blocking drift vs golden: `name`, `duration_sec`, `media_ref`.

## Manual-required behavior

- Only template parity when Supabase env is not available. Documented replacement steps are printed; pilot aggregate must treat this as **not** production-automated PASS.

## Non-goals

- No scoring / generator / camera / auth / payment / onboarding / session routing changes.
- No Supabase writes or migrations.
- No UI changes.
- No edits to `scripts/validate-session-template-fixture.mjs` or product session logic.

## Validation commands

```bash
npm run test:pilot-template-parity
npm run test:pilot-session
```

## Known limitations

- Production parity requires valid service-role env; without it, automation stops at MANUAL_REQUIRED.
- `test:session-rail-fixture-48` may write under `artifacts/session-rail-48`; those artifacts are not part of this PR unless already tracked intentionally.
- Session bundle uses `spawnSync(..., { shell: true })` so `npm run` works reliably on Windows (avoids null exit status from `npm.cmd` without a shell).
