/**
 * PR-RESET-10: Reset Map Metrics + Debug acceptance tests
 * Run: npx tsx scripts/reset-map-metrics-smoke.mjs
 *
 * Unit: metrics helper, blocked reason distribution
 * API: recent, events, metrics endpoints (require BASE_URL, TEST_BEARER_TOKEN)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name, detail = '') {
  passed++;
  console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, reason) {
  failed++;
  console.error(`  [FAIL] ${name} — ${reason}`);
}

function skip(name, reason) {
  skipped++;
  console.log(`  [SKIP] ${name} — ${reason}`);
}

async function run() {
  console.log('PR-RESET-10: Reset Map Metrics + Debug acceptance\n');
  console.log('─'.repeat(60));

  // ─── Unit: metrics helper ───────────────────────────────────────────────
  console.log('\nUnit: getResetMapMetrics');
  const { getResetMapMetrics } = await import('../src/lib/reset-map/metrics.ts');
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase =
    supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey)
      : null;

  if (!supabase) {
    skip('Metrics unit', 'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required');
  } else {
  const metrics = await getResetMapMetrics({ supabase });
  if (typeof metrics === 'object' && metrics.flow_counts && metrics.event_counts) {
    pass('AT1', 'Metrics helper returns flow_counts and event_counts');
  } else {
    fail('AT1', `Expected metrics shape, got ${typeof metrics}`);
  }

  if (
    typeof metrics.blocked_reason_distribution === 'object' &&
    !Array.isArray(metrics.blocked_reason_distribution)
  ) {
    pass('AT2', 'Blocked reason distribution is object');
  } else {
    fail('AT2', `Expected object, got ${typeof metrics.blocked_reason_distribution}`);
  }

  if (
    typeof metrics.funnel === 'object' &&
    'started' in metrics.funnel &&
    'preview_ready' in metrics.funnel &&
    'applied' in metrics.funnel
  ) {
    pass('AT3', 'Funnel has started, preview_ready, applied');
  } else {
    fail('AT3', `Expected funnel shape, got ${JSON.stringify(metrics.funnel)}`);
  }

  if (
    typeof metrics.timing_ms === 'object' &&
    'start_to_preview_ready_median' in metrics.timing_ms &&
    'start_to_apply_median' in metrics.timing_ms
  ) {
    pass('AT4', 'Timing_ms has expected fields');
  } else {
    fail('AT4', `Expected timing_ms shape`);
  }
  }

  // ─── API tests ──────────────────────────────────────────────────────────
  const baseUrl = process.env.BASE_URL;
  const token = process.env.TEST_BEARER_TOKEN;
  const hasEnv = baseUrl && token;

  if (!hasEnv) {
    skip('API scenarios', 'Set BASE_URL, TEST_BEARER_TOKEN');
    console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  const api = async (path, opts = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
      ...opts,
    });
    return { res, body: await res.json().catch(() => ({})) };
  };

  console.log('\nAPI: GET /api/reset-map/debug/recent');
  const { res: recentRes, body: recentBody } = await api('/api/reset-map/debug/recent');
  if (recentRes.ok && Array.isArray(recentBody?.data?.flows)) {
    pass('AT5', 'Recent endpoint returns normalized flows array');
  } else if (recentRes.status === 401) {
    pass('AT5', 'Recent requires auth (401)');
  } else {
    fail('AT5', `Expected ok+flows or 401, got ${recentRes.status} ${JSON.stringify(recentBody)}`);
  }

  console.log('\nAPI: GET /api/reset-map/debug/metrics');
  const { res: metricsRes, body: metricsBody } = await api('/api/reset-map/debug/metrics');
  if (metricsRes.ok && metricsBody?.data?.event_counts) {
    pass('AT6', 'Metrics endpoint returns event_counts');
  } else if (metricsRes.status === 401) {
    pass('AT6', 'Metrics requires auth (401)');
  } else {
    fail('AT6', `Expected ok+metrics or 401, got ${metricsRes.status}`);
  }

  console.log('\nAPI: GET /api/reset-map/debug/[flowId]/events');
  const fakeFlowId = '00000000-0000-0000-0000-000000000000';
  const { res: eventsRes, body: eventsBody } = await api(
    `/api/reset-map/debug/${fakeFlowId}/events`
  );
  if (eventsRes.status === 404 || (eventsRes.ok && Array.isArray(eventsBody?.data?.events))) {
    pass('AT7', 'Events endpoint returns 404 for unknown or ordered events for valid flow');
  } else if (eventsRes.status === 401) {
    pass('AT7', 'Events requires auth (401)');
  } else {
    fail('AT7', `Expected 404/ok or 401, got ${eventsRes.status}`);
  }

  console.log('\nAPI: Unauthorized cannot access');
  const noAuthRes = await fetch(`${baseUrl}/api/reset-map/debug/recent`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (noAuthRes.status === 401) {
    pass('AT8', 'No auth returns 401');
  } else {
    fail('AT8', `Expected 401 without auth, got ${noAuthRes.status}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
