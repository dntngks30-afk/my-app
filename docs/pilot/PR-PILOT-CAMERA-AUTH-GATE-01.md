# PR-PILOT-CAMERA-AUTH-GATE-01

## Parent SSOT

[docs/pilot/PILOT_SMOKE_SSOT_2026_05_01.md](PILOT_SMOKE_SSOT_2026_05_01.md)

## Purpose

- Run the **required** automated camera smoke scripts in a fixed order and summarize results for pilot readiness.
- Verify **OAuth callback error URL behavior** (Google/Kakao/invalid provider) via static inspection — not live login.
- Point operators to **real-device camera** and **production OAuth** manual checklists.

**Automated camera smoke does not replace real-device validation.** The final pilot status **cannot** be `READY` until the manual camera checklist in [PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md](PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md) is completed.

A **PASS** from `npm run test:pilot-camera` means only that the **automated** camera smoke bundle passed. It does **not** prove shallow squat, false-pass cases, overhead reach, voice behavior, and frame performance are acceptable on real iOS/Android devices.

## Files changed (this PR)

- `scripts/pilot-camera-smoke-bundle.mjs`
- `scripts/pilot-auth-url-smoke.mjs`
- `docs/pilot/PR-PILOT-CAMERA-AUTH-GATE-01.md`
- `docs/pilot/PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md`
- `docs/pilot/PILOT_AUTH_OAUTH_CHECKLIST.md`
- `package.json` (additive scripts only)

## Package scripts added

```json
"test:pilot-camera": "node scripts/pilot-camera-smoke-bundle.mjs",
"test:pilot-auth": "node scripts/pilot-auth-url-smoke.mjs"
```

## Camera smoke bundle behavior

**Required commands only** (npm scripts):

1. `test:camera-prf-proof-gate`
2. `test:camera-pr8-overhead-reach`
3. `test:camera-setup-screen`
4. `test:voice-waited-cue-completion`

**Optional V2 direct scripts** are not discovered by filename glob. Only paths explicitly listed in `OPTIONAL_V2_ALLOWLIST` inside `pilot-camera-smoke-bundle.mjs` are listed; **PR-3 default is `NOT_RUN`** (and `EXECUTE_OPTIONAL_V2` is `false`). Absence or `NOT_RUN` of optional scripts is **not** a failure.

Stable output lines:

- `STATUS: PASS|FAIL`
- `PILOT_STATUS: PASS|FAIL`
- `SKIP_DETECTED: true|false`
- `MANUAL_REQUIRED_COUNT: <number>`

Even when `STATUS` is `PASS`, the bundle prints `MANUAL_REQUIRED` including: real-device camera checklist must be completed before final pilot READY. This line does **not** fail automation; PR-4 can still classify overall readiness as `READY_WITH_MANUAL_CHECKS` until the checklist is done.

**SKIP policy:** same narrow patterns as other pilot bundles; unapproved SKIP fails unless the same output contains `PILOT_STATUS: MANUAL_REQUIRED`.

## Auth URL smoke behavior

- Reads [src/app/auth/callback/CallbackClient.tsx](../../src/app/auth/callback/CallbackClient.tsx) (no auth source edits in this PR).
- **FAIL** if files are missing/unreadable, if provider context for google/kakao is clearly broken, if `provider=invalid` would be preserved unsafely, or if URL oracle does not match contract.
- **MANUAL_REQUIRED** (exit 0) only if structure no longer matches expected patterns and behavior cannot be confidently determined — **not** used for clear breakage.
- **PASS** only when inspection + oracle match the contract.

Always prints `MANUAL_REQUIRED` live checks and `LIVE_PROVIDER_LOGIN_TESTED: false`. A PASS here does **not** mean Google/Kakao were exercised against production.

## Hard-fail rules (summary)

- **Camera:** any required npm script non-zero or unapproved SKIP in its output.
- **Auth:** missing/unreadable callback source, unsafe provider forwarding, oracle mismatch, or clear loss of provider context for google/kakao.

## Warning rules

- Reserved for non-blocking notes (auth inspection warnings, future camera warnings).

## Manual-required behavior

- **Camera automation:** always at least one manual-required line (real-device checklist). Count is reflected in `MANUAL_REQUIRED_COUNT`.
- **Auth:** live production login and in-app browser checks are always listed; `LIVE_PROVIDER_LOGIN_TESTED` stays `false` for this script.

## Checklist relationships

- Real device: [PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md](PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md)
- OAuth production: [PILOT_AUTH_OAUTH_CHECKLIST.md](PILOT_AUTH_OAUTH_CHECKLIST.md)

## Non-goals

- No camera pass logic, V2 thresholds, or owner semantics changes.
- No OAuth credentials or Supabase config in code.
- No payment/onboarding/session routing changes.
- No auth source edits unless a future narrow observability PR is explicitly required (not needed for current callback inspection).

## Validation commands

```bash
npm run test:pilot-camera
npm run test:pilot-auth
```

## Known limitations

- Optional V2 scripts are intentionally not run in PR-3 unless allowlist + execution flag are deliberately enabled after review.
- Camera smokes may write artifacts; do not commit unintended generated files.
- SKIP detection treats `^\s*SKIP:` harness lines as skips; the word `SKIPPED` is matched case-sensitively so prose like `promoted: skipped` does not false-positive (unlike a case-insensitive `SKIPPED` match).
