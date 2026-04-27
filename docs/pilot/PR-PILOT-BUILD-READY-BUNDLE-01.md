# PR-PILOT-BUILD-READY-BUNDLE-01

## Parent SSOT

[docs/pilot/PILOT_SMOKE_SSOT_2026_05_01.md](PILOT_SMOKE_SSOT_2026_05_01.md)

## Purpose

- Add **`npm run test:pilot-build`**: production build + TypeScript check with pilot-safe classification.
- Add **`npm run test:pilot-ready`**: run all pilot gates in fixed order and emit **exactly one** `FINAL STATUS: READY | READY_WITH_MANUAL_CHECKS | BLOCKED`.
- This PR does **not** change product behavior — scripts, pilot docs, and additive `package.json` keys only.

## Files (this PR)

- `scripts/pilot-build-gate.mjs`
- `scripts/pilot-ready-smoke-bundle.mjs`
- `docs/pilot/PR-PILOT-BUILD-READY-BUNDLE-01.md` (this file)
- `docs/pilot/PILOT_DEPLOY_ENV_CHECKLIST.md`
- `docs/pilot/PILOT_RELEASE_CHECKLIST_2026_05_01.md`
- `package.json` — additive: `test:pilot-build`, `test:pilot-ready` only

## Package scripts added

```json
"test:pilot-build": "node scripts/pilot-build-gate.mjs",
"test:pilot-ready": "node scripts/pilot-ready-smoke-bundle.mjs"
```

## Build gate (`test:pilot-build`)

- Runs `npm run build` then `npx tsc --noEmit --pretty false` (large `maxBuffer`, no secret values logged).
- **`npm run build` non-zero → always `STATUS: FAIL` / `PILOT_STATUS: FAIL`, exit 1** (never downgraded).
- **tsc non-zero:** if output mentions pilot-critical paths (`scripts/pilot-`, `src/app/auth/`, `src/app/app/auth/`, `src/app/movement-test/`, `src/lib/camera/`, `src/lib/session/`, `src/app/api/session/create/`, `src/app/api/session/complete/`, `middleware.ts`, `next.config.ts`) → **FAIL**, exit 1. Otherwise **`PASS_WITH_WARNINGS`**, exit 0.
- Stable lines printed **once** at end: `STATUS`, `PILOT_STATUS` (`PASS` | `PASS_WITH_WARNINGS` | `FAIL`).

## Final ready bundle (`test:pilot-ready`)

**Order (fixed):**

1. `npm run test:pilot-build`
2. `npm run test:pilot-session`
3. `npm run test:pilot-template-parity`
4. `npm run test:pilot-camera`
5. `npm run test:pilot-auth`

- Runs **all** children even if one fails (full domain summary).
- Parses **last** stable `STATUS:` / `PILOT_STATUS:` lines per child.
- **SKIP:** narrow line rules; unapproved SKIP → **BLOCKED** unless same output contains `PILOT_STATUS: MANUAL_REQUIRED`.
- **Exit:** `READY` / `READY_WITH_MANUAL_CHECKS` → **0**; `BLOCKED` → **1**.
- **Single** `FINAL STATUS:` line at end.

### Final status rules

- **BLOCKED** if any child exit ≠ 0, or `PILOT_STATUS: FAIL`, or unapproved SKIP.
- **READY_WITH_MANUAL_CHECKS** if no hard fail and any manual signal remains (e.g. `PILOT_STATUS: MANUAL_REQUIRED`, `MANUAL_REQUIRED_COUNT > 0`, `LIVE_PROVIDER_LOGIN_TESTED: false`, real `MANUAL_REQUIRED` bullets not `(none)` only, or build `PASS_WITH_WARNINGS`).
- **READY** only if no hard fail and no remaining manual signals.

**Expected local outcome today:** `READY_WITH_MANUAL_CHECKS` (template often `MANUAL_REQUIRED` without Supabase env; camera `MANUAL_REQUIRED_COUNT: 1`; auth `LIVE_PROVIDER_LOGIN_TESTED: false`). If the aggregator shows `READY` while those remain, treat it as an aggregator bug.

**Template `PILOT_STATUS: MANUAL_REQUIRED` with exit 0 is not BLOCKED.**

## TSC policy (summary)

- Aligns with parent SSOT: tsc pass is best case; non-pilot-critical tsc failures may be `PASS_WITH_WARNINGS`; pilot-critical tsc errors → FAIL.
- Does not change `tsconfig`, `next.config.ts`, or `ignoreBuildErrors`.

## Non-goals

- No product fixes, dependency upgrades, or lockfile changes.
- No weakening of SKIP policy or build semantics.

## Validation commands

```bash
npm run test:pilot-build
npm run test:pilot-ready
```

Do not require `npm run test:camera-prf-proof-gate` here; it remains a **separate legacy diagnostic** (see [PR-PILOT-CAMERA-AUTH-GATE-01.md](PR-PILOT-CAMERA-AUTH-GATE-01.md)).

## Expected local result

- `test:pilot-ready` → **`FINAL STATUS: READY_WITH_MANUAL_CHECKS`** in typical dev (unless build/tsc/session/camera/auth hard-fail).

## Known limitations

- `npm run build` may create `.next/` and caches — do not commit unless intentional.
- Child stdout can be large; aggregator uses a large `maxBuffer`.
