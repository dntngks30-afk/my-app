# PR-CAM-SQUAT-WAVE-B-OPENER-UNIFICATION

## Parent SSOT

- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-RESIDUAL-TRUTH-MAP.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-EXECUTION-WAVE-PLAN.md`
- `docs/pr/PR-CAM-SQUAT-WAVE-A-CLOSURE-AUTHORITY-ESTABLISHMENT.md`
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`
- `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/PASS_AUTHORITY_RESET_SSOT_20260404.md`
- `docs/pr/PR-RF-02-SQUAT-UI-GATE-ISOLATION.md`

Local note: the first two parent files are present in this checkout but empty. The active Wave B scope is therefore also anchored to the PR-9 user wave lock: opener unification only, no closure rewrite.

## Scope

Wave B connects the already-closed official shallow owner path to the opener/sink chain:

- `completionOwnerPassed`
- exported `pass_core_truth.squatPassCore.passDetected`
- `uiProgressionAllowed`
- `finalPassEligible`
- `finalPassLatched`

The change is intentionally limited to same-epoch shallow reps where the frozen official shallow owner is already true. It does not create a new closure path.

## Exact Bug

After Wave A, the intended runtime shape is:

1. `officialShallowPathClosed=true`
2. `officialShallowOwnerFrozen=true`
3. completion owner passes
4. pass-core truth, UI gate, and final sink consume the same opener truth

The residual bug was a split opener surface: completion owner could honor the frozen shallow owner, while pass-core-adjacent progression/observability still reported raw pass-core false. That allowed downstream traces to keep looking like `completion_owner_not_satisfied` / no final latch even after the official shallow owner had won.

## What Changed

- `src/lib/camera/auto-progression.ts`
  - `readSquatCurrentRepPassTruth` now treats `officialShallowOwnerFrozen=true` as the effective same-rep pass trace when pass-core exists.
  - `getSquatProgressionCompletionSatisfied` no longer blocks a frozen official shallow owner solely because raw `squatPassCore.passDetected` is false.
  - This keeps completion-state and pass-core-adjacent progression aligned for the same epoch.

- `src/lib/camera/camera-observability-squat-session.ts`
  - `livePassCoreTruth.squatPassCore.passDetected` now exposes the effective opener truth when `officialShallowOwnerFrozen=true`.
  - `rawPassDetected` remains visible so raw pass-core math is not hidden.
  - `openerUnifiedByOfficialShallowOwner` marks this Wave B handoff explicitly.

## Explicitly Not Changed

- No edits to `src/lib/camera/squat/squat-completion-core.ts`.
- No closure-family changes.
- No Wave A Family C edits.
- No admission timing, arming, anchor provenance, or quality reclassification changes.
- No threshold lowering.
- No standing/seated/setup/cross-epoch/false-pass guard relaxation.
- No deep standard path semantic change.
- No UI gate opener behavior. `squat-ui-progression-latch-gate.ts` remains a downstream block-only consumer.
- No conditional 11-13 promotion.
- No sink-only invariant assert / Wave C stabilization.

## Why This Is Wave B Only

Wave A decides whether the official shallow path is closed. Wave B only consumes that already-decided truth and makes the opener surface coherent. The implementation is gated by `officialShallowOwnerFrozen`, which itself depends on the existing closure proof and false-pass guard. Therefore the runtime patch cannot turn an unclosed or guard-blocked rep into a pass.

## Bookkeeping Step

The requested bookkeeping flip was not applied in this working copy.

Reason: `scripts/camera-pr-cam-squat-regression-harness-lock-06-smoke.mjs` currently accepts `promoted | pending_upstream`, while the prompt requested `permanent_must_pass`. More importantly, the local Desktop primary 10 fixtures still contain no `officialShallowPathClosed=true` and no final latch. The harness therefore reports primary shallow 10 as `pending_upstream` with `no_shallow_final_pass_latched`.

Flipping the roster now would be a false bookkeeping promotion and would make the harness fail. The runtime change and bookkeeping step remain separated. The roster should be flipped only after recaptured Wave A+B traces show the full shallow-owner truth.

## Smoke Result

Green:

- `camera-pr-cam-squat-official-shallow-owner-freeze-01-smoke.mjs`: 10/10
- `camera-pr-cam-squat-false-pass-guard-lock-02-smoke.mjs`: 33/33
- `camera-pr-cam-squat-official-shallow-admission-promotion-03-smoke.mjs`: 28/28
- `camera-pr-cam-squat-official-shallow-closure-rewrite-04-smoke.mjs`: 42/42
- `camera-pr-cam-squat-quality-semantics-split-05-smoke.mjs`: 34/34
- `camera-pr-shallow-acquisition-peak-provenance-unify-01-smoke.mjs`: 41/41
- `camera-pr-cam-squat-shallow-temporal-epoch-order-realign-smoke.mjs`: 27/27
- `camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`: 28/28
- `camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs`: 18/18
- `camera-pr-cam-squat-regression-harness-lock-06-smoke.mjs`: 69 passed, 0 failed, with primary shallow still `pending_upstream` and 13 loud notices.

Checked but red outside Wave B diff:

- `camera-pr7-official-shallow-closer-integrity-smoke.mjs`: 39/49, failures are in `shallow-completion-contract.ts` expectations.
- `camera-pr8-official-shallow-timing-epoch-smoke.mjs`: 45/54, failures are in `shallow-completion-contract.ts` expectations.
- `camera-pr12-official-shallow-gold-path-convergence-smoke.mjs`: 25/35, failures are in `shallow-completion-contract.ts` expectations.

Typecheck:

- Full `npx tsc --noEmit --pretty false` remains red on many existing repo-wide errors.
- Filtered check for the two touched files has no remaining output after the Wave B nullability fix.

## Known Remaining Gap

Wave C stabilization is not included. Sink-only invariant assertions, promoted fixture status hardening, conditional 11-13 decisions, and recaptured real-device fixture promotion remain out of this Wave B patch.
