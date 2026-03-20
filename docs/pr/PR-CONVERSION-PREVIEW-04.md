# PR-CONVERSION-PREVIEW-04 — Step 3 실행 순서·전환 가치 정렬

## 1. Assumptions

- PR-RESULT-IA-03 3단 스텝·CTA 주입 방식은 유지한다.
- `PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW` 등 표현용 데이터는 **정적 예시**이며 실시간 세션 플랜과 1:1 보장은 하지 않는다(면책 문구로 명시).

## 2. CURRENT_IMPLEMENTED (이 PR 후)

- Step 3 헤드라인: **「지금 이렇게 시작하는 게 좋아요」** (`STEP3_HEADLINE`).
- **시작 순서 미리보기** 블록을 최상단 히어로로 두고, 고정 3단계 라벨(`EXECUTION_ORDER_PHASE_TITLES`) + 타입별 `order[]` 한 줄을 번호와 함께 표시.
- **면책**: `STEP3_PREVIEW_DISCLAIMER` — 예시 흐름·실행 단계 자동 이어짐.
- **실행을 시작하면** 블록: `STEP3_VALUE_PILLARS` — 결제 후 실행 이어짐·자동 순서·**실행 unlock**(분석 unlock 아님).
- refined: `STEP3_REFINED_CONTEXT_LINE` 한 줄 추가.
- 추천 동작·생활 팁은 순서 블록 **아래** 보조 섹션으로 유지(제목만 전환 프레이밍에 맞게 조정).
- Step 2 → Step 3 버튼 문구: **「다음 — 시작 순서 보기」**.

## 3. LOCKED_DIRECTION

- 결제 = 실행 unlock, 단일 퍼널·설문 baseline·refine-bridge 유지.

## 4. NOT_YET_IMPLEMENTED

- Step 3와 실제 생성 세션 플랜 필드의 **동적 연동**.
- 결제/체크아웃 UI 전면 개편.

## 5. Findings (변경 전)

- Step 3에서 **추천·생활·순서**가 나열되어 순서 프리뷰가 **맨 아래**라 “순서”가 주인공이 아님.
- 실행·결제 가치가 CTA 직전에 명시되지 않음.

## 6. Root cause

- 정보 순서가 **리스트형 추천**에 가깝고, **시작 순서 → 실행 이어짐 → 결제 의미** 서술이 약함.

## 7. Files changed

- `src/components/public-result/PublicResultRenderer.tsx`
- `src/components/public-result/public-result-labels.ts`
- `docs/pr/PR-CONVERSION-PREVIEW-04.md`

## 8. Proposed Step 3 structure (after)

1. 헤드라인 + (refined 시) 한 줄 + 훅  
2. **시작 순서 미리보기** (3단계 라벨 + 내용 + 면책)  
3. **실행을 시작하면** (가치 3줄)  
4. 동작 예시 2 · 생활 팁 3  
5. 이전 / 출처 한 줄 / **actions (변경 없음)**

## 9. SSOT 대비 안전성

- 계약·API·readiness·온보딩·`/app` **미변경**.  
- 과장 방지 면책 문구 유지.

## 10. Acceptance tests (manual)

1. baseline Step 3: 순서 블록이 **첫인상**으로 읽힘.  
2. refined: 동일 스토리 + 한 줄 문맥.  
3. CTA·핸들러 동일.  
4. 가치 문구로 실행 unlock 인지.  
5. 계약 라우트 **미변경**.  
6. 신뢰도·축 벡터 **미등장**.

## 11. Explicit non-goals

- auth/pay/onboarding/session-create/readiness 코드 변경.  
- 실제 플랜 JSON과 Step 3 하드 연결.

---

## Implementation type

- **Renderer + copy constants** (혼합).

## Follow-up PRs

- 순서 프리뷰와 세션 생성 결과의 **실제 순서** 정합화.  
- CTA 라벨 A/B(부모에서 주입).

## Manual paths

- `/movement-test/baseline` → Step 3.  
- `/movement-test/refined` → Step 3.

## Diff summary

- labels: Step 3 전용 헤드라인·단계 라벨·면책·가치·섹션 제목.  
- renderer: 순서 블록 상단·가치 블록·refined 한 줄·Step 2 버튼 문구.
