# PR-AUTH-UI-03C — Match Auth Primary Buttons to Landing CTA

## 목적

- 로그인/회원가입 **submit**을 `/`(StitchLanding)의 「내 몸 상태 1분 체크하기」와 같은 **그라디언트·텍스트·그림자·radius·호버/active**로 맞춤.
- 기능·OAuth·redirect·signup 계약 **변경 없음**.

## 구현

- `src/components/auth/AuthCard.tsx`에 `AUTH_PRIMARY_CTA_CLASS` 추가 — 랜딩 버튼과 동일 계열 클래스, 폭은 `w-full px-8`로 폼 안에 적합하게 조정(PR 지시).
- `MoveRePrimaryCTA` 제거 → `<button type="submit">` + 동일 상수.
- 버튼에 `style={{ fontFamily: 'var(--font-sans-noto)' }}` — StitchLanding primary CTA와 동일 타입 선택.
- Google/Kakao 버튼 **미변경**(secondary 유지).

## 미수정

- `src/components/stitch/landing/StitchLanding.tsx`(랜딩 CTA 색상 변경 금지).

## 검증

- `npm run build`

