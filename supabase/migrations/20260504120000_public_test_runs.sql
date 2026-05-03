-- PR-KPI-PUBLIC-TEST-RUNS-03A — Immutable public funnel run backbone for pilot KPI.
-- Server/service-role writes only (no anon-facing RLS policies in this migration).
-- Does not replace analytics_events or public_test_profiles.

create table if not exists public.public_test_runs (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  pilot_code text null,
  source text not null default 'public_funnel',
  entry_path text null,
  entry_referrer text null,
  started_at timestamptz not null default now(),
  cta_clicked_at timestamptz null,
  survey_started_at timestamptz null,
  survey_completed_at timestamptz null,
  refine_choice text null,
  camera_started_at timestamptz null,
  camera_completed_at timestamptz null,
  result_viewed_at timestamptz null,
  result_stage text null,
  public_result_id uuid null references public.public_results(id) on delete set null,
  execution_cta_clicked_at timestamptz null,
  claimed_at timestamptz null,
  user_id uuid null references auth.users(id) on delete set null,
  auth_success_at timestamptz null,
  checkout_success_at timestamptz null,
  onboarding_completed_at timestamptz null,
  session_create_success_at timestamptz null,
  first_app_home_viewed_at timestamptz null,
  first_session_complete_success_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_test_runs_anon_id_not_blank check (length(trim(anon_id)) > 0),
  constraint public_test_runs_pilot_code_safe check (
    pilot_code is null
    or (
      length(pilot_code) between 1 and 64
      and pilot_code ~ '^[A-Za-z0-9._-]+$'
    )
  ),
  constraint public_test_runs_source_safe check (
    source in ('public_funnel')
  ),
  constraint public_test_runs_refine_choice_safe check (
    refine_choice is null
    or refine_choice in ('baseline', 'camera')
  ),
  constraint public_test_runs_result_stage_safe check (
    result_stage is null
    or result_stage in ('baseline', 'refined')
  )
);

create index if not exists public_test_runs_pilot_started_idx
  on public.public_test_runs (pilot_code, started_at desc)
  where pilot_code is not null;

create index if not exists public_test_runs_anon_started_idx
  on public.public_test_runs (anon_id, started_at desc);

create index if not exists public_test_runs_public_result_idx
  on public.public_test_runs (public_result_id)
  where public_result_id is not null;

create index if not exists public_test_runs_user_started_idx
  on public.public_test_runs (user_id, started_at desc)
  where user_id is not null;

create index if not exists public_test_runs_created_idx
  on public.public_test_runs (created_at desc);

create or replace function public.public_test_runs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists public_test_runs_set_updated_at on public.public_test_runs;
create trigger public_test_runs_set_updated_at
  before update on public.public_test_runs
  for each row
  execute function public.public_test_runs_set_updated_at();

alter table public.public_test_runs enable row level security;

comment on table public.public_test_runs is
  'Immutable public analysis run records for pilot KPI attribution. One row represents one public funnel attempt.';

comment on column public.public_test_runs.id is
  'Client-generated or server-generated UUID for a single public test run.';

comment on column public.public_test_runs.anon_id is
  'Anonymous browser identifier. Not PII.';

comment on column public.public_test_runs.pilot_code is
  'Sanitized pilot code captured at run start.';
