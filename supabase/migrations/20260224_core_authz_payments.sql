-- USERS TABLE
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'user',
  plan_status text default 'inactive',
  plan_tier text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PAYMENTS TABLE
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  provider text not null,
  provider_session_id text unique,
  product_id text,
  amount integer,
  currency text,
  status text,
  created_at timestamptz default now()
);

-- HANDLE NEW USER FUNCTION
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- BACKFILL EXISTING USERS
insert into public.users (id, email)
select id, email
from auth.users
where id not in (select id from public.users)
on conflict (id) do nothing;

-- ENABLE RLS
alter table public.users enable row level security;
alter table public.payments enable row level security;

-- USERS SELECT POLICY
drop policy if exists "users can read own data" on public.users;
create policy "users can read own data"
on public.users
for select
using (auth.uid() = id);

-- BLOCK SELF UPDATE
drop policy if exists "users cannot self update plan" on public.users;
create policy "users cannot self update plan"
on public.users
for update
using (false);

-- PAYMENTS SELECT POLICY
drop policy if exists "users can read own payments" on public.payments;
create policy "users can read own payments"
on public.payments
for select
using (auth.uid() = user_id);
