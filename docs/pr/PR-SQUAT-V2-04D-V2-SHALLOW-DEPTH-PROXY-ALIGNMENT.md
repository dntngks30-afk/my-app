# PR-SQUAT-V2-04D — V2 Shallow Depth Proxy Alignment

---

## 1. 확정 원인 요약

**원인 타입:** `runtimeV2Depth` 의 `squatDepthProxyBlended` 우선 정책이 얕은 ROM에서 V2 입력을 **연속 곡선이 아닌 tail spike**로 만든다.

**핵심 근거:**
- `finite(frame.derived.squatDepthProxyBlended)` 가 `1e-8` 처럼 유한하지만 무의미한 값이어도 fallback이 막힌다.
- 실기기 얕은 스쿼트 실패 JSON: `v2EvalDepthsSample.first10/last10` 대부분 `1e-8`, 마지막 frame만 `0.0586`.
- 딥스쿼트 성공 JSON: `squatDepthProxyBlended` 가 `0.058 → 0.46 → 0.84 → 0.92 → ...` 정상 곡선.
- 결과: 얕은 ROM에서 V2는 `peakAtTailStall=true`, `no_reversal`, 연속 하강/상승 감지 불가.

**PR04D 전략:** per-frame blended 우선을 버리고, **v2EvalFrames 전체 시계열을 분석해 소스를 선택**한다. Pass 판단 주체는 변경 없이 `SquatMotionEvidenceEngineV2` 가 그대로 담당한다.

---

## 2. 왜 파일 읽기를 제한했는지

원인이 이미 Ask mode에서 확정됐으므로, 아래 4개 파일 외 추가 읽기를 금지했다:
- `src/lib/camera/evaluators/squat.ts` — `runtimeV2Depth`, `toSquatMotionEvidenceV2Frames`, metrics 주석부
- `src/lib/camera/pose-features.ts` — `applySquatDepthBlendPass`, 블렌드 게이트 로직
- `src/lib/camera/squat/squat-depth-signal.ts` — `PRIMARY_STRONG_MIN`, `blendLiftCeiling`
- `src/lib/camera/squat/squat-motion-evidence-v2.types.ts` — metrics 타입 확장 위치

---

## 3. 기존 `runtimeV2Depth` source priority 문제

```typescript
// Before PR04D
function runtimeV2Depth(frame: PoseFeaturesFrame): number {
  return (
    finite(frame.derived.squatDepthProxyBlended) ??
    finite(frame.derived.squatDepthProxy) ??
    finite(frame.derived.squatDepthProxyRaw) ??
    0
  );
}
```

**문제:** `finite(blended)` 가 `1e-8` 이어도 truthy로 평가 → proxy/raw fallback 불가.
- `applySquatDepthBlendPass` 의 temporal suppression / `blendOfferStreak < 3` / `rawPeakCapture` 가 `PRIMARY_STRONG_MIN (0.045)` 이하일 때 `squatDepthProxyBlended` 를 near-zero로 누름.
- V2 전체 입력 시계열이 `1e-8 ... 1e-8 | 0.058` (tail spike) 구조가 됨.

---

## 4. 새 V2 depth source selection policy

### 추가 함수

| 함수 | 역할 |
|------|------|
| `computeV2DepthSeriesStats(depths[])` | 단일 시계열의 max / meaningfulFrameCount / framesAfterPeak / collapsedNearZero / tailSpikeOnly / hasUsableCurve / hasPostPeakDrop 계산 |
| `selectRuntimeV2DepthSeries(frames[])` | blended/proxy/raw 세 시계열을 비교해 최적 소스 선택 |

### 선택 정책

```
1. blended.hasUsableCurve → 'blended_usable'         (정상 경로, 딥 스쿼트 등)
2. blended.collapsedNearZero AND proxy.hasUsableCurve → 'blended_collapsed_proxy_selected'
3. blended.collapsedNearZero AND raw.hasUsableCurve   → 'blended_collapsed_raw_selected'
4. blended.tailSpikeOnly AND proxy.hasUsableCurve     → 'tail_spike_proxy_selected'
5. blended.tailSpikeOnly AND raw.hasUsableCurve       → 'tail_spike_raw_selected'
6. all alternatives also poor                         → 'fallback_blended'  (변화 없음, 진단만 추가)
```

