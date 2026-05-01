create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  notification_type text not null,
  local_date date not null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  clicked_at timestamptz,
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_deliveries_user_type_date_key
  on public.notification_deliveries (user_id, notification_type, local_date);

create index if not exists notification_deliveries_user_id_idx
  on public.notification_deliveries (user_id);

create index if not exists notification_deliveries_type_date_idx
  on public.notification_deliveries (notification_type, local_date);

create index if not exists notification_deliveries_status_idx
  on public.notification_deliveries (status);

create index if not exists notification_deliveries_created_at_idx
  on public.notification_deliveries (created_at);

create or replace function public.update_notification_deliveries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_deliveries_updated_at on public.notification_deliveries;
create trigger trg_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function public.update_notification_deliveries_updated_at();

alter table public.notification_deliveries enable row level security;

-- server route(service role) only. No broad client access policy.
drop policy if exists "notification_deliveries_service_role_all" on public.notification_deliveries;
create policy "notification_deliveries_service_role_all"
  on public.notification_deliveries
  for all
  to service_role
  using (true)
  with check (true);
