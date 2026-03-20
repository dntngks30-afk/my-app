# PR-PUBLIC-BRIDGE-01 — 설문 baseline 직후 optional 카메라 refine 브리지

## 1. Assumptions

- 설문 baseline 결과 생성(`buildFreeSurveyBaselineResult`) 및 `persistPublicResult`는 기존과 동일하게 동작한다.
- 카메라 완료 → `/movement-test/refined` 경로는 변경하지 않는다.
- auth/pay/onboarding/session-create/readiness 계약 라우트는 수정하지 않는다.
- `/app` 실행 코어는 변경하지 않는다.

## 2. CURRENT_IMPLEMENTED (이 PR 반영 후)

- 설문·자가테스트 완료 후 **`/movement-test/refine-bridge`** 로 이동한다.
- 브리지에서 **「결과 먼저 보기」** → `/movement-test/baseline` (전체 `PublicResultRenderer`, baseline stage).
- 브리지에서 **「카메라로 움직임 체크하기」** → `/movement-test/camera` → 기존 완료 플로우 → `/movement-test/refined`.
- `baseline` 페이지의 **구 gate 뷰**(요약 카드 + 신뢰도 바 + 카메라 우선 CTA)는 **제거**하고, 결과는 브리지 이후 한 화면에서 연다.
- DB에서 baseline public result를 복구한 경우 **`뒤로`** 버튼을 숨겨 claim/복구 경로가 `refine-bridge`로 잘못 가지 않게 한다.

## 3. LOCKED_DIRECTION

- 카메라는 optional refine evidence이며, 별도 canonical truth·동등 public 입구가 아니다.
- 결제는 실행 unlock이며, 본 PR에서 결제/분석 의미를 바꾸지 않는다.
- 단일 public entry로 수렴하는 방향은 유지하되, **랜딩 이중 진입 제거는 본 PR 범위 밖**.

## 4. NOT_YET_IMPLEMENTED

- 랜딩의 구 dual-entry 제거.
- 결과 IA 전면 단순화(2~3 화면) 리디자인.
- 브리지·결과 카피의 추가 A/B·로케일.

## 5. Findings

| 질문 | 답 |
|------|-----|
| 설문 완료 후 어디로 가나? (변경 전) | `/movement-test/baseline` 직행 — gate에서 카메라가 시각적 primary에 가까웠고, 신뢰도·정밀 표현이 섞임. |
| 결과는 어디서 열리나? | `/movement-test/baseline` 의 `PublicResultRenderer` (변경 후에도 동일, gate만 제거). |
| 카메라 진입은? | `/movement-test/camera` → `camera/complete` → `/movement-test/refined`. |
| 브리지 구현 방식 | **새 라우트** `refine-bridge/page.tsx` — 변경 최소, 설문 완료 지점에서 URL만 교체하면 됨. |

## 6. Root cause of product mismatch (변경 전)

- “최종 결과 전 선택”이 **baseline 내부 gate**에 묶여 있어, 같은 URL에서 요약·신뢰도·카메라 우선 UI가 **optional refine** 프레이밍과 어긋남.
- 설문 직후 **전용 브리지 화면**이 없어 제품 서술상 “결과 직전 optional bridge”가 약함.

## 7. Files changed

- `src/app/movement-test/refine-bridge/page.tsx` (신규)
- `src/app/movement-test/baseline/page.tsx` — gate 제거, 단일 결과 뷰, DB 복구 시 `onBack` 제거
- `src/app/movement-test/survey/page.tsx` — 완료 시 `refine-bridge`로 라우팅
- `src/app/movement-test/self-test/page.tsx` — 완료 시 `refine-bridge`로 라우팅
- `src/components/public-result/PublicResultRenderer.tsx` — baseline provenance 카피 완화
- `scripts/deep-v2-04-baseline-gate-smoke.mjs`, `scripts/deep-v2-06-unified-renderer-smoke.mjs` — 라우트 기대값 갱신

## 8. Proposed routing (after)

```
설문/자가테스트 완료 → /movement-test/refine-bridge
  ├─ 결과 먼저 보기     → /movement-test/baseline
  └─ 카메라…            → /movement-test/camera → … → /movement-test/refined
```

## 9. Why safe relative to SSOT

- public result persistence·handoff·실행 브리지 훅은 baseline에서 **유지**.
- 계약 라우트(`/app`, API, onboarding) **미변경**.
- 카메라·refined 파이프라인 **재사용**.

## 10. Acceptance tests (manual)

1. 설문 완료 → 브리지 표시.
2. 브리지 → 결과 먼저 → baseline 결과·실행 CTA 정상.
3. 브리지 → 카메라 → 촬영 완료 → refined 결과.
4. 카메라 없이도 결과·이후 단계 가능(스킵이 degraded로 느껴지지 않게 카피).
5. 기존 result에서 auth/pay 시나리오 회귀(스모크/수동).
6. `/app` 동작 미변경 확인.
7. 카메라 강제 없음.
8. (선택) claim으로 baseline 복구 시 상단 `뒤로` 없음.

## 11. Explicit non-goals

- 랜딩 이중 진입 제거, 결과 IA 전면 개편, auth/pay 계약 수정, `/app` 수정.

---

## Implementation type

- **Route-level**: `refine-bridge` 신규.
- **Component-level**: `baseline`에서 gate 컴포넌트 제거, `PublicResultRenderer`만 유지.

## Follow-up PRs (미구현)

- 랜딩 단일 입구 정리.
- 브리지·결과 카피 톤 추가 다듬기.
- `STAGE_META` / renderer 내부 confidence 표현에 대한 별도 UX 감사(본 PR은 최소 수정).
