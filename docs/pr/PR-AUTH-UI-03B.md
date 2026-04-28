# PR-AUTH-UI-03B — Auth Primary Button Color Alignment

## 목적

- 로그인/회원가입 **submit**을 `MoveRePrimaryCTA`와 동일한 **`--mr-public-accent` / `--mr-public-accent-hover`** fill·그림자·포커스링으로 통일한다.
- Stitch 계열 **`#ffb77d` 등은 submit fill에 사용하지 않음**(배경 glow·링크 보조 표현은 문서 허용 범위 유지 또는 `mr-public-text-accent` 사용).

## 수정 파일

- `src/components/auth/AuthCard.tsx` — 제출 버튼 `MoveRePrimaryCTA` 복귀 입력 포커스 `var(--mr-public-accent)` 로 정렬링크 `mr-public-text-accent`.
- `src/app/app/auth/AppAuthClient.tsx` — 로그인/회원가입 선택 칩 활성 상태를 동일 액센트 토큰으로 교체(Stitch copper fill 제거).

## 기능

- 변경 없음 — 폼 동작 OAuth·redirect·signup 계약 동일.

## 검증

- `npm run build`

