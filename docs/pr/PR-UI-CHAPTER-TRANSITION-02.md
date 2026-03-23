# PR-UI-CHAPTER-TRANSITION-02 — Public funnel chapter transition grammar

## 목적

공개 퍼널만 **동일한 “챕터” 전환 문법**(짧은 페이드 + 미세 수직 이동)을 적용해, 페이지가 따로 로드된 느낌보다 **한 브랜드 서사**로 이어지게 한다. 화려한 모션이 아니라 **전환 문법** PR이다.

## CURRENT_IMPLEMENTED

- `src/lib/public/chapter/presets.ts` — `default` / `light` / `calm` 수치·이름 (문서·정합용)
- `src/lib/public/chapter/enterClass.ts` — `publicChapterEnterClass()` → globals CSS 클래스명
- `src/app/globals.css` — `.public-chapter-enter-*` 키프레임 + `@media (prefers-reduced-motion: reduce)` 로 애니메이션 비활성화 (SSR·하이드레이션 안전, JS 훅 불필요)
- `src/components/public/chapter/PublicChapterTransition.tsx` — 서버 컴포넌트 래퍼 (동일 클래스 적용)
- 세그먼트 `template.tsx`로만 삽입 (앱 전역 래퍼 아님):
  - `(main)` — **경로 `/` 일 때만** `default`
  - `intro/*` — `default`
  - `movement-test/*` — `light` (설문·브리지·결과·카메라 포함)
  - `onboarding-prep`, `onboarding`, `session-preparing`, `onboarding-complete` — `calm`

## NOT_YET_IMPLEMENTED

- 텍스트 마스크·Lottie·코어 트리거·결과 레이아웃 개편
- 설문 **문항 내부** 전용 별도 프리셋(현재는 route-level `light` + 기존 `StitchSurveyQuestion`의 `animate-in` 유지)

## 비범위 / 보호

- `/app/*` 실행 코어, AppShell, SessionPanelV2, ExercisePlayerModal
- 인증·클레임·준비·세션 생성·카메라 평가 로직
- 라우트 의미·API·DB·localStorage 계약
- 카피 의미 변경

## 검증

- [ ] `npm run build`
- [ ] `/app` 라우트 파일 미변경
- [ ] 감소 모션: `prefers-reduced-motion` 에서 전환 없음
