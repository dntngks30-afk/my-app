/**
 * PR-RESET-05: Reset Map Client Connector acceptance tests
 * Run: npx tsx scripts/reset-map-client-connector-acceptance.mjs
 *
 * Unit tests: client module, idempotency, storage
 * API tests: require BASE_URL, TEST_BEARER_TOKEN, SUPABASE_SERVICE_ROLE_KEY
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
  console.log('PR-RESET-05: Reset Map Client Connector acceptance\n');

  console.log('Unit: client module');
  const client = await import('../src/lib/reset-map/client.ts');
  ok('startResetMapFlow exists', typeof client.startResetMapFlow === 'function');
  ok('getLatestResetMapFlow exists', typeof client.getLatestResetMapFlow === 'function');
  ok('submitResetMapPreview exists', typeof client.submitResetMapPreview === 'function');
  ok('applyResetMapFlow exists', typeof client.applyResetMapFlow === 'function');

  console.log('\nUnit: clientIdempotency');
  const idem = await import('../src/lib/reset-map/clientIdempotency.ts');
  const k1 = idem.getIdempotencyKey('start');
  ok('getIdempotencyKey returns string', typeof k1 === 'string' && k1.length > 0);
  const k3 = idem.getIdempotencyKey('apply');
  ok('start and apply keys differ', k1 !== k3);

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

  console.log('\nAPI: latest returns normalized contract');
  const latestRes = await client.getLatestResetMapFlow(token);
  ok('latest returns ok or error', latestRes.ok === true || (latestRes.ok === false && latestRes.error));
  if (latestRes.ok) {
    ok('latest data has flow field', 'flow' in latestRes.data);
  }

  console.log('\nAPI: start → apply flow');
  const startKey = `acceptance-conn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startRes = await client.startResetMapFlow(token, startKey);
  ok('AT1: start creates flow', startRes.ok && startRes.data?.id);
  const flowId = startRes.data?.id;

  const startRes2 = await client.startResetMapFlow(token, startKey);
  ok('AT2: same key replay returns same flow', startRes2.ok && startRes2.data?.id === flowId);

  const previewRes = await client.submitResetMapPreview(token, flowId, {
    permission_state: 'granted',
    tracking_conf: 0.5,
    landmark_coverage: 0.6,
  });
  ok('AT3: preview updates flow', previewRes.ok && previewRes.data?.proceed === true);

  const applyKey = `acceptance-apply-conn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const applyRes = await client.applyResetMapFlow(token, flowId, applyKey);
  ok('AT4: apply succeeds', applyRes.ok && applyRes.data?.state === 'applied');

  const latestAfter = await client.getLatestResetMapFlow(token);
  ok('AT5: after apply, latest returns null (no active flow)', latestAfter.ok && latestAfter.data?.flow === null);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
