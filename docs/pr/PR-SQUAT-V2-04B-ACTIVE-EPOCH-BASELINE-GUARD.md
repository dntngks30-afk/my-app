# PR-SQUAT-V2-04B — Active Epoch Baseline Guard and False-Pass Closure

**Status:** CURRENT_IMPLEMENTED  
**Scope:** `squat-motion-evidence-v2.ts`, `evaluators/squat.ts`, `squat-motion-evidence-v2.types.ts`  
**Predecessor:** PR-SQUAT-V2-04 — Active Attempt Epoch Window  

---

## Problem

After PR-SQUAT-V2-04 (active epoch window), real-device testing revealed a regression:
- **First shallow squat** passed correctly.
- **Subsequent ticks** (user standing still or performing tiny movements) **incorrectly passed** as squats.

### Root Cause Analysis

The false-positives are **V2 active epoch false-positives**, not browser/PWA cache replay.
Each failing JSON showed distinct `inputWindowDurationMs`, `activeAttemptEpochStartMs`, and
`latestFrameTimestampMs` — confirming V2 computed a **new decision each tick**.

The epoch source label bug compounded the problem:
- `v2EpochSource = active_attempt_epoch_with_pre_descent_baseline` even when `preDescentBaselineFrameCount = 0`.
- `computeActiveAttemptEpoch` used a time-based `epochStartMs < descentStartMs` heuristic, but
  `findMotionWindow` (V2 internal) set `startIndex = 0` regardless — because `futurePeak - priorMin >= 0.035`
  was satisfied at the very first frame when any baseline frames were included.

### False-Positive Signatures (Real-Device JSONs)

| Metric | JSON-2 | JSON-3 |
|--------|--------|--------|
| `preDescentBaselineFrameCount` | 0 | 0 |
| `descentStartFrameIndex` | 0 | 0 |
| `reversalFrameIndex` | – | === `nearStartReturnFrameIndex` |
| `peakDistanceFromTailMs` | – | ≈ 184ms |
| `descentMs / inputWindowDurationMs` | high | ≈ 0.96 |
| `usableMotionEvidence` before fix | true ❌ | true ❌ |

JSON-3 was the clearest case: 4.3s descent + 92ms (1 frame) ascent. V2 passed it because:
1. `returnMs = 4380ms < MAX_SQUAT_CYCLE_MS = 4500ms` ✓
2. `tailDistanceMs ≈ 91ms < 400ms` ✓
3. Reversal and return detected in the **same frame** (ascentMs = 92ms ≈ 1 frame at 10fps)

---

## Changes

### 1. `squat-motion-evidence-v2.ts` — Three New Guards

#### Guard B — Same-Frame Return/Reversal Block
```
if romBand === 'shallow'
  && reversalFrameIndex !== null
  && returnIndex !== null
  && returnIndex <= reversalFrameIndex
→ blockReason = 'return_not_after_reversal'
```
- Physically impossible for a real squat to complete reversal AND return to standing in a single frame (100ms at 10fps).
- **Restricted to `romBand === 'shallow'`**: deep/standard squats have high return thresholds that naturally prevent same-frame detection; applying to deep would break valid high-fps (33ms) golden fixtures where interpolation can land reversal+return on the same index.
- Catches JSON-3 (ascentMs=92ms, 1 frame), JSON-2 (similar pattern).

#### Guard C — Ultra-Short Post-Peak Closure Block
```
if romBand === 'shallow'
  && peakDistanceFromTailFrames < 3
  && peakDistanceFromTailMs < 250ms
→ blockReason = 'insufficient_post_peak_evidence'
```
- BOTH conditions must be true (AND, not OR) to avoid blocking valid 30fps fixtures where 5 post-peak frames = 166ms (frames ≥ 3, so passes).
- Real-device JSON-3: peakDistanceFromTailFrames=2, peakDistanceFromTailMs=184ms → blocked.
- Valid shallow pass (10fps): 5 frames ≥ 3 → not blocked.
- Applies only to shallow/low_rom.

#### Guard A — Slow-Descent Shallow Without Baseline Block
```
if romBand === 'shallow'
  && !preDescentBaselineSatisfied
  && descentDuration / inputWindowDurationMs > 0.85
→ blockReason = 'no_pre_descent_baseline'
```
- If descent fills >85% of the evaluation window AND no pre-descent baseline, the standing start was not captured.
- Real-device JSON-3: descentFillRatio ≈ 0.96 > 0.85 → would also block (Guard B fires first).
- Valid fast shallow squat: descentFillRatio ≈ 0.41 < 0.85 → not blocked.
- Safety net beyond Guards B and C.

#### Guard Order
```
stableAfterReturn? → Guard B (shallow same-frame return) → closureFreshAtTail? → 
activeAttemptWindow? → sameRepOwnership? → Guard C (shallow short post-peak) → 
Guard A (shallow no-baseline slow descent) → PASS
```

#### New Metrics (computed internally for guard logic + diagnostics)
```
peakDistanceFromTailFrames  // lastFrameIndex - peakFrameIndex
peakDistanceFromTailMs      // lastFrameTimestampMs - peakFrameTs
framesAfterPeak             // alias
msAfterPeak                 // alias
```

