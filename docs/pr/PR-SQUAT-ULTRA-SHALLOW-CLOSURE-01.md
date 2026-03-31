# PR-SQUAT-ULTRA-SHALLOW-CLOSURE-01

## Single goal

Fix the live class where `relativeDepthPeak ≈ 0.06`, `officialShallowPathCandidate` and `officialShallowPathAdmitted` are already true, but completion stays on `officialShallowPathBlockedReason === "no_reversal"` with `officialShallowReversalSatisfied === false`. This PR does not re-scope shallow completion, low_rom at ~0.34, or owner/taxonomy.

## Live mapping

| Signal | Live ultra-low fail class |
|--------|---------------------------|
| `relativeDepthPeak` | ~0.06 |
| `officialShallowPathCandidate` | true |
| `officialShallowPathAdmitted` | true |
| `officialShallowPathClosed` | false |
| `officialShallowPathBlockedReason` | `no_reversal` |
| `officialShallowReversalSatisfied` | false |
| `officialShallowClosureProofSatisfied` | false |

Authoritative attempt-truth uses `attemptStarted && baselineFrozen` (same contract as `completionBlockedReasonAuthoritative` in trace). Pre-attempt hints must not drive logic changes.

## Root cause (locked)

Admission is not the bottleneck. In `[LEGACY_ATTEMPT_FLOOR, ULTRA_SHALLOW_STRICT_ONLY_FLOOR)`, `guardedUltraShallowReversalAssist` required `postPeakMonotonicReversalAssist` **and** `ascentStreakMax >= MIN_REVERSAL_FRAMES`. Real ultra-shallow clips often show monotonic post-peak return on the reversal stream without two consecutive `phaseHint === 'ascent'` frames, so guarded never opened and strict two-frame hits could also be avoided by zig-zag depth noise.

## Change

**File:** `src/lib/camera/squat/squat-reversal-confirmation.ts`  
**Block:** `guardedUltraShallowReversalAssist` only (`[0.02, 0.08)`).

After existing `mono.ok` and `postPeakFrameCount >= MIN_DESCENT_FRAMES`, reversal may confirm if either:

- `ascentStreakMax >= MIN_REVERSAL_FRAMES` (unchanged), or  
- **Monotonic stream integrity:** `mono.frames >= 4`, `ev.dropReversal >= req * 0.88`, `ev.postPeakFrameCount >= 4`.

Notes distinguish `guarded_ultra_shallow_reversal_assist` vs `guarded_ultra_shallow_reversal_assist_monotonic_stream_integrity`.

**Not changed:** `[0.08, 0.12)` shallow relax lane, HMM bridge, `postPeakMonotonicReversalAssist` thresholds, completion-state admission / pass reason / drift / event promotion, forbidden files list from the PR brief.

## Regression smoke

- `scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs`  
  - **A_truncated:** canonical pre-fix `no_reversal` buffer; post-fix expects reversal satisfied and blocked reason **not** `no_reversal` on incomplete buffer.  
  - **A_extended:** same prefix + standing tail → `ultra_low_rom_cycle`, closed, closure proof, no event promotion.  
  - **Fixture B:** deeper `low_rom_cycle` (not the primary fix target).

## Required existing smokes

- `npx tsx scripts/camera-cam-owner-freeze-01-smoke.mjs` — pass  
- `npx tsx scripts/camera-assist-owner-isolation-smoke.mjs` — **block 6 shallow-fail** currently fails on `main` (tiny standing-only sequence no longer yields `not_armed` / `attemptStarted === false`); unchanged by this PR’s diff. Re-run after squat/auto-progress contract refresh.

## Acceptance

- **Accept A:** Ultra-low authoritative fixture opens reversal without `no_reversal`; extended buffer completes `ultra_low_rom_cycle` without `eventCyclePromoted`; owner freeze smoke passes; deeper low_rom fixture unchanged.  
- **Accept B:** N/A — bug reproduced in smoke and addressed in guarded lane.
