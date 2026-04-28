# PR-AUTH-UI-03 — Auth Screen Intro Tone Parity

## 목적 (CURRENT_IMPLEMENTED)

- `/app/auth`, `/login`, `/signup`를 `/intro/welcome`(IntroSceneShell)과 **동일 네비/노이즈/별 패턴/중앙 copper glow** 비주얼 패밀리로 맞춘다.
- **기능 변경 없음** — OAuth, `redirectTo`/`next`, Supabase 호출 계약 미변경.

## 새 파일 / 수정 파일

| 경로 | 설명 |
|------|------|
| `src/components/auth/MoveReAuthIntroShell.tsx` | **신규** — `IntroSceneShell` 54–82행과 동일한 noise/star/glow + `public-chapter-content-default` 메인 레이아웃.intro step·bottom nav **제외**. |
| `src/components/auth/MoveReAuthScreen.tsx` | `MoveReFullscreenScreen` 제거 → `MoveReAuthIntroShell` 적용.hero: `MOVE RE` + serif title만(설명 금지). |
| `src/components/auth/AuthShell.tsx` | `MoveReSurfaceCard` 해제.intro 문서 권장 glass: `rounded-[28px]`·`border-white/[0.08]`·`bg-[#151b2d]/70`·`backdrop-blur-md`. |
| `src/components/auth/AuthCard.tsx` | `AUTH_INPUT_CLASS`·`AUTH_PRIMARY_BUTTON_CLASS`(copper `#ffb77d`). `MoveRePrimaryCTA` → submit `<button>` 동일 상태 흐름. 링크/보조글 `#dce1fb` 계열·`#ffb77d` 액센트. |
| `src/components/auth/AuthSocialButtons.tsx` | `AUTH_SOCIAL_BUTTON_CLASS`(PR 권안). |
| `src/app/app/auth/AppAuthClient.tsx` | 모드 칩·OTP 안내 필을 INTRO copper·보더 톤에 맞춤. |

## `IntroSceneShell` 미수정

- `src/components/stitch/intro/IntroSceneShell.tsx` **변경 없음**(요구사항 준수).

## Hero

- 로그인: **내 분석을 이어서 확인하세요**
- 회원가입: **나를 위한 리셋 여정을 시작하세요**
- hero에 description/subtitle 줄 없음(exception: 폼 카드 안 오류·약관·링크 등).

## 검증

- `npm run build` — 통과해야 함.

## 리스크

- `/signup/complete`(Neo 입력) 등 `AuthShell`을 쓰는 비-auth 화면은 동일 카드 스킨 상속 가능 — 필요 시 해당 페이지만별 스타일 분기는 후속 과제.

