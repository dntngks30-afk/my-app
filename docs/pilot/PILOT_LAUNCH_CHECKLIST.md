# MOVE RE 파일럿 런칭 체크리스트

이 문서는 파일럿 운영자가 런칭 전후에 확인해야 할 항목만 모은 체크리스트입니다. 실제 secret 값은 문서나 이슈에 남기지 않습니다.

## 운영 전제

### CURRENT_IMPLEMENTED

- PWA 설치 유도, standalone 실행, 알림 권한 요청, `public.push_subscriptions` 저장이 구현되어 있습니다.
- `/api/push/test` 테스트 알림 발송과 알림 클릭 시 `/app/home?source=push&type=test` 이동이 구현되어 있습니다.
- `/api/cron/send-session-reminders` daily reminder cron과 `public.notification_deliveries` 발송 기록이 구현되어 있습니다.
- 오늘 세션 완료 여부는 `public.session_program_progress.last_completed_day_key`와 KST day key 기준입니다.

### LOCKED_DIRECTION

- 파일럿 1차 daily reminder는 KST 20:00 고정입니다.
- 사용자별 알림 시간, 알림 preference, 개인화 문구는 이번 파일럿 운영 범위가 아닙니다.

## 파일럿 전날 체크리스트

- [ ] Production deployment success 확인
- [ ] Vercel Production 환경 변수가 존재하는지 확인
  - [ ] `WEB_PUSH_VAPID_PUBLIC_KEY`
  - [ ] `WEB_PUSH_VAPID_PRIVATE_KEY`
  - [ ] `WEB_PUSH_CONTACT_EMAIL`
  - [ ] `CRON_SECRET`
- [ ] Supabase migration 적용 확인
  - [ ] `public.push_subscriptions` 테이블 존재
  - [ ] `public.notification_deliveries` 테이블 존재
  - [ ] `notification_deliveries`에 `unique(user_id, notification_type, local_date)` 중복 방지 제약 존재
- [ ] Vercel Cron Jobs 설정 확인
  - [ ] path: `/api/cron/send-session-reminders`
  - [ ] schedule: `0 11 * * *`
  - [ ] KST 20:00은 UTC 11:00임을 확인
- [ ] `/api/push/vapid-public-key`가 Production에서 `ok:true`를 반환하는지 확인
- [ ] Android Chrome에서 PWA 설치 플로우 1회 확인
- [ ] iOS Safari에서 홈 화면 추가 플로우 1회 확인
- [ ] Android PWA standalone에서 알림 권한 허용과 테스트 알림 수신 확인
- [ ] iOS 홈 화면 PWA에서 알림 권한 허용과 테스트 알림 수신 확인
- [ ] 테스트 결과 완료 후 세션 생성으로 이어지고 `/app/home`에 진입하는지 확인
- [ ] 리셋맵 진행도가 `session_program_progress`와 일치하는지 확인
- [ ] 첫 세션 실행과 완료가 가능하고 완료 후 `last_completed_day_key`가 KST 오늘로 저장되는지 확인
- [ ] daily_session 알림 중복 발송 방지가 동작하는지 수동 cron 2회 호출로 확인

## 파일럿 당일 시작 전 체크리스트

- [ ] Production 최신 배포가 정상 상태인지 Vercel에서 확인
- [ ] Supabase SQL Editor에서 최근 `push_subscriptions` 상태 확인
- [ ] Supabase SQL Editor에서 최근 `notification_deliveries` 상태 확인
- [ ] Android 실기기 PWA standalone 실행 확인
- [ ] iOS 실기기 홈 화면 PWA 실행 확인
- [ ] 일반 브라우저 탭과 PWA standalone의 차이를 운영자가 설명할 수 있는지 확인
- [ ] 인앱 브라우저 사용자가 오면 외부 브라우저로 열도록 안내할 준비 확인
- [ ] `/app/home?debugPush=1`로 테스트 모드 flag를 저장한 뒤 PWA standalone에서 테스트 버튼 노출 확인
- [ ] 테스트 알림 클릭 시 `/app/home?source=push&type=test` 이동 또는 기존 앱 focus 확인
- [ ] daily reminder 수동 호출 명령의 placeholder가 실제 운영 secret으로 로컬에서만 치환 가능한지 확인
- [ ] 운영 중 secret 값을 Slack, 문서, GitHub comment에 남기지 않도록 확인

## 파일럿 진행 중 1일 2회 확인 체크리스트

### 오전 확인

- [ ] 신규 사용자 `push_subscriptions` row 생성 여부 확인
- [ ] `push_subscriptions.is_active=false` 또는 `failure_count` 급증 여부 확인
- [ ] `session_program_progress` 생성자 수 확인
- [ ] 첫 세션 완료자 수 확인
- [ ] PWA 설치 또는 알림 권한 관련 사용자 문의가 반복되는지 확인
- [ ] 인앱 브라우저에서 설치가 막히는 사례가 있는지 확인

### KST 20:00 전후 확인

- [ ] Vercel Cron Job이 `/api/cron/send-session-reminders`를 실행했는지 확인
- [ ] `notification_deliveries`에 오늘 `daily_session` row가 생성되었는지 확인
- [ ] `status='sent'`, `status='failed'`, `status='skipped'` 집계 확인
- [ ] `skipped`가 중복 호출 또는 이미 예약된 사용자 때문에 증가했는지 확인
- [ ] 같은 `user_id + notification_type + local_date` 중복 row가 없는지 확인
- [ ] 알림 클릭 유입 URL이 `/app/home?source=push&type=daily_session`인지 실기기에서 확인
- [ ] 오늘 이미 세션을 완료한 사용자가 daily reminder 대상에서 제외되었는지 샘플 확인

## 파일럿 종료 후 체크리스트

- [ ] `notification_deliveries` 전체 sent/failed/skipped 집계 확인
- [ ] `push_subscriptions` dead subscription 후보 정리 여부 확인
- [ ] 첫 세션 완료율과 최근 7일 세션 완료자 수 확인
- [ ] Android와 iOS에서 발생한 설치/알림 이슈를 분리해 기록
- [ ] daily reminder 중복 발송 사례가 없었는지 확인
- [ ] 알림 클릭 후 앱 진입 실패 사례가 있었는지 확인
- [ ] 파일럿 중 수동으로 호출한 cron 횟수와 시간을 기록
- [ ] 다음 PR로 넘길 항목을 기능, 운영, 데이터 품질로 분류

