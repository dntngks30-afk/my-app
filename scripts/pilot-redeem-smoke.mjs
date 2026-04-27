#!/usr/bin/env node
/**
 * PR-PILOT-ENTITLEMENT-02 — Smoke / manual checklist helper
 *
 * Full E2E requires: migrated DB, NEXT_PUBLIC_SUPABASE_URL, valid user JWT, beta-001 seed.
 *
 * SQL-only checks (Supabase SQL editor):
 *
 * 1) Seed present:
 *    select * from public.pilot_access_codes where code = 'beta-001';
 *
 * 2) After one redeem (replace :uid):
 *    select plan_status from public.users where id = ':uid';
 *    select * from public.pilot_redemptions where user_id = ':uid';
 *    select redeemed_count from public.pilot_access_codes where code = 'beta-001';
 *
 * 3) Idempotency: call redeem twice for same user — second outcome already_redeemed;
 *    redeemed_count increments only once.
 *
 * 3b) After code is marked inactive or expired, same user who already redeemed still gets
 *     already_redeemed and plan_status can be repaired to active (no new redemption row).
 *
 * 4) Expiry: update pilot_access_codes set expires_at = now() - interval '1 day' where code = 'beta-001';
 *    redeem → expired; restore expires_at after test.
 *
 * 5) Limit: set max_redemptions = redeemed_count then new user redeem → limit_reached.
 *
 * API (with real Bearer):
 *   curl -sS -X POST "$ORIGIN/api/pilot/redeem" \
 *     -H "Authorization: Bearer $ACCESS_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"code":"beta-001"}'
 */

console.log(`[pilot-redeem-smoke] ${__filename}`);
console.log('[pilot-redeem-smoke] See header comments for manual SQL and curl steps.');