### 품질 판정 기준

| 지표 | 정의 |
|------|------|
| `collapsedNearZero` | max < `V2_DEPTH_EPS * 1000` (~1e-3) — 전 시계열이 노이즈 수준 |
| `tailSpikeOnly` | meaningfulFrameCount ≤ 2 AND framesAfterPeak ≤ 2 |
| `hasUsableCurve` | `!collapsed AND !tailSpike AND meaningfulFrameCount ≥ 3 AND framesAfterPeak ≥ 2` |

> **중요:** 이 기준은 소스 선택용이다. `usableMotionEvidence` 를 직접 true로 만들지 않는다.

### `toSquatMotionEvidenceV2Frames` 수정

```typescript
// Before: per-frame blended 우선
depth: runtimeV2Depth(frame)

// After: selected series 사용
const v2DepthSelection = selectRuntimeV2DepthSeries(v2EvalFrames);
// toSquatMotionEvidenceV2Frames(v2EvalFrames, v2DepthSelection.depths)
depth: selectedDepths[i] ?? runtimeV2Depth(frame)
lowerBodySignal: selectedDepths[i] ?? runtimeV2Depth(frame)
```

---

## 5. 04B/04C guard 유지 증거

| Guard | 위치 | PR04D 영향 |
|-------|------|-----------|
| Guard A (`no_pre_descent_baseline`) | `squat-motion-evidence-v2.ts:699` | 변경 없음 |
| Guard B (`return_not_after_reversal`) | `squat-motion-evidence-v2.ts:650-654` | 변경 없음 |
| Guard C (`insufficient_post_peak_evidence`) | `squat-motion-evidence-v2.ts:685-688` | 변경 없음 |
| PR04C peak-at-tail stall detection | `evaluators/squat.ts` metrics block | 변경 없음 |
| PR04C slow-descent exception | `squat-motion-evidence-v2.ts` | 변경 없음 |

Smoke C1 (04B Guard B): `return_not_after_reversal` ✓  
Smoke C2 (04C peak-at-tail): `awaiting_ascent_after_peak` ✓

---

## 6. legacy owner 복구 없음

| 항목 | 상태 |
|------|------|
| auto-progression owner | `squat_motion_evidence_v2` (변경 없음) |
| consumed field | `usableMotionEvidence` (변경 없음) |
| legacy completion owner | 복구 없음 |
| `finalPassEligible` fallback | 복구 없음 |
| `no_reversal` threshold 완화 | 없음 |
| `MAX_SQUAT_CYCLE_MS` 단순 증가 | 없음 |

---

## 7. 추가 debug fields

`SquatMotionEvidenceV2Metrics` 에 추가된 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `runtimeV2DepthEffectiveSource` | `'blended' \| 'proxy' \| 'raw' \| 'mixed' \| 'fallback_zero'` | 실제로 V2에 전달된 depth 소스 |
| `runtimeV2DepthPolicy` | `string` | 선택 정책 이름 (`blended_usable` / `blended_collapsed_proxy_selected` / `tail_spike_proxy_selected` / `fallback_blended` 등) |
| `v2DepthSourceSwitchReason` | `string \| null` | 소스가 전환된 이유 (`null` = blended 그대로 사용) |
| `v2DepthSourceStats` | `{ blended, proxy, raw }` | 각 소스의 품질 통계 (max / meaningfulFrameCount / collapsedNearZero / tailSpikeOnly / hasUsableCurve 등) |
| `selectedV2DepthFirst10` | `number[]` | 실제로 V2에 전달된 depth 시계열 처음 10개 |
| `selectedV2DepthAroundPeak` | `number[]` | peak ±5 프레임 구간 |
| `selectedV2DepthLast10` | `number[]` | 마지막 10개 |

기존 `v2EvalDepthsSample` 도 **selected series** 기준으로 업데이트된다 (전에는 항상 blended).

---

