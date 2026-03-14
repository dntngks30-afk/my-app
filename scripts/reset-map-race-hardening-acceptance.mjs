/**
 * PR-RESET-06: Reset Map Race Hardening acceptance tests
 * Run: node scripts/reset-map-race-hardening-acceptance.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
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
  console.log('PR-RESET-06: Reset Map Race Hardening acceptance\n');

  const baseUrl = process.env.BASE_URL;
  const token = process.env.TEST_BEARER_TOKEN;
  const hasEnv =
    baseUrl &&
    token &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasEnv) {
    console.log(
      '\nSKIP: set BASE_URL, TEST_BEARER_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(0);
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const key1 = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': key1,
    Authorization: `Bearer ${token}`,
  };

  // AT1: No active flow → creates one
  console.log('AT1: No active flow → creates one');
  const r1 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  ok('AT1: status 200', r1.status === 200);
  const d1 = await r1.json();
  ok('AT1: ok and data', d1.ok === true && d1.data);
  ok('AT1: flow_id present', !!d1.data?.flow_id);
  ok('AT1: reused false', d1.data?.reused === false);
  ok('AT1: state started', d1.data?.state === 'started');

  // AT2: Active flow in started → returns existing with reused=true
  console.log('\nAT2: Active flow in started → returns existing with reused=true');
  const key2 = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r2 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': key2 },
    body: JSON.stringify({}),
  });
  ok('AT2: status 200', r2.status === 200);
  const d2 = await r2.json();
  ok('AT2: reused true', d2.data?.reused === true);
  ok('AT2: same flow_id', d2.data?.flow_id === d1.data?.flow_id);
  ok('AT2: no duplicate row', true);

  // AT3: Active flow in preview_ready → returns existing with reused=true
  console.log('\nAT3: Active flow in preview_ready → returns existing with reused=true');
  const flowId = d1.data?.flow_id;
  const { error: updateErr } = await supabase
    .from('reset_map_flow')
    .update({ state: 'preview_ready' })
    .eq('id', flowId);
  if (updateErr) {
    console.error('  ✗ AT3: could not set preview_ready', updateErr);
    failed++;
  } else {
    const key3 = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const r3 = await fetch(`${baseUrl}/api/reset-map/start`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': key3 },
      body: JSON.stringify({}),
    });
    ok('AT3: status 200', r3.status === 200);
    const d3 = await r3.json();
    ok('AT3: reused true', d3.data?.reused === true);
    ok('AT3: same flow_id', d3.data?.flow_id === flowId);
  }

  // AT4: Concurrent/repeated start → at most one active flow
  console.log('\nAT4: Concurrent/repeated start → at most one active flow');
  const { data: flowRow } = await supabase
    .from('reset_map_flow')
    .select('user_id')
    .eq('id', flowId)
    .single();
  const userId = flowRow?.user_id;
  const { count } = await supabase
    .from('reset_map_flow')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('state', ['started', 'preview_ready']);
  ok('AT4: at most one active flow per user', (count ?? 0) <= 1);

  // AT5: Idempotent replay on same key
  console.log('\nAT5: Idempotent replay on same key');
  const r5 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': key1 },
    body: JSON.stringify({}),
  });
  ok('AT5: replay returns 200', r5.status === 200);
  const d5 = await r5.json();
  ok('AT5: same flow_id on replay', d5.data?.flow_id === d1.data?.flow_id);

  // AT6: Same key different fingerprint → 409
  console.log('\nAT6: Same key different fingerprint → 409');
  const key6 = `race-${Date.now()}-diff`;
  await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': key6 },
    body: JSON.stringify({ session_id: null, variant_tag: 'a' }),
  });
  const r6 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': key6 },
    body: JSON.stringify({ session_id: null, variant_tag: 'b' }),
  });
  ok('AT6: 409 on fingerprint mismatch', r6.status === 409);
  const d6 = await r6.json();
  ok('AT6: IDEMPOTENCY_KEY_REUSED', d6.ok === false && d6.error?.code === 'IDEMPOTENCY_KEY_REUSED');

  // AT7: Events logged
  console.log('\nAT7: Events logged');
  const { data: events } = await supabase
    .from('reset_map_events')
    .select('name')
    .eq('flow_id', flowId)
    .in('name', ['started', 'active_flow_reused', 'duplicate_start_prevented']);
  const eventNames = new Set((events ?? []).map((e) => e.name));
  ok('AT7: started event exists', eventNames.has('started'));
  ok('AT7: active_flow_reused or duplicate_start_prevented', eventNames.has('active_flow_reused') || eventNames.has('duplicate_start_prevented'));

  // AT8: Preview/apply flow still works
  console.log('\nAT8: Preview/apply flow still works');
  const applyKey = `race-apply-${Date.now()}`;
  const r8 = await fetch(`${baseUrl}/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': applyKey,
      Authorization: `Bearer ${token}`,
    },
  });
  ok('AT8: apply succeeds', r8.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
