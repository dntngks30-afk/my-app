# Deep V2 SSOT (Single Source of Truth)

## 데이터 흐름

```
answers (JSONB)
  → calculateDeepV2(answers)
  → extendDeepV2(v2Result)
  → DeepResultV2 (derived)
  → routine engine (generate/ensure)
```

## 원칙

- **루틴 엔진은 answers를 직접 해석하지 않고 derived만 사용한다.**
- derived는 `deep_test_attempts.scores.derived` JSON 경로에 저장된다.
- finalize 시 `extendDeepV2(calculateDeepV2(answers))` 결과를 derived로 저장한다.

## 저장 경로

| 테이블 | 컬럼 | JSON 경로 | 설명 |
|--------|------|-----------|------|
| deep_test_attempts | scores | `scores.derived` | DeepResultV2 전체 객체 |
| deep_test_attempts | result_type | - | 6타입 중 하나 |
| deep_test_attempts | confidence | - | 0~1 |

## DeepResultV2 (derived) 필드

- `result_type`: 6개 타입 (NECK-SHOULDER, LUMBO-PELVIS, UPPER-LIMB, LOWER-LIMB, DECONDITIONED, STABLE)
- `primaryFocus`, `secondaryFocus`
- `level`: 1 (초보/재활), 2 (일반), 3 (강화)
- `focus_tags`: 템플릿 추출용 목표 태그
- `avoid_tags`: 절대 금지 태그
- `objectiveScores`, `finalScores`
- `confidence`
- `algorithm_scores`: 알고리즘 내부 계산용 (선택)

## 타입 정의

- `src/lib/deep/v2/types.ts`: DeepResultV2 계약
- `src/lib/deep-test/scoring/deep_v2.ts`: calculateDeepV2, extendDeepV2
