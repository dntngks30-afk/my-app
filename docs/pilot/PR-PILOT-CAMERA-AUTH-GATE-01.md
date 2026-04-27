# PR-PILOT-CAMERA-AUTH-GATE-01

## Parent SSOT

[docs/pilot/PILOT_SMOKE_SSOT_2026_05_01.md](PILOT_SMOKE_SSOT_2026_05_01.md)

## Purpose

- Run the **V2-centered** automated pilot camera smoke bundle and summarize results.
- Verify **OAuth callback error URL behavior** (Google/Kakao/invalid provider) via static inspection — not live login.
- Point operators to **real-device camera** and **production OAuth** manual checklists.

**This documentation and gate realignment do not weaken camera readiness.** They replace a **legacy PR-F V1/V1.5 internal-contract full proof bundle** with a **fixed V2-centered pilot readiness bundle**. Product false-pass guards are not intentionally relaxed; the pilot gate is aligned to current V2 pass-owner direction.

---

## Three layers (do not conflate)

### 1) V2 pilot automated gate (`test:pilot-camera`)

**Required for `npm run test:pilot-camera` PASS** — fixed **7** commands, in order:

1. `npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs`
2. `npx tsx scripts/camera-squat-v2-04b-runtime-owner-safety-smoke.mjs`
3. `npm run test:camera-pr-x-squat-authority`
4. `npm run test:camera-pr7-squat-completion`
5. `npm run test:camera-pr8-overhead-reach`
6. `npm run test:camera-setup-screen`
7. `npm run test:voice-waited-cue-completion`

`test:pilot-camera` does **not** run `test:camera-prf-proof-gate` (not required, not optional, not warning).

Stable summary lines include: `STATUS`, `PILOT_STATUS`, `SKIP_DETECTED`, `MANUAL_REQUIRED_COUNT`, and **`LEGACY_PRF_PROOF_GATE_RUN: false`**.

### 2) Legacy PR-F diagnostic (separate manual / engineer use)

- **Command:** `npm run test:camera-prf-proof-gate` (still defined in `package.json`; **not deleted, not renamed**).
- **Runner:** `scripts/camera-pr-f-regression-proof-gate.mjs` executes a fixed **22-script** `REQUIRED_PROOF_BUNDLE`.
- **Nature:** historical regression / **V1/V1.5 internal shallow** contracts (closure writer, peak latch, epoch, provenance, etc.).
- **Not** V2 pilot readiness truth; **not** invoked by `test:pilot-camera`.
- **Use:** engineer diagnostic / legacy regression reference only.

### 3) Real-device validation (manual)

- **iOS/Android** shallow squat, false-pass cases, overhead reach, voice, frame performance — see [PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md](PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md).
- **Still required** before final pilot `READY`.

---

## What `test:pilot-camera` PASS does **not** mean

`test:pilot-camera` PASS does **not** mean:

- legacy PR-F proof gate passed
- real-device camera validation passed
- shallow squat is proven on iOS/Android
- overhead reach is proven on iOS/Android
- frame performance is proven on real devices

**Automated camera smoke does not replace real-device validation.** The final pilot status **cannot** be `READY` until the manual camera checklist in [PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md](PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md) is completed.

## Files touched by the camera/auth pilot PR chain

- `scripts/pilot-camera-smoke-bundle.mjs` — V2-centered pilot bundle (PR V2 realign updates this).
- `scripts/pilot-auth-url-smoke.mjs`
- `docs/pilot/PR-PILOT-CAMERA-AUTH-GATE-01.md` (this file)
- `docs/pilot/PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md`
- `docs/pilot/PILOT_AUTH_OAUTH_CHECKLIST.md`
- `package.json` — `test:pilot-camera`, `test:pilot-auth` only (PR-F script unchanged)

## Package scripts (pilot)

```json
"test:pilot-camera": "node scripts/pilot-camera-smoke-bundle.mjs",
"test:pilot-auth": "node scripts/pilot-auth-url-smoke.mjs"
```

## Camera smoke bundle behavior

- **Preflight:** required direct script files must exist; required `npm` script names must exist in `package.json`. Missing → **FAIL**, exit 1 (no fallback to PR-F).
- **Direct V2 steps:** `spawnSync('npx', ['tsx', 'scripts/…'], { cwd: repo root, shell: true, … })` — not `node` directly (TS/tsx resolution).
- **SKIP:** narrow patterns; unapproved SKIP fails unless output contains `PILOT_STATUS: MANUAL_REQUIRED`.
- **MANUAL_REQUIRED:** always includes real-device checklist line; `MANUAL_REQUIRED_COUNT` is at least 1; does not fail automation when steps pass.
- **Legacy PR-F:** `LEGACY_PRF_PROOF_GATE_RUN` is always **false** for this bundle; a note points engineers to `npm run test:camera-prf-proof-gate` **only** as a separate legacy diagnostic.

## Auth URL smoke behavior

- Reads [src/app/auth/callback/CallbackClient.tsx](../../src/app/auth/callback/CallbackClient.tsx) (no auth source edits in pilot gate PRs).
- **FAIL** if files are missing/unreadable, if provider context for google/kakao is clearly broken, if `provider=invalid` would be preserved unsafely, or if URL oracle does not match contract.
- **MANUAL_REQUIRED** (exit 0) only if structure no longer matches expected patterns and behavior cannot be confidently determined — **not** used for clear breakage.
- **PASS** only when inspection + oracle match the contract.

Always prints `MANUAL_REQUIRED` live checks and `LIVE_PROVIDER_LOGIN_TESTED: false`. A PASS here does **not** mean Google/Kakao were exercised against production.

## Hard-fail rules (summary)

- **Camera:** any required step non-zero exit, unapproved SKIP, preflight missing file/script, runner exception.
- **Auth:** missing/unreadable callback source, unsafe provider forwarding, oracle mismatch, or clear loss of provider context for google/kakao.

## Manual-required behavior

- **Camera:** always at least one `MANUAL_REQUIRED` line (real-device checklist); reflected in `MANUAL_REQUIRED_COUNT`.
- **Auth:** live production login and in-app browser checks are always listed; `LIVE_PROVIDER_LOGIN_TESTED` stays `false` for this script.

## Checklist relationships

- Real device: [PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md](PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md)
- OAuth production: [PILOT_AUTH_OAUTH_CHECKLIST.md](PILOT_AUTH_OAUTH_CHECKLIST.md)

## Non-goals

- No camera pass logic, V2 thresholds, or owner semantics changes in pilot gate PRs.
- No OAuth credentials or Supabase config in code.
- No payment/onboarding/session routing changes.

## Validation commands

```bash
npm run test:pilot-camera
npm run test:pilot-auth
```

Do **not** require `npm run test:camera-prf-proof-gate` for pilot gate validation; run it only optionally as a **legacy** diagnostic.

## Known limitations

- Camera smokes may write artifacts; do not commit unintended generated files.
- SKIP detection treats `^\s*SKIP:` harness lines as skips; `SKIPPED` is matched case-sensitively to reduce false positives on prose like `promoted: skipped`.
