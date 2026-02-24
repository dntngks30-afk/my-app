-- admin_actions: 운영자 수동 변경 감사 로그
-- service_role로만 접근 (API에서 getServerSupabaseAdmin 사용)

create table if not exists public.admin_actions (
  id uuid default gen_random_uuid() primary key,
  actor_user_id uuid not null,
  actor_email text not null,
  target_user_id uuid not null,
  target_email text,
  action text not null,
  reason text not null,
  before jsonb not null,
  after jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_target_created
  on public.admin_actions (target_user_id, created_at desc);

create index if not exists idx_admin_actions_actor_created
  on public.admin_actions (actor_user_id, created_at desc);

alter table public.admin_actions enable row level security;

-- service_role만 insert/select 가능
create policy "service_role_insert_admin_actions"
  on public.admin_actions
  for insert
  to service_role
  with check (true);

create policy "service_role_select_admin_actions"
  on public.admin_actions
  for select
  to service_role
  using (true);
