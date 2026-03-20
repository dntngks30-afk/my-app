# PR-PAY-CONTINUITY-05 — Public 결과 → 인증 → 결제/실행 연속감 강화

## 1. Assumptions

- `next`/OAuth·이메일 복귀 경로에 **쿼리 문자열**이 포함돼도 안전하다(SSOT §3-7, `sanitizeNext`/`resolvePostAuthPath`가 상대 경로+쿼리 허용).
- 실행 CTA는 `useExecutionStartBridge` 단일 경로를 유지한다.
- 자동 이어가기는 **bridge context(`moveReBridgeContext:v1`)가 있을 때만** 수행한다(북마크·수동 URL 오남용 방지).

## 2. CURRENT_IMPLEMENTED (이 PR 후)

- 미로그인 사용자가 실행 CTA 클릭 시 `/app/auth?next=<결과경로>?continue=execution`으로 이동한다.
- `useResumeExecutionAfterAuth` + `ResumeExecutionGate`(Suspense): 인증 후 같은 결과 페이지에 돌아왔을 때 `continue=execution` + bridge가 있으면 **한 번** `handleExecutionStart`를 호출해 inactive→Stripe / active→`onboarding-prep`로 바로 이어진다.
- bridge context·핸드오프와 맞추기 위해 `resolvePublicResultIdForBridgeStage`로 public result id를 해석한다.
- Stripe `cancelNext`에는 `continue` 쿼리를 제거한 경로를 넘긴다.
- `/app/auth`: `movement-test` 또는 `continue=execution`이 `next`에 있으면 **연속성 안내** 카피를 표시한다.
- `/onboarding-prep`: “결제 완료” 단정 카피를 제거하고, **실행 준비** 중심의 중립 문구로 바꾼다(결제 없이 active로 온 사용자도 사실에 맞게).

## 3. LOCKED_DIRECTION

- 결제 = 실행 unlock, public-first 단일 입구, auth/pay 후 bridge·결과 연속성 유지.

## 4. NOT_YET_IMPLEMENTED

- Stripe 성공 전용(`?paid=1` 등)으로 온보딩 프렙 카피를 세분화하는 것.
- 세션 생성·readiness·bootstrap 계약 변경.

## 5. Findings (변경 전)

- 인증 후 결과 URL로 돌아오면 **실행 시작을 다시 눌러야** 결제/온보딩으로 이어져 “끊긴 느낌”이 남음.
- `onboarding-prep`가 항상 “결제가 완료되었습니다”로 표시되어, **결제 없이** active 사용자가 결과→실행 경로로 들어올 때 메시지가 어긋남.

## 6. Root cause of remaining pay-continuity friction

- **Post-auth**: `next`가 결과 **페이지**까지만 복원되고, **실행 분기(CTA)** 는 자동 재실행되지 않음.
- **Copy**: 온보딩 프렙이 결제 완료를 전제로 한 문장이었음.

## 7. Files changed

- `src/lib/public-results/public-result-bridge.ts` — 쿼리 상수, append/strip, `resolvePublicResultIdForBridgeStage`
- `src/lib/public-results/useExecutionStartBridge.ts` — `next`에 `continue=execution`, id 해석, cancel 경로 정리
- `src/lib/public-results/useResumeExecutionAfterAuth.ts` — 자동 이어가기 훅
- `src/components/public-result/ResumeExecutionGate.tsx` — Suspense + `useSearchParams` 경계
- `src/app/movement-test/baseline/page.tsx`, `refined/page.tsx` — Gate 연결
- `src/app/app/auth/AppAuthClient.tsx` — 연속성 카피
- `src/app/onboarding-prep/page.tsx` — 중립 카피
- `docs/pr/PR-PAY-CONTINUITY-05.md`

## 8. Proposed flow after change

1. 결과 → 실행 CTA → (미로그인) bridge 저장 + auth `next=/movement-test/...?continue=execution`
2. 로그인/가입 완료 → 같은 결과 페이지(쿼리 유지)
3. 세션 + bridge + `continue=execution` → URL 정리 후 **자동** `handleExecutionStart` → 결제 또는 온보딩 프렙
4. (수동) 사용자가 다시 CTA를 눌러도 동일 훅으로 동작

## 9. Why this is safe relative to SSOT

- `/` 하드 리다이렉트 없음, checkout/onboarding-prep **계약 URL** 유지.
- 자동 전진은 **bridge가 있을 때만**(의도된 퍼널).
- React Strict Mode 중복 호출은 `sessionStorage` 가드로 완화.

## 10. Acceptance tests (manual)

1. Baseline 결과 → 실행 CTA → 로그인 → 결과로 복귀 후 **추가 클릭 없이** inactive면 결제(또는 Stripe URL), active면 `onboarding-prep`로 이어짐.
2. Refined 동일.
3. 회원가입 경로에서도 `next`에 `continue`가 유지되는지(이메일/OAuth·dev 가입).
4. Inactive 로그인 사용자: 자동 이어가기 후 결제 흐름이 보임.
5. `next`가 `/movement-test/...`일 때 루트 `/`로 튕기지 않음.
6. 기존 bridge·핸드오프 동작이 약화되지 않음.
7. 온보딩 생성·readiness·bootstrap·`/app` 실행 코어 코드 변경 없음.

## 11. Explicit non-goals

- 결제 UI 전면 개편, checkout API 스키마 변경.
- onboarding 최소화·PWA 안내 등 타 워크스트림.

---

## Implementation type

**Mixed**: route/query(`continue=execution`) + bridge state + renderer(Suspense Gate) + **copy**(`/app/auth`, `onboarding-prep`).

## Follow-up PRs (구현하지 않음)

- `onboarding-prep`에 `source=checkout|post_login` 쿼리로 카피 A/B.
- 자동 이어가기 실패 시 토스트 + CTA 강조.

## Manual test paths

- `/movement-test/baseline` — 시크릿에서 실행 CTA → auth → 복귀.
- `/movement-test/refined` — 동일(로그인 상태에 따라 active/inactive).

## Diff summary

- Auth `next`에 `continue=execution` 부착; 복귀 시 bridge 있으면 실행 분기 1회 자동.
- Public result id 해석에 bridge context 반영.
- Auth·온보딩 프렙 카피로 “리셋/결제 단정” 인식 완화.
