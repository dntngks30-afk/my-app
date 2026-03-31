# PR-SQUAT-ULTRA-SHALLOW-RUNTIME-FIX-02

## Single goal

Use the **already captured real-device authoritative ultra-low failure** as **canonical truth** and ensure that class—`relativeDepthPeak ≈ 0.06`, admission and baseline frozen, shallow path admitted—**no longer stays stuck** on `officialShallowPathBlockedReason === "no_reversal"` with `officialShallowReversalSatisfied === false` after the guarded reversal lane fix.

## Canonical authoritative fail shape (documented)

Encoded as fixture **`A_runtime_authoritative_fail`** in `scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs`. **Before** the slow-recovery guarded branch (see ALIGN-02 / implementation in `guardedUltraShallowReversalAssist`), equivalent buffers showed:

| Field | Value |
|--------|--------|
| `relativeDepthPeak` | ≈ 0.06 (assert band `[0.045, 0.09]`) |
| `attemptStarted` | `true` |
| `baselineFrozen` | `true` |
| `completionBlockedReasonAuthoritative` | `true` (same contract as trace: attempt + baseline frozen) |
| `officialShallowPathCandidate` | `true` |
| `officialShallowPathAdmitted` | `true` |
| `officialShallowPathClosed` | `false` |
| `officialShallowPathBlockedReason` | `"no_reversal"` |
| `officialShallowReversalSatisfied` | `false` |
| `officialShallowClosureProofSatisfied` | `false` |
| `eventCyclePromoted` | `false` |

## Merge acceptance (no new device success export required)

- **Required:** The same canonical fixture, **after the fix**, must pass **post-fix** assertions: reversal satisfied, blocked reason **not** `no_reversal`, no event promotion, incomplete buffer may keep closure proof false.
- **Not required:** A new real-device **success** export for merge. Export gaps are acknowledged as part of the operational bottleneck; regression is locked by **synthetic canonical fail → fixed** transition.

## Relation to prior work

- **`eeccda5` / CLOSURE-01:** guarded ultra-low without requiring ascent streak (monotonic stream integrity path).
- **ALIGN-02 (`7d7decd`):** **Slow post-peak recovery** (`~0.001`/frame) still failed primary monotonic (`6f`, `ε=0.002`); added **slow-recovery monotonic** (`12f`, `ε=0.001`) with `slowRecoveryMonotonicOk` gates inside `[0.02, 0.08)` only.

**FIX-02** names the **release gate** fixture (`A_runtime_authoritative_fail`) and documents acceptance as above. Core logic lives in `squat-reversal-confirmation.ts`; `squat-completion-state.ts` unchanged (reversal opens via `detectSquatReversalConfirmation`).

## Contracts unchanged

Owner taxonomy, `completionPassReason` set, event promotion, finalize holds, admission formulas, drift, `[0.08, 0.12)` shallow relax, HMM bridge, auto-progression — **not** modified for this PR.

## Strong preference

`A_runtime_authoritative_fail_ext`: same prefix + standing tail → `ultra_low_rom_cycle`, closed, closure proof, **not** via unrelated `low_rom` / standard widening or event promotion.

## Non-goals

- Requiring new on-device success JSON for merge.
- Single-frame spike reversal; removing meaningful post-peak return; HMM/event promotion as primary escape.
