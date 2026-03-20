# PR-RESULT-IA-03 — 공개 결과 2~3단 액션 지향 IA

## 1. Assumptions

- `UnifiedDeepResultV2` 필드 의미·빌더는 변경하지 않는다.
- baseline/refined는 동일 `PublicResultRenderer`를 사용한다.
- 실행 시작 CTA는 부모가 `actions`로 주입하는 기존 방식을 유지한다.

## 2. CURRENT_IMPLEMENTED (이 PR 후)

- 결과 UI가 **3단계(스텝)** 로 나뉜다: (1) 타입·한 줄 설명·불릿 3개 (2) 요약 본문 + 일상 조심 4개 (3) 추천·습관·순서 프리뷰 + **실행 CTA**.
- **신뢰도 바·축별 벡터·분류 근거 칩·누락 신호 블록**은 공개 본문에서 제거했다.
- 타입별 **프레젠테이션 전용** 카피(`PRIMARY_TYPE_*` in `public-result-labels.ts`)로 추천·습관·순서 프리뷰를 채운다.
- `summary_copy`는 괄호 메타 접미사를 제거한 뒤 Step 2 본문으로 사용한다(`stripSummaryMetaSuffix`).

## 3. LOCKED_DIRECTION

- 단일 입구·설문 baseline·카메라는 refine 직전 optional.
- 진단·의료 톤 금지, 내부 스코어를 주된 내러티브로 쓰지 않음.

## 4. NOT_YET_IMPLEMENTED

- 추천·습관·순서를 **세션 생성 결과와 완전 연동**하는 동적 프리뷰.
- 스텝 수를 2으로 줄이는 변형(현재는 3스텝).

## 5. Findings

| 항목 | 내용 |
|------|------|
| 렌더 위치 | `PublicResultRenderer` — `baseline`·`refined` 페이지만 사용. |
| 이전 문제 | 신뢰도 %·priority_vector·reason 칩·evidence 배지가 **분석 대시보드** 느낌. |
| 실행 CTA | Step 3 하단, `actions` 배열 순서 유지(부모 주입). |

## 6. Root cause

- 단일 렌더러에 **계약 필드를 그대로 시각화**해 사용자 향 액션 서술보다 **내부 분석 표면**이 앞섰다.

## 7. Files changed

- `src/components/public-result/PublicResultRenderer.tsx`
- `src/components/public-result/public-result-labels.ts`
- `src/app/movement-test/baseline/page.tsx` (`confidenceNote` 제거)
- `docs/pr/PR-RESULT-IA-03.md`

## 8. Proposed structure (after)

1. **Step 1:** 현재 타입(라벨) + `PRIMARY_TYPE_BRIEF` + 불릿 3.  
2. **Step 2:** `summary_copy`(메타 제거) + 조심할 점 4.  
3. **Step 3:** 시작 훅 + 추천 운동 2 + 생활 3 + 순서 프리뷰 3 + **실행·기타 CTA**.

## 9. SSOT 대비 안전성

- 계약 타입·스코어링 로직 **미변경**.  
- 표현만 교체; 필드 해석은 **프레젠테이션 레이어**에서만.

## 10. Acceptance tests (manual)

1. baseline: 카메라 없이 3스텝 이해 가능.  
2. refined: 동일 제품 톤, 헤더만 “설문 + 동작” 힌트.  
3. 최대 3스텝.  
4. 타입/설명 명확.  
5. Step 2에 이유+조심.  
6. Step 3에 순서 프리뷰+CTA.  
7. 실행 시작 → auth/pay 기존과 동일.  
8. `/app` 미변경.  
9. 메인 내러티브에 신뢰도·축 벡터 없음.

## 11. Explicit non-goals

- auth/pay/onboarding/session API 변경.  
- 카메라 평가 로직·딥 스코어링 코어 변경.  
- 전환/페이월 리라이트.

---

## Implementation type

- **Shared renderer** + **labels(카피) 데이터** — 페이지 로직 변경 최소.

## Follow-up PRs

- 추천·순서를 실제 생성 플랜과 연동.  
- 스텝 2 본문을 타입별로 더 다듬은 카피 리뷰.  
- 스크린리더/포커스 순서 a11y 강화.

## Manual paths

1. `/movement-test/baseline` (설문 완료 후) — 3스텝 후 실행 CTA.  
2. 카메라 refine 후 `/movement-test/refined` — 동일 3스텝.  
3. fallback(refined 페이지) — 상단 경고 + 동일 플로우.

## Diff summary

- Renderer: 단일 스크롤 → **스텝 네비** + 분석 위젯 제거.  
- Labels: 타입별 액션 카피 테이블 추가.  
- Baseline: `confidenceNote` 제거.
