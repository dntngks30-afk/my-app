# PR-SQUAT-ULTRA-SHALLOW-RUNTIME-ALIGN-02

**Implementation:** `main` @ `7d7decd` (`guardedUltraShallowReversalAssist` slow-recovery monotonic + live smoke). 스모크 주석에 **pre-fix 권위 실패 조건** 전체를 적어 두고, CI는 **post-fix** assert만 실행한다.

## Single goal

Close the **runtime authoritative ultra-low** gap where admission already holds (`officialShallowPathCandidate` / `officialShallowPathAdmitted`, `attemptStarted`, `baselineFrozen`, `relativeDepthPeak ≈ 0.06`) but reversal truth stays on **`officialShallowPathBlockedReason === "no_reversal"`** with `officialShallowReversalSatisfied === false`.

**Scope:** only `[LEGACY_ATTEMPT_FLOOR, ULTRA_SHALLOW_STRICT_ONLY_FLOOR)` = `[0.02, 0.08)` guarded reversal lane. Not shallow-wide redesign, not `low_rom` at ~0.31/0.34, not admission/drift/owner/event/finalize contract changes.

## Context (already on `main`)

- `eeccda5` (`PR-SQUAT-ULTRA-SHALLOW-CLOSURE-01`): `guardedUltraShallowReversalAssist` may confirm via **ascent phase** OR **monotonic stream integrity** (6f window, ε=0.002 steps, cumulative drop + post-peak length).
- Synthetic `A_trunc` / CAM-24-style fixtures pass; **real device** can still show authoritative `no_reversal` — bottleneck is **post-admission reversal acquisition**, not pre-attempt ambiguity.

## Root cause (this PR)

Real clips often show **slow post-peak return**: reversal depth falls ~**0.001 per frame**, so the **default** `postPeakMonotonicReversalAssist` (consecutive down steps vs **0.002**) records **no** qualifying steps in the short window, while **cumulative** `dropReversal` and post-peak length still meet the guarded bar. That pattern is outside CLOSURE-01’s zig-zag / stream-integrity class but still physically plausible ultra-low recovery.

## Change

### `src/lib/camera/squat/squat-reversal-confirmation.ts`

1. **`postPeakMonotonicReversalAssist`**  
   - Optional `stepDownEpsilon` (default **0.002**, behavior unchanged for existing callers).

2. **`guardedUltraShallowReversalAssist`** (only inside `[0.02, 0.08)`)
   - **Primary:** existing short window, `stepDownEpsilon: 0.002`.
   - If primary fails: **slow-recovery** pass — window **12**, `minFrames` **5**, `stepDownEpsilon` **0.001**.
   - Opens reversal only if **`slowRecoveryMonotonicOk`**: `!primaryMono.ok && slowMono.ok && slowMono.frames >= 6 && ev.dropReversal >= req * 0.88 && ev.postPeakFrameCount >= 6` (or existing ascent / primary stream-integrity branches).
   - Note: `guarded_ultra_shallow_reversal_assist_slow_recovery_monotonic`.

**Not changed:** `[0.08, 0.12)` shallow relax, moderate/deep lanes, HMM bridge thresholds, completion-state admission/closure/drift APIs, finalize hold constants, pose-features, auto-progression.

### `scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs`

- **`buildFixtureARuntimeAuthoritativeFail`** (PR-FIX-02 릴리스 게이트 이름; 과거 `A_runtime_real_device`): slow `-0.001`/frame post-peak; pre-fix shape in comments; post-fix asserts reversal opens, not `no_reversal`, incomplete buffer OK, no event promotion.
- **`buildFixtureARuntimeAuthoritativeFailExtended`:** same + standing tail → **`ultra_low_rom_cycle`** (선호).

Existing **A_trunc / A_ext / B** retained.

### `src/lib/camera/squat-completion-state.ts`

- **No edit** — reversal opens from `detectSquatReversalConfirmation` without extra wiring.

## Acceptance

- New runtime fixture reproduces the **slow post-peak** class; post-fix: `officialShallowReversalSatisfied === true`, `officialShallowPathBlockedReason !== "no_reversal"`, `eventCyclePromoted !== true`.
- Extended fixture: `ultra_low_rom_cycle`, not `low_rom_cycle` via unrelated widening.
- All listed smokes pass (see PR checklist in repo).

## Non-goals

- Owner / `completionPassReason` taxonomy / event promotion / admission / drift.
- Standing finalize timing constant changes.
- Single-frame spike reversal; removing meaningful post-peak return; HMM as primary rescue for this gap.
