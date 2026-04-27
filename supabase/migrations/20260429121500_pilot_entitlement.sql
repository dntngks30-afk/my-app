-- PR-PILOT-ENTITLEMENT-02 — Server-side pilot code redeem (atomic RPC)
-- Extends plan_status mutation paths: service_role via RPC (users RLS blocks client UPDATE).
-- Coupon-style codes (limited redemptions / expiry), not secrets.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.pilot_access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  is_active boolean not null default true,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_access_codes
  drop constraint if exists pilot_access_codes_max_redemptions_nonnegative;
alter table public.pilot_access_codes
  add constraint pilot_access_codes_max_redemptions_nonnegative
  check (max_redemptions is null or max_redemptions >= 0);

alter table public.pilot_access_codes
  drop constraint if exists pilot_access_codes_redeemed_count_nonnegative;
alter table public.pilot_access_codes
  add constraint pilot_access_codes_redeemed_count_nonnegative
  check (redeemed_count >= 0);

alter table public.pilot_access_codes
  drop constraint if exists pilot_access_codes_code_format;
alter table public.pilot_access_codes
  add constraint pilot_access_codes_code_format
  check (code = lower(code) and code ~ '^[a-z0-9._-]{1,64}$');

create table if not exists public.pilot_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  source text not null default 'pilot_redeem_v1',
  metadata jsonb not null default '{}'::jsonb,
  unique (code, user_id)
);

create index if not exists idx_pilot_redemptions_user_id
  on public.pilot_redemptions (user_id);

create index if not exists idx_pilot_redemptions_code
  on public.pilot_redemptions (code);

alter table public.pilot_access_codes enable row level security;
alter table public.pilot_redemptions enable row level security;

-- No anon/authenticated policies: server API uses service_role only.

-- ─── Seed (coupon, not secret) ───────────────────────────────────────────────

insert into public.pilot_access_codes (
  code,
  is_active,
  max_redemptions,
  expires_at,
  note
)
values (
  'beta-001',
  true,
  30,
  '2026-05-15 23:59:59+09',
  'First external pilot test'
)
on conflict (code) do nothing;

-- ─── RPC ───────────────────────────────────────────────────────────────────
-- Idempotency: existing (code, user_id) in pilot_redemptions returns already_redeemed
-- and may repair plan_status, without re-checking inactive/expired/limit.

create or replace function public.redeem_pilot_access(
  p_code text,
  p_user_id uuid,
  p_actor_email text,
  p_source text default 'pilot_redeem_v1',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_row public.pilot_access_codes%rowtype;
  v_user_id uuid;
  v_user_email text;
  v_before_status text;
  v_exists boolean;
  v_src text;
  v_meta jsonb;
begin
  v_norm := lower(trim(coalesce(p_code, '')));
  v_src := coalesce(nullif(trim(p_source), ''), 'pilot_redeem_v1');
  v_meta := coalesce(p_metadata, '{}'::jsonb);

  if v_norm = '' or length(v_norm) > 64 or v_norm !~ '^[a-z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'outcome', 'invalid_code');
  end if;

  select * into v_row
  from public.pilot_access_codes
  where code = v_norm
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'outcome', 'code_not_found');
  end if;

  select u.id, u.email, u.plan_status
  into v_user_id, v_user_email, v_before_status
  from public.users u
  where u.id = p_user_id
  for update;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'outcome', 'user_not_found');
  end if;

  v_before_status := coalesce(v_before_status, 'inactive');

  select exists (
    select 1
    from public.pilot_redemptions r
    where r.code = v_norm and r.user_id = p_user_id
  ) into v_exists;

  if v_exists then
    if v_before_status is distinct from 'active' then
      update public.users
      set plan_status = 'active', updated_at = now()
      where id = p_user_id;

      insert into public.admin_actions (
        actor_user_id,
        actor_email,
        target_user_id,
        target_email,
        action,
        reason,
        before,
        after
      ) values (
        p_user_id,
        coalesce(nullif(trim(p_actor_email), ''), ''),
        p_user_id,
        v_user_email,
        'pilot_redeem',
        'Pilot access redeemed',
        jsonb_build_object(
          'plan_status', v_before_status,
          'source', v_src,
          'pilot_code', v_norm
        ),
        jsonb_build_object(
          'plan_status', 'active',
          'source', v_src,
          'pilot_code', v_norm
        )
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'outcome', 'already_redeemed',
      'plan_status', 'active'
    );
  end if;

  if not v_row.is_active then
    return jsonb_build_object('ok', false, 'outcome', 'inactive');
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'outcome', 'expired');
  end if;

  if v_row.max_redemptions is not null and v_row.redeemed_count >= v_row.max_redemptions then
    return jsonb_build_object('ok', false, 'outcome', 'limit_reached');
  end if;

  insert into public.pilot_redemptions (code, user_id, source, metadata)
  values (v_norm, p_user_id, v_src, v_meta);

  update public.pilot_access_codes
  set
    redeemed_count = redeemed_count + 1,
    updated_at = now()
  where id = v_row.id;

  update public.users
  set plan_status = 'active', updated_at = now()
  where id = p_user_id;

  insert into public.admin_actions (
    actor_user_id,
    actor_email,
    target_user_id,
    target_email,
    action,
    reason,
    before,
    after
  ) values (
    p_user_id,
    coalesce(nullif(trim(p_actor_email), ''), ''),
    p_user_id,
    v_user_email,
    'pilot_redeem',
    'Pilot access redeemed',
    jsonb_build_object(
      'plan_status', v_before_status,
      'source', v_src,
      'pilot_code', v_norm
    ),
    jsonb_build_object(
      'plan_status', 'active',
      'source', v_src,
      'pilot_code', v_norm
    )
  );

  return jsonb_build_object(
    'ok', true,
    'outcome', 'redeemed',
    'plan_status', 'active'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'outcome', 'rpc_error');
end;
$$;

revoke all on function public.redeem_pilot_access(text, uuid, text, text, jsonb) from public;
revoke all on function public.redeem_pilot_access(text, uuid, text, text, jsonb) from anon;
revoke all on function public.redeem_pilot_access(text, uuid, text, text, jsonb) from authenticated;

grant execute on function public.redeem_pilot_access(text, uuid, text, text, jsonb) to service_role;

comment on function public.redeem_pilot_access(text, uuid, text, text, jsonb) is
  'PR-PILOT-ENTITLEMENT-02: atomic pilot code redeem; updates users.plan_status via service_role API only.';
