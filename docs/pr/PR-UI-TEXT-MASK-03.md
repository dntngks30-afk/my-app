# PR-UI-TEXT-MASK-03 — Landmark headline text-mask reveal (public only)

## 목적

공개 퍼널에서 **소수의 히어로 헤드라인**에만, 과하지 않은 **좌→우 clip 마스크 1회 진입**을 적용해 에디토리얼·프리미엄 톤을 낸다.

## CURRENT_IMPLEMENTED

- `src/components/public/text-mask/TextMaskReveal.tsx` — `usePublicReducedMotion`이 `false`일 때만 Framer `clipPath` 진입, 그 외 정적 표시
- 적용 위치 (의도적으로 소수):
  - 랜딩 `StitchLanding` 메인 `h1`
  - 인트로 `IntroWelcome` 메인 `h1`만
  - 결과 Step1 `BaselineResultStep1` 타입 라벨 `h2`
  - `StitchOnboardingPrepScene` 메인 `h1`
  - `StitchOnboardingCompleteScene` 성공 `h1`

## NOT_YET_IMPLEMENTED / EXCLUDED

- 설문 옵션·본문·내비·카메라 라이브 카피
- 모든 인트로 화면 일괄 적용
- Lottie·트리거 연출·결과 레이아웃 개편

## 검증

- [ ] `npm run build`
- [ ] `/app` 미변경
- [ ] 감소 모션: 정적 문장 유지
