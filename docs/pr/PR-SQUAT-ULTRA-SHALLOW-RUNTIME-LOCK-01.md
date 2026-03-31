# PR-SQUAT-ULTRA-SHALLOW-RUNTIME-LOCK-01

## Single goal

**Lock** the current **runtime / smoke / observability** baseline after ultra-low guarded reversal unlock (already on `main`), without widening thresholds, reversal lanes, finalize, owner taxonomy, event promotion, admission, or drift. **No production camera core changes** in this PR.

## Facts already on `main` (baseline)

- `eeccda5` — `guardedUltraShallowReversalAssist` allows monotonic stream integrity **or** ascent phase; live regression smoke added (`camera-squat-ultra-shallow-live-regression-01-smoke.mjs`).
- Synthetic / contract smokes for ultra-low, shallow admission, low-ROM finalize, completion slice, and owner freeze **pass** on that baseline.

## Primary conclusion (locked)

There is **no evidence** that the next gap is in **core** ultra-low reversal logic:

1. **Code / contract path:** Authoritative fixtures and canonical runtime smokes show the ultra-low path working as intended.
2. **Real device:** Recent trace export often has **no `attempts` / no `successSnapshots`**; shallow-depth rows can be **pre-attempt hints only** (`baselineFrozen === false`, `completionBlockedReasonAuthoritative === false`). That is **not** terminal failure proof of a core bug.

**Therefore:** This PR does **not** widen guarded reversal, closure, finalize, or related core behavior. **Runtime authoritative device success** (pass/fail aligned with product intent on hardware) remains **to be proven separately** once export carries authoritative terminal snapshots.

## Changes in this PR

| Area | Change |
|------|--------|
| `scripts/camera-assist-owner-isolation-smoke.mjs` | **Block 6 only:** Replace stale expectations (`squatCompletionState`-only `not_armed` / `completionFinalizeMode === 'blocked'`) with **invariant** checks: gate does not pass, completion not satisfied, no finalized cycle `completionPassReason`, `completionTruthPassed` not true, lineage / `finalSuccessOwner` not standard·event truth, `eventCyclePromoted` not true. Aligns with main where short standing-only buffers may omit `squatCompletionState` while `squatCycleDebug` still reports guardrail-driven `insufficient_signal`. |
| `docs/pr/PR-SQUAT-ULTRA-SHALLOW-RUNTIME-LOCK-01.md` | This document. |

**Not changed:** Any file under `src/lib/camera/...` (explicitly forbidden list respected).

## Canonical runtime smoke suite (recorded)

Run from repo root (`HEAD` = `eeccda51493de9c2b15485e93e0823e424225481` at lock time):

| Script | Result |
|--------|--------|
| `npx tsx scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs` | 19 / 19 passed |
| `npx tsx scripts/camera-cam24-guarded-ultralow-pass-smoke.mjs` | 11 / 11 passed |
| `npx tsx scripts/camera-cam26-shallow-admission-and-standing-hardening-smoke.mjs` | 10 / 10 passed |
| `npx tsx scripts/camera-cam27-lowrom-standing-recovery-finalize-smoke.mjs` | 16 / 16 passed |
| `npx tsx scripts/camera-cam28-shallow-completion-slice-smoke.mjs` | 8 / 8 passed |
| `npx tsx scripts/camera-cam-owner-freeze-01-smoke.mjs` | 23 / 23 passed |
| `npx tsx scripts/camera-assist-owner-isolation-smoke.mjs` | 29 / 29 passed (block 6 updated) |

## Acceptance

- No edits under forbidden `src/lib/camera/...` paths.
- Canonical ultra-low runtime smokes pass; owner freeze passes; assist-owner-isolation passes after block 6 expectation alignment.
- Doc states: core unlock already shipped; **device-level authoritative success/failure proof is still outstanding**; next decision for another core PR waits on better real-device export (or other evidence), not on widening logic without proof.

## Non-goals

- Widening ultra-low / shallow / reversal / finalize thresholds.
- Changing HMM assist, event promotion, admission, drift, or owner taxonomy.
- Adding or changing production camera logic in this PR.
- Proving on-device UX success (separate track: capture, trace export, dogfooding).
