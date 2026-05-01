# 파일럿 장애 복구 플레이북

이 문서는 파일럿 중 문제가 생겼을 때 운영자가 빠르게 확인하고 복구하기 위한 절차입니다. 기능을 새로 구현하지 않고, 현재 Production과 Supabase 상태를 확인하는 데 집중합니다.

## A. PWA 설치 카드가 안 보임

### 증상

사용자가 `/app/home`에 들어왔지만 PWA 설치 카드가 보이지 않습니다.

### 1차 확인

- PWA standalone으로 이미 실행 중인지 확인합니다.
- 사용자가 Android Chrome, Samsung Internet, iOS Safari 중 어디에서 보고 있는지 확인합니다.
- 카카오, 인스타그램, 네이버 등 인앱 브라우저에서 열고 있는지 확인합니다.
- 설치 카드 dismiss 상태가 브라우저 storage에 남아 있는지 확인합니다.
- 사용자가 이미 홈 화면 앱을 설치했는지 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```sql
select
  user_id,
  platform,
  installed,
  is_active,
  updated_at
from public.push_subscriptions
order by updated_at desc
limit 20;
```

### 복구 방법

- standalone이면 설치 카드가 숨겨지는 것이 정상이라고 안내합니다.
- 인앱 브라우저이면 외부 Chrome 또는 Safari로 열도록 안내합니다.
- 이미 설치된 사용자는 홈 화면 앱 아이콘으로 실행하도록 안내합니다.
- dismiss 상태가 의심되면 브라우저 저장소를 정리하거나 다른 브라우저에서 재확인합니다.

### 다음 PR로 미룰 것

- 설치 카드 노출 정책 변경
- dismiss TTL UI 추가
- 인앱 브라우저 자동 감지 UX 강화

## B. PWA 설치가 안 됨

### 증상

사용자가 PWA를 홈 화면에 추가할 수 없거나 설치 버튼을 찾지 못합니다.

### 1차 확인

- Android는 Chrome 또는 Samsung Internet을 사용 중인지 확인합니다.
- iOS는 Safari를 사용 중인지 확인합니다.
- 인앱 브라우저에서 열고 있지 않은지 확인합니다.
- iOS에서는 native install prompt가 뜨지 않는다는 점을 안내합니다.
- Android에서 설치 프롬프트가 없으면 브라우저 메뉴의 설치 또는 홈 화면 추가 메뉴를 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```bash
curl -i https://YOUR_DOMAIN/manifest.webmanifest
```

```bash
curl -i https://YOUR_DOMAIN/sw.js
```

### 복구 방법

- 인앱 브라우저라면 링크 복사 후 외부 브라우저에서 열도록 안내합니다.
- iOS 사용자는 Safari 공유 버튼에서 "홈 화면에 추가"를 선택하도록 안내합니다.
- Android 사용자는 Chrome 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 선택하도록 안내합니다.
- 설치 후에는 브라우저 탭이 아니라 홈 화면 앱 아이콘으로 진입하게 안내합니다.

### 다음 PR로 미룰 것

- 브라우저별 설치 안내 문구 개선
- 링크 복사 fallback 강화
- 설치 상태 진단 UI 추가

## C. 알림 권한 카드가 안 보임

### 증상

PWA에서 알림을 켜야 하는데 알림 권한 카드가 보이지 않습니다.

### 1차 확인

- PWA standalone 상태인지 확인합니다.
- 현재 브라우저가 `Notification`과 `PushManager`를 지원하는지 확인합니다.
- 이미 `Notification.permission === "granted"`이고 subscription이 저장된 상태인지 확인합니다.
- `Notification.permission === "denied"`인지 확인합니다.
- Safari 또는 Chrome 일반 탭에서 보고 있는지 확인합니다. 일반 탭에서 미노출은 정상입니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```sql
select
  user_id,
  platform,
  installed,
  is_active,
  last_success_at,
  last_failure_at,
  failure_count,
  updated_at
from public.push_subscriptions
order by updated_at desc
limit 20;
```

### 복구 방법

- 일반 탭이면 홈 화면 앱 아이콘으로 PWA standalone을 실행하게 안내합니다.
- 이미 granted/subscribed이면 카드가 숨겨질 수 있으므로 테스트 알림으로 확인합니다.
- denied이면 OS 또는 브라우저 설정에서 알림 권한을 직접 변경하도록 안내합니다.
- 지원하지 않는 브라우저이면 Android Chrome 또는 iOS Safari 홈 화면 PWA로 다시 진행합니다.

### 다음 PR로 미룰 것

- denied 상태 복구 안내 UI
- 브라우저 지원 상태 진단 UI

## D. 알림 권한을 눌러도 구독 row가 안 생김

### 증상

