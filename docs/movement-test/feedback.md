# Movement Test 피드백 설문 (PR1-FEEDBACK SIMPLIFY)

## 개요

- 결과 페이지 "테스트 평가하기" → `/movement-test/feedback`
- 4단 흐름, 존댓말/친절 톤
- Q2에서 "지금은 필요 없어요" 선택 시 Q3/Q4 숨김, 제출로 종료

---

## 질문 흐름

| 단계 | 질문 | 옵션 | 분기 |
|------|------|------|------|
| Q1 | 결과가 현재 상태와 어느 정도 잘 맞는다고 느끼셨나요? | YES, MAYBE, NO | - |
| Q2 | 정밀 버전이 있다면 이용해보고 싶으신가요? | YES, MAYBE, UNKNOWN, NO | NO → Q3/Q4 숨김 |
| Q3 | 어떤 기능이 가장 끌리시나요? | 4지선다 + 기타 | Q2≠NO 시만 |
| Q4 | 어느 정도 가격까지 괜찮으실까요? | 4지선다 + 기타 | Q3 선택 후 |

---

## 저장 필드

- accuracy_feel: YES | MAYBE | NO
- wants_precision: YES | MAYBE | UNKNOWN | NO
- precision_feature, precision_feature_other (Q2≠NO 시)
- price_range, price_other (Q2≠NO 시)
- result_main_animal, result_type, axis_scores (v2 컨텍스트)
