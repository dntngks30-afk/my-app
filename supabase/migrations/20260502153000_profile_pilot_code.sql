-- KPI pilot attribution for profile rows.

alter table public.public_test_profiles
  add column if not exists pilot_code text null;

create index if not exists public_test_profiles_pilot_code_idx
  on public.public_test_profiles (pilot_code);

create table if not exists public.signup_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  birth_date date not null,
  signup_age_band text not null default 'unknown',
  acquisition_source text not null default 'unknown',

  source text not null default 'signup_profile',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint signup_profiles_user_id_unique unique (user_id),

  constraint signup_profiles_age_band_check
    check (signup_age_band in ('10s', '20s', '30s', '40s', '50s', '60s_plus', 'unknown')),

  constraint signup_profiles_acquisition_source_check
    check (
      acquisition_source in (
        'instagram',
        'search',
        'referral',
        'threads',
        'youtube',
        'other',
        'unknown'
      )
    )
);

create index if not exists signup_profiles_created_at_idx
  on public.signup_profiles (created_at);

alter table public.signup_profiles enable row level security;

alter table public.signup_profiles
  add column if not exists pilot_code text null;

create index if not exists signup_profiles_pilot_code_idx
  on public.signup_profiles (pilot_code);