### 2. `evaluators/squat.ts` — Epoch Source Label Correction

**Root cause of `with_pre_descent_baseline` mislabel:**  
`computeActiveAttemptEpoch` used time-based heuristic (`epochStartMs < descentStartMs`) to label the epoch. But V2's `findMotionWindow` sets `startIndex = 0` when the FIRST frame already satisfies `futurePeak - priorMin >= 0.035` — even if pre-descent frames are included, V2 doesn't recognize them as "pre-descent baseline".

**Fix:** After calling V2, use V2's authoritative `descentStartFrameIndex` to correct the epoch source label:
```typescript
const actualPreDescentBaselineCount = descentStartFrameIndex ?? 0;
const hasActualPreDescentBaseline = actualPreDescentBaselineCount >= 3;
const correctedEpochSource = hasActualPreDescentBaseline
  ? 'active_attempt_epoch_with_pre_descent_baseline'
  : activeEpoch.usedRollingFallback
  ? 'rolling_window_fallback'
  : 'active_attempt_epoch_without_baseline';
m.v2EpochSource = correctedEpochSource;
```

Also updated `computeActiveAttemptEpoch` internal label from `'active_attempt_epoch'` to `'active_attempt_epoch_without_baseline'` for consistency.

### 3. `evaluators/squat.ts` — Pass Cache/Latch Verification Trace Fields

Added debug-only trace fields to verify the cache hypothesis (not influencing pass logic):
```typescript
m.v2InputStartMs = v2EvalFrames[0]?.timestampMs ?? null;
m.v2InputEndMs = latestValidTs;
m.v2InputFrameCount = v2EvalFrames.length;
m.validRawBufferOldestMs = validRaw[0]?.timestampMs ?? null;
m.validRawBufferNewestMs = latestValidTs;
m.validRawFrameCount = validRaw.length;
m.previousSquatPassLatchedInSession = null; // requires session-level wiring
m.previousSquatPassAtMs = null;             // requires session-level wiring
m.v2InputIncludesFramesBeforeLastPass = null;
m.squatCaptureSessionId = null;
```

### 4. `squat-motion-evidence-v2.types.ts` — Type Docs Update

Added JSDoc for new trace fields and new blockReason values:
- `'no_pre_descent_baseline'`
- `'return_not_after_reversal'`  
- `'insufficient_post_peak_evidence'`

---

## New Observation Fixtures

| Fixture | Expected | Block Guard | Reason |
|---------|----------|-------------|--------|
| `real_device_false_pass_after_first_success_01` | FAIL | Guard B | Same-frame reversal+return, slow drift |
| `real_device_false_pass_tiny_motion_01` | FAIL | Guard B | JSON-3 pattern: 4.3s descent, 1-frame return |
| `valid_shallow_with_real_pre_descent_baseline_must_pass` | PASS | (none) | Proper cycle, peakDistanceFromTailMs=1100ms |
| `valid_deep_with_real_pre_descent_baseline_must_pass` | PASS | (none) | Deep cycle, romBand=standard (Guards C/A shallow-only) |
| `standing_small_movement_after_prior_pass_must_fail` | FAIL | V2 basic | micro_bounce (relativePeak=0.015 < 0.035) |

### Diagnostic Script Update (camera-squat-v2-01-motion-evidence-engine-smoke.mjs)

Three existing smoke test expectations updated to reflect Guard B's new more accurate block reason:
- `real_device_false_pass_descent_start_01_must_fail`: `stale_closure_not_at_tail` → `return_not_after_reversal`
- `real_device_false_pass_descent_start_02_must_fail`: `stale_closure_not_at_tail` → `return_not_after_reversal`
- `reversal_return_same_frame_must_fail`: `stale_closure_not_at_tail` → `return_not_after_reversal`

`usableMotionEvidence=false` invariant is preserved in all cases. Guard B fires before the stale closure check, providing a more semantically accurate rejection reason.

---

## Acceptance Commands

```
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs        → 233 passed, 0 failed ✓
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict        → STRICT: all contracts satisfied ✓
npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict             → all V2 results match expected ✓
npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs           → all PR5-FIX checks passed ✓
npx tsx scripts/camera-squat-v2-04-active-epoch-report.mjs                  → exits 0, observations listed ✓
```

---

## Final Report Answers

**1. 브라우저/PWA 캐시였는가, V2 active epoch false-positive였는가?**  
→ **V2 active epoch false-positive.** 각 실패 JSON은 서로 다른 `inputWindowDurationMs`, `activeAttemptEpochStartMs`, `latestFrameTimestampMs`를 가진 신규 V2 decision이다. PWA/브라우저 캐시 재사용은 아니다.

**2. previousSquatPassLatchedInSession/previousSquatPassAtMs로 캐시 가설을 확인했는가?**  
→ **trace 필드 추가 완료.** 현재 stateless evaluator에서는 null로 초기화됨. session-level wiring (auto-progression.ts)이 완료되면 실기기에서 채워진다. trace 필드를 통해 "같은 V2 input이 재사용되지 않음"을 확인 가능하다 (`v2InputStartMs`, `v2InputEndMs`, `validRawBufferOldestMs` 비교).