"알림 켜기"를 눌렀고 권한도 허용했지만 `public.push_subscriptions`에 row가 없습니다.

### 1차 확인

- `/api/push/vapid-public-key`가 `ok:true`를 반환하는지 확인합니다.
- Vercel env에 `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_CONTACT_EMAIL`이 있는지 확인합니다.
- 사용자가 로그인 상태인지 확인합니다.
- `/api/push/subscribe` response가 성공인지 확인합니다.
- capability 값인 endpoint, p256dh, auth를 로그에 남기지 않았는지 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```bash
curl -i https://YOUR_DOMAIN/api/push/vapid-public-key
```

```sql
select
  user_id,
  platform,
  installed,
  is_active,
  created_at,
  updated_at
from public.push_subscriptions
order by created_at desc
limit 20;
```

### 복구 방법

- VAPID public key endpoint가 실패하면 Vercel env와 배포 상태를 먼저 복구합니다.
- 로그인 세션이 없으면 다시 로그인 후 PWA standalone에서 권한을 요청합니다.
- 권한이 granted인데 row가 없으면 PWA를 완전히 종료 후 재실행하고 다시 시도합니다.
- 계속 실패하면 브라우저와 OS 알림 설정을 확인하고, 필요 시 PWA 재설치를 안내합니다.

### 다음 PR로 미룰 것

- 구독 저장 실패 원인별 사용자 안내
- subscribe API 운영 로그 개선

## E. 테스트 알림이 안 옴

### 증상

"테스트 알림 보내기"를 눌렀지만 기기에 알림이 도착하지 않습니다.

### 1차 확인

- `public.push_subscriptions.is_active = true`인지 확인합니다.
- Vercel env의 `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_CONTACT_EMAIL`을 확인합니다.
- OS 알림 차단 상태를 확인합니다.
- PWA가 최신 service worker를 반영했는지 확인합니다.
- PWA 재실행 또는 재설치 후 다시 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```sql
select
  user_id,
  platform,
  installed,
  is_active,
  last_success_at,
  last_failure_at,
  failure_count,
  updated_at
from public.push_subscriptions
order by updated_at desc
limit 20;
```

### 복구 방법

- `is_active=false`이면 알림 권한과 subscription 저장부터 다시 진행합니다.
- failure_count가 증가하면 OS 알림 차단, VAPID env, PWA 재설치를 순서대로 확인합니다.
- service worker 반영이 의심되면 PWA를 종료하고 다시 실행합니다.
- 테스트 버튼은 `/app/home?debugPush=1`로 flag를 저장한 뒤 PWA standalone에서 확인합니다.

### 다음 PR로 미룰 것

- 테스트 알림 실패 원인 세분화 UI
- 운영자용 push 진단 화면

## F. daily reminder가 안 옴

### 증상

KST 20:00 전후 또는 수동 cron 호출 후 daily_session 알림이 오지 않습니다.

### 1차 확인

- `CRON_SECRET`이 Vercel Production에 있는지 확인합니다.
- Vercel Cron Jobs에서 `/api/cron/send-session-reminders` 실행 여부를 확인합니다.
- `public.notification_deliveries`에 오늘 row가 생성되었는지 확인합니다.
- 사용자가 오늘 이미 세션을 완료해 제외되었는지 확인합니다.
- 이미 pending, sent, failed, skipped row가 있어 중복 방지로 skipped 되었는지 확인합니다.
- KST `local_date`가 오늘인지 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```sql
with today as (
  select (now() at time zone 'Asia/Seoul')::date as kst_date
)
select
  nd.local_date,
  nd.status,
  count(*) as count
from public.notification_deliveries nd
join today on nd.local_date = today.kst_date
where nd.notification_type = 'daily_session'
group by nd.local_date, nd.status
order by nd.status;
```

```sql
with today as (
  select ((now() at time zone 'Asia/Seoul')::date)::text as kst_day_key
)
select
  spp.user_id,
  spp.total_sessions,
  spp.completed_sessions,
  spp.last_completed_day_key,
  case
    when spp.last_completed_day_key::text = today.kst_day_key then true
    else false
  end as today_completed
from public.session_program_progress spp
cross join today
order by spp.updated_at desc
limit 50;
```

### 복구 방법

- cron auth 실패면 `CRON_SECRET`과 Authorization header를 맞춥니다.
- Vercel Cron 미실행이면 Vercel Cron Jobs 설정과 배포 상태를 확인합니다.
- 대상자가 없으면 `considered`, `eligible`, `skipped` 응답 count를 기준으로 정상 여부를 판단합니다.
- 이미 오늘 row가 있으면 중복 발송하지 않는 것이 정상입니다.
- 수동 QA가 필요하면 운영자 로컬에서 Bearer secret으로 GET 호출합니다.

