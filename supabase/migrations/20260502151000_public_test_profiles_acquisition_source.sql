-- KPI demographic: acquisition channel for free_test_intro profiles only (aggregate joins filter source).

alter table public.public_test_profiles
  add column if not exists acquisition_source text not null default 'unknown';

alter table public.public_test_profiles
  drop constraint if exists public_test_profiles_acquisition_source_check;

alter table public.public_test_profiles
  add constraint public_test_profiles_acquisition_source_check
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
    );

create index if not exists public_test_profiles_source_idx
  on public.public_test_profiles (source);
