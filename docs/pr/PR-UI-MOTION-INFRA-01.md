# PR-UI-MOTION-INFRA-01 — Public-only media & motion infrastructure

## 목적

공개 퍼널(랜딩·intro·설문·refine-bridge·baseline/refined 결과·온보딩 준비·세션 준비·온보딩 완료)에서만 재사용할 **미디어/모션 인프라**를 추가한다.  
본 PR은 **전환·텍스트 마스크·Lottie·트리거 애니메이션 구현을 하지 않는다.**

## CURRENT_IMPLEMENTED

- `src/lib/public/media/` — WebM/WebP 우선 순서 헬퍼 (`buildOrderedPublicVideoSources`, `pickPreferredPublicStillUrl`)
- `src/lib/public/motion/` — `usePublicReducedMotion`, `usePublicDecorativeMotionAllowed`, `shouldPlayPublicDecorativeMotion`
- `src/components/public/media/PublicDecorativeMedia` — 장식 비디오 + 정적 폴백(이미지), SSR/하이드레이션 안전

## NOT_YET_IMPLEMENTED (후속 PR)

- 챕터 전환, 헤드라인 마스크, 코어 트리거, Lottie, 배경 모션의 실제 연출

## 범위 / 비범위

- **범위:** 공개 퍼널 전용 헬퍼·컴포넌트, `prefers-reduced-motion`·`saveData` 게이트, WebP/WebM 우선 규약
- **비범위:** `/app/*` 실행 코어, AppShell, SessionPanelV2, ExercisePlayerModal, 클레임/준비/세션 생성/인증, 카메라 평가 로직, 라우트 의미·API·DB·localStorage 계약 변경

## 안전성 (SSOT 정렬)

- 실행 코어와 물리적으로 다른 경로(`src/lib/public/*`, `src/components/public/media/*`)에만 추가
- 장식 비디오는 기본적으로 정적 이미지로 폴백해 모바일 디코딩·접근성 리스크를 낮춘다

## 사용 시 참고

- `PublicDecorativeMedia`에서 `fill`을 쓰면 부모에 `position: relative`가 있어야 한다.
- 비디오/이미지 모두 레이아웃은 `className`으로 `object-cover` 등을 맞춘다.

## 검증 체크리스트

- [ ] `npm run lint` 통과 (로컬에서 `next lint`가 실패하면 Next/설정 이슈와 별도로 `npm run build`로 컴파일 확인)
- [ ] `npm run build` 통과
- [ ] `/app` 하위 파일 변경 없음