## 8. 추가 fixtures / smoke

### 신규 smoke script

`scripts/camera-squat-v2-04d-depth-source-alignment-smoke.mjs`

| 섹션 | 테스트 | 결과 |
|------|--------|------|
| A1 | blended usable → `blended_usable` | PASS |
| A2 | blended collapsed, proxy usable → `blended_collapsed_proxy_selected` | PASS |
| A3 | blended tail spike, proxy usable → `tail_spike_proxy_selected` | PASS |
| A4 | all series tail spike → `fallback_blended` | PASS |
| B1 | proxy curve → V2 pass (`down_up_return`, shallow) | PASS |
| B2 | deep blended curve → V2 pass (regression) | PASS |
| B3 | tail spike only → V2 fail | PASS |
| B4 | standing small movement → fail (04B regression) | PASS |
| C1 | same-frame reversal/return → `return_not_after_reversal` (04B guard B) | PASS |
| C2 | peak-at-tail → awaiting, not terminal pass (04C guard) | PASS |

**Total: 40/40 PASS**

### 기존 fixtures 재활용

- `pr04c_peak_at_tail_stall_must_not_pass_but_wait.json` — C2 04C 회귀
- `real_device_false_pass_tiny_motion_01.json` — C1 04B 회귀
- `standing_small_movement_after_prior_pass_must_fail.json` — B4 standing 회귀
- `pr04c_slow_deep_descent_then_ascent_return_must_pass.json` — B2 딥 통과 회귀

---

## 9. acceptance 결과

| smoke | 결과 |
|-------|------|
| `camera-squat-v2-04d-depth-source-alignment-smoke.mjs` | **40/40 PASS** |
| `camera-squat-v2-02b-runtime-owner-truth-smoke.mjs` | **PASS** |

> Smoke passed는 real-device success를 증명하지 않는다.  
> 이번 PR 최종 성공 여부는 실기기 acceptance로 판단한다.

---

## 10. 실기기 재검증 항목

| 항목 | 기대 결과 |
|------|---------|
| 얕은 스쿼트 3회 중 최소 2회 | 자연 통과 (`usableMotionEvidence=true`) |
| 딥스쿼트 1회 | 자연 통과 |
| standing small movement | 통과 금지 |
| 하강 시작 직후 (peak=tail 상태) | 통과 금지 (`awaiting_ascent_after_peak`) |
| tail spike only (빠른 찰나 동작) | 통과 금지 |
| seated/bottom hold | 통과 금지 |
| arm-only/upper-body-only | 통과 금지 |

### 진단 필드 확인 포인트

실기기 JSON에서 아래 필드를 확인하라:

```
v2RuntimeOwnerDecision.metrics.runtimeV2DepthPolicy
  → 얕은 스쿼트: 'blended_collapsed_proxy_selected' 또는 'tail_spike_proxy_selected'이면 정상
  → 딥스쿼트: 'blended_usable'이면 정상

v2RuntimeOwnerDecision.metrics.runtimeV2DepthEffectiveSource
  → 얕은 통과 케이스: 'proxy' 또는 'raw'
  → 딥 통과 케이스: 'blended'

v2RuntimeOwnerDecision.metrics.v2DepthSourceStats.blended.collapsedNearZero
  → 얕은 실패 케이스에서 true이면 원인 확정

v2RuntimeOwnerDecision.metrics.v2EvalDepthsSample
  → selected series 기준으로 업데이트됨
  → 얕은 통과 케이스에서 더 이상 all-1e-8 + tail spike가 아님을 확인
```

---

## PR04D 진행 가능 조건 (다음 PR)

- [ ] 실기기에서 얕은 스쿼트 2/3회 이상 통과 확인
- [ ] 딥스쿼트 통과 유지 확인
- [ ] `runtimeV2DepthPolicy` 가 실기기 JSON에서 의미 있는 값으로 출력되는지 확인
- [ ] false positive (standing, arm-only, tail spike) 통과 없음 확인
- [ ] 필요 시 PR04E: Guard A (`no_pre_descent_baseline`) epoch 정확도 개선 검토
