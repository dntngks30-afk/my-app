# PR-CAM-03 — 오버헤드 리치: top-hold truth와 planning quality 분리

## Findings

- `normalize.getResultEvidenceFromEvaluators`는 기존에 `debug.squatEvidenceLevel`만 수집해, **오버헤드만 있거나 오버헤드가 약해도** 스쿼트 레벨이 없으면 기본값 `strong_evidence`로 떨어질 수 있었다.
- 오버헤드 evaluator는 이미 **연속 stable-top dwell**과 1200ms 통과 홀드를 갖추고 있으나, **통과 직후 planning 반영 강도**를 `holdDuration`·dwell 일관성·보상 메트릭으로 세분화하지는 않았다.
- PR-CAM-02와 동일하게 **progression gate ≠ planning evidence**를 오버헤드에도 적용하려면, evaluator 출력에 **step 전용 evidence 필드**를 두고 normalize에서 weakest 병합이 가장 작은 변경이다.

## Why overhead pass and planning quality must remain separate

- 오버헤드는 “완벽한 자세”가 아니라 **usable signal capture**이지만, **짧은 스침**이 곧바로 세션 병합에서 강한 신호로 읽히면 설문 baseline 대비 카메라 영향이 과대평가된다.
- 최소 홀드로 통과는 허용하되, **더 길고 일관된 top dwell**일 때만 `strong_evidence` → PR-CAM-01 기준 `standard` planning tier로 이어지게 하는 것이 보수적이다.

## Files changed

| 파일 | 내용 |
|------|------|
| `src/lib/camera/evaluators/overhead-reach.ts` | `computeOverheadPlanningEvidenceLevel`, evaluator `debug.overheadEvidenceLevel` / trace 필드 |
| `src/lib/camera/evaluators/types.ts` | `overheadEvidenceLevel` / `overheadEvidenceReasons` (debug 계약) |
| `src/lib/camera/normalize.ts` | squat + overhead evidence weakest 병합 |
| `src/lib/deep-v2/adapters/camera-to-evidence.ts` | PR-CAM-03 한 줄 주석 |
| `scripts/camera-pr8-overhead-reach-completion-smoke.mjs` | N, O 케이스 |

## Exact revised top-hold / quality logic

### Planning evidence (`overheadEvidenceLevel`)

- **`insufficient_signal`**: `raiseCount===0` 또는 `peakCount===0` 또는 `holdDurationMs < 1200` (통과 홀드 미달) 또는 프레임 부족 분기.
- **`strong_evidence`**:  
  - `holdDurationMs >= 1520`  
  - dwell 일관성: `stableTopSegmentCount >= 1` 이고 `stableTopDwellMs >= min(hold*0.85, hold-100)`  
  - `lumbar_extension`·`asymmetry` 둘 다 concern 아님  
  - `peakArm >= 135°`  
  - `holdArmingBlockedReason == null`
- **`weak_evidence`**: dwell이 단편/일시적(`!dwellCoherent`)이거나, 이중 concern이거나, 홀드가 1320ms 미만인데 단일 concern.
- **`shallow_evidence`**: 위에 해당하지 않는 **유효 홀드(≥1200ms) + 일관 dwell** — 기본 “통과는 했으나 planning은 제한” 구간.

### 통과(complete) 게이트

- 변경 없음: guardrail·`evaluateOverheadReachCompletion`의 1200ms·absolute top floor·phase 요구는 그대로.

## Intentionally not changed

- 공개 라우트, renderer, 카피, 보이스 문구/플로우 대개편, 스쿼트 로직, 오버헤드 **페이지** persist 형식(여전히 `gate.evaluatorResult` 저장), merge 정책 본체, UnifiedDeepResultV2 필수 필드.

## Risks / follow-ups

- 실제 기기에서 dwell 일관성 임계(0.85·−100ms)가 간헐적으로 `weak`로 떨어질 수 있음 → dogfooding 후 완화 가능.
- `strong` 피크 135°·1520ms는 보수적이며, 제품 피드백에 따라 조정 여지 있음.

## Acceptance checklist

- [ ] 짧은/우발적 top-only 시퀀스는 `insufficient_signal` 또는 약한 등급.
- [ ] 최소 통과 홀드(1200ms)는 유지되며, 그에 해당하는 클립은 기본 `shallow_evidence`에 가깝게 분류될 수 있음.
- [ ] `npx tsx scripts/camera-pr8-overhead-reach-completion-smoke.mjs` 통과.
- [ ] `npm run build` 통과.

## Suggested git commands

```bash
git add \
  src/lib/camera/evaluators/overhead-reach.ts \
  src/lib/camera/evaluators/types.ts \
  src/lib/camera/normalize.ts \
  src/lib/deep-v2/adapters/camera-to-evidence.ts \
  scripts/camera-pr8-overhead-reach-completion-smoke.mjs \
  docs/pr/PR-CAM-03.md

git commit -m "fix(camera): PR-CAM-03 overhead top-hold vs planning quality"
```
