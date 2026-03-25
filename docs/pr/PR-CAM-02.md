# PR-CAM-02 — 스쿼트 motion truth: 사이클 통과 vs planning quality 분리 강화

## Findings

- PR-CAM-01 이후 `squatEvidenceLevel` → `resultEvidenceLevel` → `camera_evidence_quality` → `camera_planning_evidence_tier` 체인이 있으나, **표준 ROM(standard) 라벨**이 곧바로 `strong_evidence`가 되어 사이클은 맞지만 **폼·신뢰 신호가 약한 경우** planning 쪽이 과하게 낙관될 수 있었다.
- 역전(reversal) 판정이 고정 `0.005` depth epsilon에 의존해, **깊은 스쿼트**에서 아주 작은 되돌림으로 조기 역전이 성립할 여지가 있었다(미드 라이즈 조기 완료 완화 목표와 정합).
- 얕은 ROM(`relativeDepthPeak` &lt; ~10–11%)에서는 **스파이크성 짧은 하강** 또는 **피크 직후 너무 빠른 “복귀”**가 실제 유효 사이클과 구분되기 어려울 수 있어, **최소 시간 게이트**가 보수적으로 도움이 된다.

## Why squat pass and planning quality must remain separate

- 제품 규칙: 스쿼트는 **깊이 경쟁**이 아니라 **descend → ascend → recovery** usable cycle 검증이 우선이다. 저ROM도 동일한 통과 권한을 가져야 한다.
- 동시에 세션 병합은 **설문 baseline**이 주도하고 카메라는 **보수적 evidence**이므로, “통과했다”만으로 **강한 planning 반영(standard tier)** 이 되면 안 된다. 통과는 progression gate, **evidence level은 별도 신호**로 유지해야 한다.

## Files changed

| 파일 | 내용 |
|------|------|
| `src/lib/camera/squat-completion-state.ts` | 적응형 reversal drop, 얕은 ROM용 하강·복귀 최소 시간, 디버그 필드 |
| `src/lib/camera/auto-progression.ts` | 통과 시 `getSquatQualitySignals`로 `squatEvidenceLevel` 보수적 캡, 실패 사유 매핑 |
| `src/lib/camera/evaluators/squat.ts` | `highlightedMetrics`에 PR-CAM-02 관측값(퍼센트/ms) |

## Exact revised cycle / quality logic

### 1) 적응형 역전(reversal) 요구량

- `squatReversalDropRequired = max(0.007, relativeDepthPeak * 0.13)` (depth proxy 단위).
- 피크 이후 어떤 프레임이라도 `depth <= peak - squatReversalDropRequired` 이면 역전 성립.
- 상승 확인(ascent)도 동일 threshold 사용.

### 2) 얕은 ROM 타이밍 게이트 (통과 게이트 — 깊이 추가 요구 아님)

- `relativeDepthPeak < 0.10`: `descent → peak` 구간 **≥ 200ms** (`descent_span_too_short` 실패).
- `relativeDepthPeak < 0.11`: `peak(역전 시점) → standing recovered` **≥ 200ms** (`ascent_recovery_span_too_short` 실패).

`relativeDepthPeak ≥ 0.11` 인 사이클에는 위 시간 게이트 **미적용**(깊은/중간 ROM은 기존 회복 홀드 등으로 유지).

### 3) 통과 후 evidence 캡 (planning-safe, PR-CAM-01 정렬)

`standing_recovered` + guardrail complete 확정 시:

- 기본: 기존과 같이 `standard` → `strong_evidence`, `low_rom` → `shallow_evidence`, `ultra_low_rom` → `weak_evidence`.
- **추가**: `strong_evidence`인데 `getSquatQualitySignals`의 `strongQuality`가 아니면 → `shallow_evidence` (`confidenceDowngradeReason: cam02_standard_cycle_quality_capped`).
- **추가**: `shallow_evidence`인데 무릎/상체/바텀 안정 중 **2개 이상 concern** → `weak_evidence` (`cam02_low_rom_quality_capped`).

저장 시 스쿼트 페이지는 기존처럼 `squatCycleDebug`를 evaluator `debug`에 병합하므로 `normalize` → refined 경로와 일치한다.

## Intentionally not changed

- 공개 라우트, PublicResultRenderer, 카피, 오버헤드 로직, 보이스 시스템, 설문·merge 정책 본체, `build-camera-refined-result` / UnifiedDeepResultV2 필수 스키마.
- 오버헤드·벽천사·밸런스 evaluator.

## Risks / follow-ups

- 저주사율/짧은 클립에서 200ms 게이트가 간헐 실패할 수 있음 → 실제 기기 dogfooding으로 임계값 조정.
- `strongQuality`는 기존 임계(깊이·무릎·상체·바텀·confidence)에 의존 — 추후 evaluator 메트릭과 더 직접 정렬 가능.

## Acceptance checklist

- [ ] 저ROM이지만 의미 있는 사이클(기존 PR-7 A 케이스) 통과 유지.
- [ ] 미세 딥/노이즈(D 케이스) 및 미완성 사이클(B2/E) 비통과 유지.
- [ ] `npx tsx scripts/camera-pr7-squat-completion-quality-split-smoke.mjs` 통과.
- [ ] `npm run build` 통과.

## Suggested git commands

```bash
git add src/lib/camera/squat-completion-state.ts src/lib/camera/auto-progression.ts src/lib/camera/evaluators/squat.ts docs/pr/PR-CAM-02.md
git commit -m "fix(camera): PR-CAM-02 squat cycle vs planning-quality separation"
```
