# Supabase 모니터링 쿼리

파일럿 운영 중 Supabase SQL Editor에서 바로 복사해 사용할 수 있는 쿼리입니다. 실제 secret, endpoint 전체 값, `p256dh`, `auth`는 조회하거나 공유하지 않습니다.

KST 오늘 기준은 코드의 `getKstDayKeyUTC()`와 맞춥니다. SQL에서는 아래 형태를 사용합니다.

```sql
select ((now() at time zone 'Asia/Seoul')::date)::text as kst_day_key;
```

## A. push_subscriptions 최근 상태

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
limit 50;
```

## B. notification_deliveries 최근 로그

```sql
select
  user_id,
  notification_type,
  local_date,
  status,
  sent_at,
  error_code,
  metadata,
  created_at,
  updated_at
from public.notification_deliveries
order by created_at desc
limit 50;
```

## C. 오늘 daily_session 발송 집계

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
order by nd.local_date desc, nd.status;
```

## D. 중복 발송 감지

`public.notification_deliveries`는 `user_id + notification_type + local_date` 기준 unique 제약이 있어야 합니다. 아래 쿼리는 이상 징후 확인용입니다.

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

## E. dead subscription 후보

```sql
select
  user_id,
  platform,
  installed,
  is_active,
  last_failure_at,
  failure_count,
  updated_at
from public.push_subscriptions
where is_active = false
   or failure_count >= 3
order by last_failure_at desc nulls last, failure_count desc
limit 50;
```

## F. 오늘 세션 완료 여부 확인

오늘 완료 여부의 canonical 기준은 `public.session_program_progress.last_completed_day_key`입니다.

```sql
with today as (
  select ((now() at time zone 'Asia/Seoul')::date)::text as kst_day_key
)
select
  spp.user_id,
  spp.total_sessions,
  spp.completed_sessions,
  spp.last_completed_day_key,
  spp.updated_at,
  case
    when spp.last_completed_day_key::text = today.kst_day_key then true
    else false
  end as today_completed
from public.session_program_progress spp
cross join today
order by spp.updated_at desc
limit 100;
```

## G. 오늘 미완료 + active subscription 후보 확인

Daily reminder 대상 후보는 active subscription이 있고, 진행 중인 프로그램이 있으며, KST 오늘 세션을 아직 완료하지 않은 사용자입니다.

```sql
with today as (
  select ((now() at time zone 'Asia/Seoul')::date)::text as kst_day_key
),
active_push_users as (
  select
    user_id,
    count(*) as active_subscription_count
  from public.push_subscriptions
  where is_active = true
  group by user_id
)
select
  spp.user_id,
  apu.active_subscription_count,
  spp.total_sessions,
  spp.completed_sessions,
  spp.last_completed_day_key,
  spp.updated_at
from public.session_program_progress spp
join active_push_users apu on apu.user_id = spp.user_id
cross join today
where coalesce(spp.completed_sessions, 0) < coalesce(spp.total_sessions, 0)
  and (
    spp.last_completed_day_key is null
    or spp.last_completed_day_key::text <> today.kst_day_key
  )
order by spp.updated_at desc;
```

## H. 파일럿 핵심 퍼널 확인 쿼리

### 분석 완료자

```sql
select
  count(distinct user_id) as finalized_analysis_users
from public.deep_test_attempts
where status = 'final'
   or finalized_at is not null;
```

### 결제 또는 파일럿 실행 unlock 사용자

```sql
select
  plan_status,
  count(*) as user_count
from public.users
group by plan_status
order by user_count desc;
```

### 파일럿 코드 사용 사용자

```sql
select
  count(distinct user_id) as pilot_redeemed_users,
  count(*) as redemption_rows
from public.pilot_redemptions;
```

### 온보딩 완료자

```sql
select
  count(*) as onboarding_completed_users
from public.session_user_profile
where onboarding_completed_at is not null;
```

### session_program_progress 생성자

```sql
select
  count(*) as session_progress_users
from public.session_program_progress;
```

### 첫 세션 완료자

```sql
select
  count(distinct user_id) as first_session_completed_users
from public.session_plans
where session_number = 1
  and status = 'completed'
  and completed_at is not null;
```

### 최근 7일 세션 완료자

```sql
select
  (completed_at at time zone 'Asia/Seoul')::date as kst_date,
  count(*) as completed_sessions,
  count(distinct user_id) as completed_users
from public.session_plans
where status = 'completed'
  and completed_at >= now() - interval '7 days'
group by (completed_at at time zone 'Asia/Seoul')::date
order by kst_date desc;
```

## 운영자가 보면 안 되는 값

아래 값은 capability 또는 secret 성격이 있으므로 운영 공유 화면, 이슈, PR comment에 남기지 않습니다.

```txt
push_subscriptions.endpoint
push_subscriptions.p256dh
push_subscriptions.auth
WEB_PUSH_VAPID_PRIVATE_KEY
CRON_SECRET
```

