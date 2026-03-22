# PR-ONBOARDING-01 — Post-pay Onboarding Minimization

## 목적

결제 직후 `/onboarding` 화면을 **실행 시작 설정(빈도·경험·안전 신호) 3필드** 중심으로 읽히게 정리한다. 스키마·API·클레임 순서는 변경하지 않는다.

## 유지한 것

- 필수 저장: `target_frequency`, `exercise_experience_level`, `pain_or_discomfort_present` → `POST /api/session/profile`
- 선택: `lifestyle_tag` — body에만 포함(비어 있으면 키 생략)
- 라우트 체인: `/onboarding` → `/session-preparing` → `/onboarding-complete`(claim) → `/app/home`
- `target_frequency` 초기값 4 — 본 PR에서 변경 없음

## 변경 요약

- 카피: 분석/프로필 완성 톤 → 실행·첫 세션 직전 톤
- UI: 선택 `lifestyle_tag` 입력을 접힌 `<details>`로 이동해 메인 부담 감소