**3. preDescentBaselineFrameCount=0이면 이제 pass가 막히는가?**  
→ **부분적으로 막힌다.** Guard A(`descentFillRatio > 0.85`) + Guard B(same-frame) + Guard C(short post-peak)의 조합으로. 단, `preDescentBaselineFrameCount=0`만으로는 pass를 막지 않는다 — 빠른 유효 스쿼트도 startIndex=0일 수 있기 때문. 복수 가드의 AND 조합으로 안전하게 막는다.

**4. v2EpochSource가 with_pre_descent_baseline일 때 실제 baseline frame이 존재하는가?**  
→ **이제 존재한다.** V2 반환값의 `descentStartFrameIndex`를 ground truth로 사용하여 label을 교정. `descentStartFrameIndex < 3`이면 `active_attempt_epoch_without_baseline`으로 정정된다.

**5. descentStartFrameIndex=0 shallow pass가 막히는가?**  
→ **조건부.** Guard A: `descentFillRatio > 0.85`인 경우에만. `valid_shallow_real_device_failed_01` (880ms 윈도우, ratio=0.41)은 막히지 않음. JSON-3 false-positive (4471ms 윈도우, ratio=0.96)는 막힌다. 단순 `descentStartFrameIndex===0 → block`은 유효 스쿼트 회귀를 유발하므로 ratio 기반으로 완화.

**6. reversalFrameIndex === nearStartReturnFrameIndex pass가 막히는가?**  
→ **shallow romBand에서 막힌다 (Guard B).** `romBand === 'shallow'` 제한 적용. Deep/standard는 33ms FPS에서의 인터폴레이션 아티팩트로 인한 golden fixture 회귀를 방지하기 위해 제외.

**7. peakDistanceFromTailFrames < 3 또는 peakDistanceFromTailMs < 250ms pass가 막히는가?**  
→ **AND 조건으로 막힌다 (Guard C).** `peakDistanceFromTailFrames < 3 AND peakDistanceFromTailMs < 250ms`. OR이 아닌 AND인 이유: 30fps에서 5 post-peak frames = 166ms (ms < 250 이지만 frames ≥ 3이므로 통과). 10fps 실기기 false-positive: 2 frames AND 184ms → 막힘.

**8. 정상 shallow/deep pass는 유지되는가?**  
→ **유지된다.** 5개 acceptance 스크립트 모두 통과. `valid_shallow_real_device_failed_01/02/03`, `valid_deep_real_device_passed_01` 모두 pass 유지. `valid_shallow_with_real_pre_descent_baseline_must_pass`, `valid_deep_with_real_pre_descent_baseline_must_pass` 신규 fixture도 PASS.

**9. prior pass 이후 standing small movement는 fail하는가?**  
→ **Fail.** `standing_small_movement_after_prior_pass_must_fail` fixture: `relativePeak=0.015 < 0.035 (MEANINGFUL_DESCENT_MIN)` → `micro_bounce` blockReason. V2가 기본 meaningfulDescent 체크에서 막는다. 가드 레이어에 도달하지도 않는다.

**10. V2 threshold/legacy owner를 건드리지 않았는가?**  
→ **건드리지 않았다.** `MAX_SQUAT_CYCLE_MS`, `MAX_TAIL_CLOSURE_LAG_MS`, `MEANINGFUL_DESCENT_MIN`, `SHALLOW_ROM_MAX`, `STANDARD_ROM_MAX`, `RETURN_TOLERANCE_MIN` 등 모든 V2 threshold 불변. legacy owner 복구 없음. finalPassEligible fallback 없음. PR6 legacy demotion 되돌리지 않음.

---

## Hard Boundaries Respected

- ✅ paid-first 재정의 없음
- ✅ legacy owner 복구 없음
- ✅ threshold-only 완화 없음
- ✅ shallow promotion patch 없음
- ✅ overhead reach 수정 없음
- ✅ /app execution 코어 수정 없음
- ✅ PR6 legacy demotion 유지

---

## Known Limitations / Next Steps

1. `previousSquatPassLatchedInSession` / `previousSquatPassAtMs` trace fields are null in the stateless evaluator. **Session-level wiring** in `auto-progression.ts` needed to populate them for real-device cache verification.
2. Guard A (`descentFillRatio > 0.85`) is a heuristic — a legitimate slow squat with a long window could theoretically be blocked if their entire squat cycle starts at frame 0. Consider adding an explicit "baseline frame warmup" phase in the capture pipeline.
3. Guard B restricted to `shallow` only — if a future false-positive appears with `standard` or `deep` romBand using same-frame reversal/return at low fps (< 5fps), Guard B would not catch it.
4. Epoch source label correction uses V2's `descentStartFrameIndex` which is inherently 0 when V2's `findMotionWindow` fires immediately. Fixing V2's start detection to skip baseline frames is a deeper algorithmic change deferred to a future PR.
