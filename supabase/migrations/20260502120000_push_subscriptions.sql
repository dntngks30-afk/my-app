create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text not null default 'other',
  user_agent text,
  timezone text,
  installed boolean not null default false,
  is_active boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id)
  where is_active = true;

create index if not exists push_subscriptions_platform_idx
  on public.push_subscriptions (platform);

alter table public.push_subscriptions enable row level security;

-- server route(service role) 전용. broad client 정책 금지.
drop policy if exists "push_subscriptions_service_role_all" on public.push_subscriptions;
create policy "push_subscriptions_service_role_all"
  on public.push_subscriptions
  for all
  to service_role
  using (true)
  with check (true);
