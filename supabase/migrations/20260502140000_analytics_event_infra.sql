-- PR-1 Analytics Event Infra
-- Raw KPI event store + anon/user identity link.
-- Observer layer only: no product state, no direct client table access.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid null,
  dedupe_key text null,
  event_name text not null,
  event_version integer not null default 1,
  source text not null check (source in ('client', 'server')),
  anon_id text null,
  user_id uuid null references auth.users(id) on delete set null,
  public_result_id uuid null references public.public_results(id) on delete set null,
  session_plan_id uuid null,
  session_number integer null,
  routine_id uuid null,
  reset_map_flow_id uuid null,
  route_path text null,
  route_group text null,
  client_ts timestamptz null,
  created_at timestamptz not null default now(),
  kst_day date not null default ((now() at time zone 'Asia/Seoul')::date),
  props jsonb not null default '{}'::jsonb,
  user_agent text null,
  referrer text null
);

create unique index if not exists analytics_events_event_id_key
  on public.analytics_events(event_id)
  where event_id is not null;

create unique index if not exists analytics_events_dedupe_key_key
  on public.analytics_events(dedupe_key)
  where dedupe_key is not null;

create index if not exists analytics_events_name_created_idx
  on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_kst_day_name_idx
  on public.analytics_events(kst_day, event_name);

create index if not exists analytics_events_anon_created_idx
  on public.analytics_events(anon_id, created_at desc)
  where anon_id is not null;

create index if not exists analytics_events_user_created_idx
  on public.analytics_events(user_id, created_at desc)
  where user_id is not null;

create index if not exists analytics_events_public_result_idx
  on public.analytics_events(public_result_id)
  where public_result_id is not null;

create index if not exists analytics_events_session_plan_idx
  on public.analytics_events(session_plan_id)
  where session_plan_id is not null;

create index if not exists analytics_events_reset_map_flow_idx
  on public.analytics_events(reset_map_flow_id)
  where reset_map_flow_id is not null;

alter table public.analytics_events enable row level security;

comment on table public.analytics_events is
  'PR-1 Analytics Event Infra: raw observer events for KPI dashboard. Service-role API only.';
comment on column public.analytics_events.props is
  'Small sanitized metadata only. No raw camera traces, raw scoring, Stripe objects, email, or exercise log bodies.';

create table if not exists public.analytics_identity_links (
  anon_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source text not null default 'track_endpoint',
  primary key (anon_id, user_id)
);

create index if not exists analytics_identity_links_user_idx
  on public.analytics_identity_links(user_id);

create index if not exists analytics_identity_links_anon_idx
  on public.analytics_identity_links(anon_id);

alter table public.analytics_identity_links enable row level security;

comment on table public.analytics_identity_links is
  'PR-1 Analytics Event Infra: anon_id to user_id link for funnel continuity, not BI aggregation.';
