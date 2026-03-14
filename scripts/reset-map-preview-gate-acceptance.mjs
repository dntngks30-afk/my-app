/**
 * PR-RESET-04: Preview Gate acceptance tests
 * Run: npx tsx scripts/reset-map-preview-gate-acceptance.mjs
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
  console.log('PR-RESET-04: Preview Gate acceptance\n');

  console.log('Unit: evaluatePreview');
  const preview = await import('../src/lib/reset-map/preview.ts');
  const r1 = preview.evaluatePreview({
    permission_state: 'granted',
    tracking_conf: 0.5,
    landmark_coverage: 0.6,
  });
  ok('AT1: granted + adequate signals → proceed=true', r1.proceed === true && r1.reasons.length === 0);

  const r2 = preview.evaluatePreview({ permission_state: 'denied' });
  ok('AT2: denied permission → PERMISSION_REQUIRED', !r2.proceed && r2.reasons.includes('PERMISSION_REQUIRED'));

  const r3 = preview.evaluatePreview({ permission_state: 'unknown' });
  ok('AT2: unknown permission → PERMISSION_REQUIRED', !r3.proceed && r3.reasons.includes('PERMISSION_REQUIRED'));

  const r4 = preview.evaluatePreview({
    permission_state: 'granted',
    tracking_conf: 0.2,
  });
  ok('AT3: low tracking_conf → LOW_TRACKING_CONF', !r4.proceed && r4.reasons.includes('LOW_TRACKING_CONF'));

  const r5 = preview.evaluatePreview({
    permission_state: 'granted',
    landmark_coverage: 0.3,
  });
  ok('AT4: low landmark_coverage → LOW_LANDMARK_COVERAGE', !r5.proceed && r5.reasons.includes('LOW_LANDMARK_COVERAGE'));

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

  console.log('\nAPI: create flow for preview');
  const key1 = `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rStart = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key1,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ variant_tag: 'preview-test' }),
  });
  ok('start creates flow', rStart.status === 200);
  const dStart = await rStart.json();
  const flowId = dStart.data?.id;

  console.log('\nAPI: preview proceed');
  const rProceed = await fetch(`${baseUrl}/api/reset-map/${flowId}/preview-result`, {
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
  ok('AT1: proceed returns 200', rProceed.status === 200);
  const dProceed = await rProceed.json();
  ok('AT1: proceed=true, state=preview_ready', dProceed.ok && dProceed.data?.proceed === true && dProceed.data?.state === 'preview_ready');
  ok('AT1: reasons empty', Array.isArray(dProceed.data?.reasons) && dProceed.data.reasons.length === 0);

  const { data: flowRow } = await supabase
    .from('reset_map_flow')
    .select('state, preview_snapshot')
    .eq('id', flowId)
    .single();
  ok('AT5: preview_snapshot stored', !!flowRow?.preview_snapshot);
  ok('AT5: state=preview_ready', flowRow?.state === 'preview_ready');

  const { data: readyEvents } = await supabase
    .from('reset_map_events')
    .select('name')
    .eq('flow_id', flowId)
    .eq('name', 'preview_ready');
  ok('AT6: preview_ready event recorded', readyEvents?.length === 1);

  console.log('\nAPI: apply after preview_ready');
  const applyKey = `preview-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rApply = await fetch(`${baseUrl}/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': applyKey,
      Authorization: `Bearer ${token}`,
    },
  });
  ok('AT7: apply after preview_ready succeeds', rApply.status === 200);

  console.log('\nAPI: create flow for blocked test');
  const key2 = `preview-blocked-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rStart2 = await fetch(`${baseUrl}/api/reset-map/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key2,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ variant_tag: 'preview-blocked' }),
  });
  const dStart2 = await rStart2.json();
  const flowId2 = dStart2.data?.id;

  const rBlocked = await fetch(`${baseUrl}/api/reset-map/${flowId2}/preview-result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ permission_state: 'denied' }),
  });
  ok('AT2: blocked returns 200', rBlocked.status === 200);
  const dBlocked = await rBlocked.json();
  ok('AT2: proceed=false, PERMISSION_REQUIRED', !dBlocked.data?.proceed && dBlocked.data?.reasons?.includes('PERMISSION_REQUIRED'));

  const { data: blockedEvents } = await supabase
    .from('reset_map_events')
    .select('name')
    .eq('flow_id', flowId2)
    .eq('name', 'preview_blocked');
  ok('AT6: preview_blocked event recorded', blockedEvents?.length === 1);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
