/**
 * PR-RESET-02: Reset Map Idempotency acceptance tests
 * Run: npx tsx scripts/reset-map-idempotency-acceptance.mjs
 *
 * Unit tests (no env): fingerprint, normalizeBody
 * API tests (requires): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   TEST_BEARER_TOKEN (valid user JWT), BASE_URL (e.g. http://localhost:3000)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function run() {
  console.log('PR-RESET-02: Reset Map Idempotency acceptance\n');

  // ─── Unit: fingerprint ─────────────────────────────────────────────────
  console.log('Unit: fingerprint');
  const fp = await import('../src/lib/idempotency/fingerprint.ts');
  const h1 = fp.buildFingerprintHash({
    method: 'POST',
    routeKey: 'reset-map:start',
    payload: { session_id: null, variant_tag: 'a' },
    userId: 'u1',
  });
  const h2 = fp.buildFingerprintHash({
    method: 'POST',
    routeKey: 'reset-map:start',
    payload: { session_id: null, variant_tag: 'a' },
    userId: 'u1',
  });
  ok('AT4: same payload → same hash', h1 === h2);

  const h3 = fp.buildFingerprintHash({
    method: 'POST',
    routeKey: 'reset-map:start',
    payload: { session_id: null, variant_tag: 'b' },
    userId: 'u1',
  });
  ok('AT4: different payload → different hash', h1 !== h3);

  const norm1 = fp.normalizeBody({ b: 2, a: 1 });
  const norm2 = fp.normalizeBody({ a: 1, b: 2 });
  ok('normalizeBody deterministic', norm1 === norm2);

  // ─── API tests (require env) ───────────────────────────────────────────
  const baseUrl = process.env.BASE_URL;
  const token = process.env.TEST_BEARER_TOKEN;
  const hasEnv = baseUrl && token && process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http');

  if (!hasEnv) {
    console.log('\nAPI tests SKIP: set BASE_URL, TEST_BEARER_TOKEN, Supabase env. Run: npm run dev');
    console.log(`\n${passed} passed, ${failed} failed (unit only)`);
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  console.log('\nAPI: reset-map/start');
  const key1 = `acceptance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body1 = JSON.stringify({ variant_tag: 'acceptance' });
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': key1,
    Authorization: `Bearer ${token}`,
  };

  const r1 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers,
    body: body1,
  });
  ok('AT1: first start with key creates flow', r1.status === 200);
  const d1 = await r1.json();
  ok('AT1: response ok and data', d1.ok === true && d1.data?.flow_id);

  const r2 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers,
    body: body1,
  });
  ok('AT2: repeated identical start returns same success', r2.status === 200);
  const d2 = await r2.json();
  ok('AT2: same flow id on replay', d2.ok === true && d2.data?.flow_id === d1.data?.flow_id);

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: flowRow } = await supabaseAdmin
    .from('reset_map_flow')
    .select('user_id')
    .eq('id', d1.data?.flow_id)
    .single();
  const { data: countRows } = await supabaseAdmin
    .from('reset_map_flow')
    .select('id')
    .eq('user_id', flowRow?.user_id)
    .in('state', ['started', 'preview_ready']);
  ok('AT1: exactly one active flow (no duplicates)', (countRows?.length ?? 0) === 1);

  const keyDiff = `${key1}-diff-payload`;
  const r3 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: {
      ...headers,
      'Idempotency-Key': keyDiff,
    },
    body: body1,
  });
  await r3.json();
  const r4 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: {
      ...headers,
      'Idempotency-Key': keyDiff,
    },
    body: JSON.stringify({ variant_tag: 'other' }),
  });
  ok('AT4: same key different payload → 409', r4.status === 409);
  const d4 = await r4.json();
  ok('AT4: IDEMPOTENCY_KEY_REUSED', d4.ok === false && d4.error?.code === 'IDEMPOTENCY_KEY_REUSED');

  const r5 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body1,
  });
  ok('AT5: missing Idempotency-Key → 400', r5.status === 400);
  const d5 = await r5.json();
  ok('AT5: IDEMPOTENCY_KEY_REQUIRED', d5.ok === false && d5.error?.code === 'IDEMPOTENCY_KEY_REQUIRED');

  const flowId = d1.data?.flow_id;
  const prevRes = await fetch(`${baseUrl}/api/reset-map/${flowId}/preview-result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      permission_state: 'granted',
      tracking_conf: 0.5,
      landmark_coverage: 0.6,
    }),
  });
  ok('preview before apply', prevRes.status === 200);
  const prevData = await prevRes.json();
  ok('preview proceed', prevData.ok && prevData.data?.proceed === true);

  const applyKey = `acceptance-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r6 = await fetch(`${baseUrl}/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': applyKey,
      Authorization: `Bearer ${token}`,
    },
  });
  ok('AT3: apply with key succeeds', r6.status === 200);

  const r7 = await fetch(`${baseUrl}/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': applyKey,
      Authorization: `Bearer ${token}`,
    },
  });
  ok('AT3: repeated apply replays safely', r7.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
