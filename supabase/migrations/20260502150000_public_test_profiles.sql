-- KPI pilot: intro age/gender buckets (latest row per anon_id).
-- MVP limitation: public_test_profiles is latest-profile-per-anon.
-- Suitable for pilot-level demographic funnel summary, not immutable historical snapshots across repeated tests.

create table if not exists public.public_test_profiles (
  id uuid primary key default gen_random_uuid(),

  anon_id text not null,
  public_result_id uuid null references public.public_results(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,

  age_band text not null default 'unknown',
  gender text not null default 'unknown',
  source text not null default 'free_test_intro',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint public_test_profiles_anon_id_unique unique (anon_id),

  constraint public_test_profiles_age_band_check
    check (age_band in ('10s', '20s', '30s', '40s', '50s', '60s_plus', 'unknown')),

  constraint public_test_profiles_gender_check
    check (gender in ('male', 'female', 'other', 'prefer_not_to_say', 'unknown'))
);

create index if not exists public_test_profiles_public_result_id_idx
  on public.public_test_profiles (public_result_id);

create index if not exists public_test_profiles_user_id_idx
  on public.public_test_profiles (user_id);

create index if not exists public_test_profiles_created_at_idx
  on public.public_test_profiles (created_at);

alter table public.public_test_profiles enable row level security;

comment on table public.public_test_profiles is
  'Pilot KPI: intro demographic buckets per anon_id. Server/service-role writes only; no per-user exposed rows in admin aggregate.';
