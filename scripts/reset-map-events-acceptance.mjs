/**
 * PR-RESET-03: Reset Map Events acceptance tests
 * Run: npx tsx scripts/reset-map-events-acceptance.mjs
 *
 * Unit tests (no env): events module import
 * API tests (requires): BASE_URL, TEST_BEARER_TOKEN, Supabase env, dev server
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
  console.log('PR-RESET-03: Reset Map Events acceptance\n');

  console.log('Unit: events module');
  const events = await import('../src/lib/reset-map/events.ts');
  ok('logResetMapEvent exists', typeof events.logResetMapEvent === 'function');

  const baseUrl = process.env.BASE_URL;
  const token = process.env.TEST_BEARER_TOKEN;
  const hasEnv =
    baseUrl &&
    token &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http');

  if (!hasEnv) {
    console.log('\nAPI tests SKIP: set BASE_URL, TEST_BEARER_TOKEN, SUPABASE_SERVICE_ROLE_KEY');
    console.log(`\n${passed} passed, ${failed} failed (unit only)`);
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\nAPI: start → started event');
  const key1 = `events-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r1 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key1,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ variant_tag: 'events-test' }),
  });
  ok('AT1: start happy path 200', r1.status === 200);
  const d1 = await r1.json();
  ok('AT1: response contract stable', d1.ok === true && d1.data?.id);
  const flowId = d1.data?.id;

  const { data: startedEvents } = await supabase
    .from('reset_map_events')
    .select('flow_id, user_id, name, attrs')
    .eq('flow_id', flowId)
    .eq('name', 'started');
  ok('AT1: started event written', startedEvents?.length === 1);
  ok('AT4: event has flow_id and user_id', startedEvents?.[0]?.flow_id === flowId && !!startedEvents?.[0]?.user_id);

  console.log('\nAPI: apply → applied event');
  const applyKey = `events-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r2 = await fetch(`${baseUrl}/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': applyKey,
      Authorization: `Bearer ${token}`,
    },
  });
  ok('AT2: apply happy path 200', r2.status === 200);
  const d2 = await r2.json();
  ok('AT6: API response contract stable', d2.ok === true && d2.data?.state === 'applied');

  const { data: appliedEvents } = await supabase
    .from('reset_map_events')
    .select('flow_id, name, attrs')
    .eq('flow_id', flowId)
    .eq('name', 'applied');
  ok('AT2: applied event written', appliedEvents?.length === 1);
  ok('AT4: applied event has flow_id', appliedEvents?.[0]?.flow_id === flowId);

  console.log('\nAPI: invalid apply → invalid_state_attempt');
  const invalidKey = `events-invalid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r3 = await fetch(`${baseUrl}/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': invalidKey,
      Authorization: `Bearer ${token}`,
    },
  });
  ok('AT3: invalid apply returns 422', r3.status === 422);

  const { data: invalidEvents } = await supabase
    .from('reset_map_events')
    .select('flow_id, name, attrs')
    .eq('flow_id', flowId)
    .eq('name', 'invalid_state_attempt');
  ok('AT3: invalid_state_attempt event written', invalidEvents?.length === 1);
  ok('AT4: invalid event has flow_id', invalidEvents?.[0]?.flow_id === flowId);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
