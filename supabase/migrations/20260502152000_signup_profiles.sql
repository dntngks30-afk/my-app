-- 회원가입 시점 KPI 프로필 (생년월일→연령대, 유입경로). 무료테스트 public_test_profiles 와 분리.

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

comment on table public.signup_profiles is
  'Pilot KPI: signup-time birth_date-derived age band + acquisition channel per user_id. Service-role writes only.';
