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
  movementType: string;        // kangaroo | hedgehog | crab | monkey
  patternSummary: string;
  avoidItems: string[];        // 최대 2개
  resetAction: string;        // 1개
  confidence: 'high' | 'medium' | 'low';
  insufficientSignal: boolean;
  evaluatorResults: EvaluatorResult[];
}
```

- **movementType**: concern 비율 기반 (≥60% kangaroo, ≥40% hedgehog, ≥20% crab, else monkey)
- **avoidItems**: concern 메트릭 → 한글 라벨 매핑
- **resetAction**: step별 추천 (squat→벽 스쿼트, wall-angel→문틀 스트레칭, balance→한발 서기)

## 3. Insufficient signal 기준

- **프레임 수**: `MIN_VALID_FRAMES = 8` 미만
- **랜드마크**: `landmarks.length >= 33` 미만인 프레임 제외 후 valid 수
- **stub extractor**: 항상 `null` 반환 → landmarks 비어있음 → insufficient
- **정규화**: anyInsufficient && validResults.length < 2 → insufficientSignal=true

## 4. Acceptance test 결과

| 항목 | 결과 |
|------|------|
| 세 동작 완료 후 normalized result 생성 | ✅ complete 페이지에서 evaluatorResults → normalize → save |
| low-confidence / insufficient-signal 처리 | ✅ normalize에서 confidence, insufficientSignal 반환 |
| result consumer와 연결 | ✅ result page에서 loadCameraResult() 분기 |
| 권한/프레임 실패 시 graceful fallback | ✅ permissionDenied → 설문형 전환, stub → insufficient |
| /app/** 영향 없음 | ⚠️ camera/result 경로만 수정 (survey 미수정) |
