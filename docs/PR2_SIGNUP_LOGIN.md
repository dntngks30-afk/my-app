# PR2: Signup Step1 + Login 구현

## Supabase Redirect URL 설정 (필수)

Supabase 대시보드 > Authentication > URL Configuration > Redirect URLs 에 다음을 등록하세요:

- **로컬**: `http://localhost:3000/signup/complete`
- **프로덕션**: `https://your-domain.com/signup/complete`

미등록 시 이메일 링크 클릭 후 리다이렉트가 차단됩니다.

## 변경 사항

1. **/signup** - `signInWithOtp` 이메일 링크 발송, 성공 시 "메일 확인" UI
2. **/signup/complete** - `code` 파라미터로 `exchangeCodeForSession`, `getUser()` 후 이메일 고정
3. **/login** - `signInWithPassword`, 성공 시 `/` 리다이렉트

## 테스트 시나리오 결과

(1) signup link send - 이메일 입력 후 회원가입 클릭 → 메일 확인 UI 표시  
(2) open link → email locked - 이메일 링크 클릭 후 /signup/complete 이동 → 이메일 필드 고정 표시  
(3) login ok - 이메일+비밀번호 입력 후 로그인 → / 로 리다이렉트