### 다음 PR로 미룰 것

- 사용자별 알림 시간
- notification preference
- 운영 대시보드

## G. 알림이 중복으로 옴

### 증상

같은 사용자가 같은 날 같은 daily_session 알림을 두 번 이상 받았다고 보고합니다.

### 1차 확인

- `notification_deliveries` unique 제약이 적용되어 있는지 확인합니다.
- 같은 `user_id + notification_type + local_date` 중복 row가 있는지 확인합니다.
- 운영자가 cron endpoint를 수동으로 여러 번 호출했는지 확인합니다.
- pending, sent, skipped 처리 순서를 확인합니다.
- 사용자가 여러 기기를 가지고 있어 각 기기에서 받은 것인지 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```sql
select
  user_id,
  notification_type,
  local_date,
  count(*) as delivery_count
from public.notification_deliveries
group by user_id, notification_type, local_date
having count(*) > 1
order by local_date desc, delivery_count desc;
```

```sql
select
  user_id,
  notification_type,
  local_date,
  status,
  metadata,
  created_at,
  updated_at
from public.notification_deliveries
where notification_type = 'daily_session'
order by created_at desc
limit 50;
```

### 복구 방법

- 중복 row가 없고 사용자가 여러 기기를 가지고 있다면 multi-subscription 발송 정책을 설명합니다.
- 중복 row가 있으면 migration 적용 상태와 unique 제약을 즉시 확인합니다.
- 수동 cron 호출이 원인이면 호출 시간을 기록하고 추가 호출을 중단합니다.

### 다음 PR로 미룰 것

- 기기별 알림 수 제한 정책
- 사용자별 기기 관리 UI

## H. 알림 클릭해도 앱으로 안 감

### 증상

알림은 도착하지만 클릭해도 앱이 열리지 않거나 `/app/home?source=push&type=...`로 이동하지 않습니다.

### 1차 확인

- 최신 service worker가 반영되었는지 확인합니다.
- PWA를 완전히 종료한 뒤 다시 실행해 확인합니다.
- 테스트 알림은 `/app/home?source=push&type=test`로 이동해야 합니다.
- daily_session 알림은 `/app/home?source=push&type=daily_session`로 이동해야 합니다.
- OS에서 알림 클릭 동작이 제한되어 있지 않은지 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```bash
curl -i https://YOUR_DOMAIN/sw.js
```

```sql
select
  user_id,
  notification_type,
  local_date,
  status,
  sent_at,
  metadata,
  updated_at
from public.notification_deliveries
order by updated_at desc
limit 20;
```

### 복구 방법

- PWA를 종료 후 재실행합니다.
- 계속 실패하면 홈 화면 앱을 제거 후 다시 설치합니다.
- Android와 iOS를 분리해 기록합니다.
- service worker generated 파일은 직접 수정하지 않습니다.

### 다음 PR로 미룰 것

- 알림 click tracking
- OS별 클릭 실패 진단 로그

## I. 세션맵이 안 뜸

### 증상

`/app/home`에 진입했지만 리셋맵 또는 세션 진행 상태가 보이지 않습니다.

### 1차 확인

- `public.session_program_progress` row가 있는지 확인합니다.
- `public.session_user_profile.onboarding_completed_at`이 있는지 확인합니다.
- 사용자의 `public.users.plan_status`가 실행 가능한 상태인지 확인합니다.
- session create가 완료되었는지 확인합니다.
- readiness 상태가 온보딩, 결제, 결과, 세션 생성 중 어디로 보내는지 확인합니다.

### Supabase/Vercel 확인 쿼리 또는 위치

```sql
select
  user_id,
  total_sessions,
  completed_sessions,
  active_session_number,
  last_completed_day_key,
  updated_at
from public.session_program_progress
order by updated_at desc
limit 50;
```

```sql
select
  user_id,
  target_frequency,
  onboarding_completed_at,
  created_at
from public.session_user_profile
order by created_at desc
limit 50;
```

```sql
select
  id,
  plan_status,
  plan_tier,
  updated_at
from public.users
order by updated_at desc
limit 50;
```

### 복구 방법

- session progress가 없으면 사용자가 세션 생성 흐름을 완료했는지 확인합니다.
- 온보딩 완료 marker가 없으면 `/onboarding` 흐름을 완료하도록 안내합니다.
- plan_status가 inactive이면 파일럿 코드 또는 결제 unlock 상태를 확인합니다.
- 세션 생성 실패가 의심되면 `/app/home`에서 readiness가 안내하는 다음 행동을 따릅니다.

### 다음 PR로 미룰 것

- 운영자용 사용자 상태 조회 화면
- readiness 상태별 상세 복구 CTA
- 세션 생성 실패 자동 복구

