# Push Notification QA

이 문서는 알림 권한, push subscription 저장, 테스트 알림, daily reminder를 실기기에서 확인하기 위한 절차입니다. secret 값은 절대 문서, 채팅, PR comment에 남기지 않습니다.

## 공통 전제

- [ ] PWA standalone에서 확인합니다.
- [ ] Safari 또는 Chrome 일반 탭에서는 push permission card가 노출되지 않는 것이 정상입니다.
- [ ] `Notification.requestPermission()` 팝업은 사용자가 "알림 켜기" 버튼을 클릭하기 전에는 뜨면 안 됩니다.
- [ ] 권한이 `denied`인 상태에서는 권한 요청을 반복하지 않습니다. 사용자가 OS 또는 브라우저 설정에서 직접 변경해야 합니다.
- [ ] capability 값인 `endpoint`, `p256dh`, `auth`는 로그나 문서에 남기지 않습니다.

## VAPID public key 확인

Production URL을 사용해 아래 endpoint가 정상인지 확인합니다.

```bash
curl -i https://YOUR_DOMAIN/api/push/vapid-public-key
```

기대 결과:

```txt
HTTP 200
{ "ok": true, "publicKey": "..." }
```

## 알림 권한과 구독 저장 QA

### Android

- [ ] Chrome에서 PWA 설치
- [ ] 홈 화면 앱 아이콘으로 PWA standalone 실행
- [ ] `/app/home` 진입
- [ ] 알림 권한 카드가 보이는지 확인
- [ ] 버튼 클릭 전 권한 팝업이 자동으로 뜨지 않는지 확인
- [ ] "알림 켜기" 클릭
- [ ] OS 권한 팝업에서 허용
- [ ] `public.push_subscriptions`에 row가 생성되는지 확인
- [ ] `platform`, `installed`, `is_active`, `updated_at` 값을 확인

### iOS

- [ ] Safari에서 홈 화면에 추가
- [ ] 홈 화면 앱 아이콘으로 PWA standalone 실행
- [ ] `/app/home` 진입
- [ ] 알림 권한 카드가 보이는지 확인
- [ ] 버튼 클릭 전 권한 팝업이 자동으로 뜨지 않는지 확인
- [ ] "알림 켜기" 클릭
- [ ] OS 권한 팝업에서 허용
- [ ] `public.push_subscriptions`에 row가 생성되는지 확인
- [ ] Safari 일반 탭에서는 알림 카드가 보이지 않는지 확인

## 테스트 알림 QA

PWA standalone 앱에는 주소창이 없으므로, 먼저 일반 브라우저 탭에서 debug flag를 저장한 뒤 홈 화면 앱으로 돌아갑니다.

- [ ] Chrome 또는 Safari 일반 탭에서 `https://YOUR_DOMAIN/app/home?debugPush=1` 접속
- [ ] localStorage에 `move-re:debug-push = "1"` 저장 확인
- [ ] 홈 화면 앱 아이콘으로 PWA standalone 재실행
- [ ] 알림 권한이 `granted`인지 확인
- [ ] active `push_subscriptions` row가 있는지 확인
- [ ] "테스트 알림 보내기" 버튼이 노출되는지 확인
- [ ] "테스트 알림 보내기" 클릭
- [ ] 테스트 알림 수신 확인
- [ ] 알림 클릭
- [ ] `/app/home?source=push&type=test`로 이동하거나 기존 앱 창이 focus되는지 확인
- [ ] `push_subscriptions.last_success_at`이 업데이트되는지 확인

## Daily reminder 수동 호출 QA

`/api/cron/send-session-reminders`는 `CRON_SECRET` Bearer 인증이 필요합니다. 아래 명령은 로컬 터미널에서만 실행하고, 실제 secret 값을 기록하지 않습니다.

```powershell
$secret = "YOUR_CRON_SECRET"
$url = "https://YOUR_DOMAIN/api/cron/send-session-reminders"

Invoke-RestMethod `
  -Uri $url `
  -Method GET `
  -Headers @{ Authorization = "Bearer $secret" }
```

기대 응답:

```txt
ok: true
considered: active push subscription을 가진 distinct user 수
eligible: 오늘 미완료이며 진행 중 프로그램이 있는 user 수
sent: user-level sent 수
skipped: 이미 pending/sent/failed/skipped row가 있어 중복 발송하지 않은 user 수
failed: user-level failed 수
deactivated: 404/410으로 비활성화된 subscription 수
```

## Daily reminder 수신 QA

- [ ] 대상 사용자가 PWA standalone에서 알림 권한을 허용했는지 확인
- [ ] `public.push_subscriptions.is_active = true` row가 있는지 확인
- [ ] `public.session_program_progress` row가 있는지 확인
- [ ] `completed_sessions < total_sessions`인지 확인
- [ ] `last_completed_day_key`가 KST 오늘이 아닌지 확인
- [ ] 수동 cron 호출
- [ ] daily_session 알림 수신 확인
- [ ] 알림 클릭
- [ ] `/app/home?source=push&type=daily_session`로 이동하거나 기존 앱 창이 focus되는지 확인
- [ ] `public.notification_deliveries`에 `notification_type='daily_session'`, `status='sent'` row가 생성되는지 확인
- [ ] 같은 날짜에 다시 호출하면 중복 알림이 가지 않고 `skipped`가 증가하는지 확인

## 실패 응답 빠른 해석

```txt
UNAUTHORIZED: Authorization header 또는 access token 확인
MISSING_WEB_PUSH_ENV: WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, WEB_PUSH_CONTACT_EMAIL 확인
MISSING_CRON_SECRET: CRON_SECRET 확인
NO_ACTIVE_SUBSCRIPTION: 알림 권한 허용과 push_subscriptions 저장부터 다시 확인
```

