# 카메라 Evaluator 및 Normalize 스키마

## 1. Evaluator별 metric 목록

### squat
| metric | 설명 | trend 기준 |
|--------|------|------------|
| depth | 고관절-무릎-발목 각도 평균 | max≥80° good, ≥60° neutral, else concern |
| knee_alignment_trend | 무릎/엉덩이 너비 비율 | 0.9~1.1 good, else concern |
| trunk_lean | 상체 기울기 | \|avg\|<15° good, else concern |
| asymmetry | 좌우 깊이 차이 | <10° good, <20° neutral, else concern |

### wall-angel
| metric | 설명 | trend 기준 |
|--------|------|------------|
| arm_range | 팔 가동 범위(어깨-팔꿈치-손목 각도) | ≥150° good, ≥120° neutral, else concern |
| lumbar_extension | 요추 신전 각도 | 90°±20° good, else concern |
| asymmetry | 좌우 팔 범위 차이 | <15° good, <30° neutral, else concern |

### single-leg-balance
| metric | 설명 | trend 기준 |
|--------|------|------------|
| sway | 골반 수직 흔들림 | <0.05 good, <0.1 neutral, else concern |
| hold_stability | 코 위치 안정성 | swayX<0.03 good, <0.08 neutral, else concern |
| pelvic_drop | 골반 기울기 | <0.05 good, else concern |
| left_right_gap | 전반부/후반부 골반 X 차이 | <0.05 good, else neutral |

## 2. Normalize schema

```ts
interface NormalizedCameraResult {
  movementType: string;        // kangaroo | hedgehog | crab | monkey | unknown
  patternSummary: string;
  avoidItems: string[];        // 최대 2개
  resetAction: string;         // 1개
  confidence: number;          // 0.0 ~ 1.0
  captureQuality: 'ok' | 'low' | 'invalid';
  flags: CameraGuardrailFlag[];
  retryRecommended: boolean;
  fallbackMode: 'survey' | 'retry' | null;
  insufficientSignal: boolean;
  evaluatorResults: EvaluatorResult[];
  debug: {
    perExercise: StepGuardrailResult[];
  };
}
```

- **movementType**: concern 비율 기반 (≥60% kangaroo, ≥40% hedgehog, ≥20% crab, else monkey)
- **avoidItems**: concern 메트릭 → 한글 라벨 매핑
- **resetAction**: step별 추천 (squat→벽 스쿼트, wall-angel→문틀 스트레칭, balance→한발 서기)
- **captureQuality**: step guardrail의 최저 품질 기준으로 집계
- **confidence**: step confidence 평균을 0~1 범위로 집계

## 3. Capture quality / confidence 기준

공통 입력 신호

- visible joints ratio
- average landmark confidence (`visibility`가 있을 때만 사용)
- critical joints availability
- body bbox size stability
- valid frame count
- dropped frame ratio
- noisy frame ratio
- left/right side completeness
- exercise-specific motion completeness

품질 분류

- `ok`: 충분한 valid frame + critical joint 확보 + motion completeness 충족
- `low`: 일부 구간이 짧거나 side completeness가 낮지만 부분 결과는 가능
- `invalid`: 프레임 부족 / critical joint 부족 / motion completeness 미충족으로 결과 확정 차단

confidence 계산

- 기본 가중치: quality score, valid frame score, motion completeness, critical joint availability, side completeness, bbox stability, metric sufficiency
- 감점: dropped ratio, noisy ratio, landmark confidence low
- 결과 범위: `0.0 ~ 1.0`

## 4. Insufficient signal 기준

- **프레임 수**: `MIN_VALID_FRAMES = 8` 미만
- **랜드마크**: `landmarks.length >= 33` 미만인 프레임 제외 후 valid 수
- **stub extractor**: 항상 `null` 반환 → landmarks 비어있음 → insufficient
- **정규화 차단**: `captureQuality === 'invalid'` 또는 `anyInsufficient && validResults.length < 2`
- **single-leg-balance**: 한쪽 구간만 잡히면 `partial_capture`, 양쪽 모두 짧으면 `hold_too_short` + `invalid`

## 5. Retry / fallback 규칙

- `invalid`: result 진입 차단, `다시 촬영하기` + `설문형으로 전환` 제공
- `low`: partial result 허용, `현재 결과 보기` + `다시 촬영하기` + `설문형으로 전환` 제공
- `ok`: 바로 result 진입

## 6. Acceptance test 결과

| 항목 | 결과 |
|------|------|
| 세 동작 완료 후 normalized result 생성 | ✅ complete 페이지에서 evaluatorResults → normalize → save |
| squat / wall angel / single-leg balance 각각 capture quality 평가 | ✅ step 저장 시 guardrail 계산 |
| visible joints 부족 시 quality 하향 | ✅ `framing_invalid`, `partial_capture` 반영 |
| valid frames 부족 시 insufficient_signal / valid_frames_too_few | ✅ 반영 |
| 한발서기 한쪽만 촬영 시 partial_capture / side-missing | ✅ `left_side_missing` / `right_side_missing` 반영 |
| low/invalid 결과에서 retry CTA 노출 | ✅ complete 페이지 분기 |
| low/invalid 결과에서 survey fallback CTA 동작 | ✅ complete 페이지 분기 |
| confidence / captureQuality / flags / retryRecommended / fallbackMode 포함 | ✅ normalize 확장 |
| result 진입 보호 | ✅ invalid는 차단, low는 partial 허용 |
| /app/** 영향 없음 | ✅ `/app/**` 미수정 |
