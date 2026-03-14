/**
 * PR-RESET-09: Server/Client Reconciliation acceptance tests
 * Run: node scripts/reset-map-reconcile-acceptance.mjs
 *
 * Unit: reconcileResetMapClientState logic
 * API: local stale, server wins, keys cleared, etc.
 * Requires: BASE_URL, TEST_BEARER_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

const STORAGE_KEY = 'moveRe:resetMap:active';
const KEY_PREFIX = 'moveRe:resetMap:key:';

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
  console.log('PR-RESET-09: Server/Client Reconciliation acceptance\n');
  console.log('─'.repeat(60));

  // ─── Unit: reconcile logic ───────────────────────────────────────────────
  console.log('\nUnit: reconcileResetMapClientState');
  const { reconcileResetMapClientState } = await import('../src/lib/reset-map/reconcile.ts');

  const r1 = reconcileResetMapClientState(
    { id: 'flow-a', state: 'started' },
    { flow_id: 'flow-b', start_key: 'k1', updated_at: 1 }
  );
  if (r1.action === 'repair' && r1.flow_id === 'flow-a' && r1.clearApplyKey) {
    pass('AT1', 'Server active wins, repair with clearApplyKey');
  } else {
    fail('AT1', `Expected repair flow-a, got ${JSON.stringify(r1)}`);
  }

  const r2 = reconcileResetMapClientState(
    { id: 'flow-a', state: 'started' },
    { flow_id: 'flow-a', start_key: 'k1', updated_at: 1 }
  );
  if (r2.action === 'none' && r2.flow_id === 'flow-a') {
    pass('AT2', 'Match → none');
  } else {
    fail('AT2', `Expected none, got ${JSON.stringify(r2)}`);
  }

  const r3 = reconcileResetMapClientState(null, { flow_id: 'flow-x', start_key: 'k1', updated_at: 1 });
  if (r3.action === 'clear') {
    pass('AT3', 'Server null + local active → clear');
  } else {
    fail('AT3', `Expected clear, got ${JSON.stringify(r3)}`);
  }

  const r4 = reconcileResetMapClientState(
    { id: 'flow-a', state: 'applied' },
    { flow_id: 'flow-a', start_key: 'k1', updated_at: 1 }
  );
  if (r4.action === 'clear') {
    pass('AT4', 'Server terminal → clear');
  } else {
    fail('AT4', `Expected clear for terminal, got ${JSON.stringify(r4)}`);
  }

  const r5 = reconcileResetMapClientState(null, null);
  if (r5.action === 'clear') {
    pass('AT5', 'Both null → clear');
  } else {
    fail('AT5', `Expected clear, got ${JSON.stringify(r5)}`);
  }

  // ─── API tests ──────────────────────────────────────────────────────────
  const baseUrl = process.env.BASE_URL;
  const token = process.env.TEST_BEARER_TOKEN;
  const hasEnv =
    baseUrl &&
    token &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasEnv) {
    skip(
      'API scenarios',
      'Set BASE_URL, TEST_BEARER_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
    console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  const storage = new Map();

  function getLocal() {
    const raw = storage.get(STORAGE_KEY);
    if (!raw) return null;
    try {
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const flow_id = typeof d?.flow_id === 'string' ? d.flow_id : '';
      const start_key = typeof d?.start_key === 'string' ? d.start_key : '';
      if (!flow_id || !start_key) return null;
      return { flow_id, start_key, apply_key: d?.apply_key, updated_at: d?.updated_at ?? 0 };
    } catch {
      return null;
    }
  }

  function setLocal(s) {
    storage.set(STORAGE_KEY, JSON.stringify({ ...s, updated_at: Date.now() }));
  }

  function clearLocal() {
    storage.delete(STORAGE_KEY);
    storage.delete(KEY_PREFIX + 'start');
    storage.delete(KEY_PREFIX + 'apply');
  }

  async function api(path, opts = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
      ...opts,
    });
    return { res, body: await res.json().catch(() => ({})) };
  }

  async function getLatest() {
    const { res, body } = await api('/api/reset-map/latest', { method: 'GET' });
    return { ok: res.ok, data: body?.data ?? body };
  }

  async function start(key) {
    const { res, body } = await api('/api/reset-map/start', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({}),
    });
    return { ok: res.ok, data: body?.data ?? body };
  }

  async function preview(flowId, payload) {
    const { res, body } = await api(`/api/reset-map/${flowId}/preview-result`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, data: body?.data ?? body };
  }

  async function apply(flowId, key) {
    const { res, body } = await api(`/api/reset-map/${flowId}/apply`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    });
    return { ok: res.ok, data: body?.data ?? body };
  }

  async function runEntry() {
    const local = getLocal();
    const latestRes = await getLatest();
    const latestFlow =
      latestRes.ok && latestRes.data?.flow
        ? { id: latestRes.data.flow.id, state: latestRes.data.flow.state }
        : null;
    const result = reconcileResetMapClientState(latestFlow, local);

    if (result.action === 'repair') {
      if (result.clearApplyKey) storage.delete(KEY_PREFIX + 'apply');
      setLocal({
        flow_id: result.flow_id,
        start_key: local?.start_key ?? `reconcile-start-${Date.now()}`,
      });
      return { action: 'repair', flow_id: result.flow_id };
    }
    if (result.action === 'none') return { action: 'none', flow_id: result.flow_id };

    clearLocal();
    const startKey = `reconcile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const startRes = await start(startKey);
    if (startRes.ok && startRes.data?.flow_id) {
      setLocal({ flow_id: startRes.data.flow_id, start_key: startKey });
      return { action: 'started', flow_id: startRes.data.flow_id };
    }
    return { action: 'failed' };
  }

  const supabase = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Cleanup
  const latest0 = await getLatest();
  if (latest0.ok && latest0.data?.flow?.state === 'started') {
    await preview(latest0.data.flow.id, {
      permission_state: 'granted',
      tracking_conf: 0.5,
      landmark_coverage: 0.6,
    });
  }
  if (latest0.ok && latest0.data?.flow) {
    await apply(latest0.data.flow.id, `reconcile-cleanup-${Date.now()}`);
  }
  clearLocal();

  // AT6: Local flow_id stale, server different active → repaired
  console.log('\nAPI AT6: Local stale flow_id, server different active → repaired');
  const k1 = `reconcile-6-${Date.now()}`;
  const s1 = await start(k1);
  const flowId1 = s1.data?.flow_id;
  setLocal({ flow_id: '00000000-0000-0000-0000-000000000001', start_key: k1 });
  const e6 = await runEntry();
  const loc6 = getLocal();
  if (e6.action === 'repair' && loc6?.flow_id === flowId1) {
    pass('AT6', 'Local repaired to server flow');
  } else {
    fail('AT6', `Expected repair to ${flowId1}, got ${JSON.stringify(e6)} local=${loc6?.flow_id}`);
  }

  // AT7: Local flow terminal, server no active → cleared
  console.log('\nAPI AT7: Local terminal, server no active → cleared');
  await preview(flowId1, { permission_state: 'granted', tracking_conf: 0.5, landmark_coverage: 0.6 });
  await apply(flowId1, `reconcile-7-${Date.now()}`);
  setLocal({ flow_id: flowId1, start_key: `stale-${Date.now()}` });
  storage.set(KEY_PREFIX + 'apply', `stale-apply-${Date.now()}`);
  const e7 = await runEntry();
  const loc7 = getLocal();
  if (e7.action === 'started' && loc7?.flow_id !== flowId1) {
    pass('AT7', 'Cleared and started new flow');
  } else {
    fail('AT7', `Expected new flow, got ${JSON.stringify(e7)}`);
  }

  const applyKeyAfter = storage.get(KEY_PREFIX + 'apply');
  if (applyKeyAfter === undefined || applyKeyAfter === null) {
    pass('AT7', 'Stale apply key cleared');
  } else {
    fail('AT7', `Stale apply key should be cleared, got ${applyKeyAfter}`);
  }

  // AT8: Latest null + stale local active → cleared before new start
  console.log('\nAPI AT8: Latest null + stale local → cleared before start');
  const flowId7 = loc7?.flow_id;
  await apply(flowId7, `reconcile-8-${Date.now()}`);
  setLocal({ flow_id: flowId7, start_key: `stale2-${Date.now()}` });
  const e8 = await runEntry();
  if (e8.action === 'started') {
    pass('AT8', 'Cleared stale local, started new');
  } else {
    fail('AT8', `Expected started, got ${JSON.stringify(e8)}`);
  }

  // AT9: Re-entry after mismatch → exactly one active flow
  console.log('\nAPI AT9: Re-entry after mismatch → one active flow');
  const { data: flowRow } = await supabase
    .from('reset_map_flow')
    .select('user_id')
    .eq('id', e8.flow_id)
    .single();
  const { count } = await supabase
    .from('reset_map_flow')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', flowRow?.user_id)
    .in('state', ['started', 'preview_ready']);
  if (count === 1) {
    pass('AT9', 'Exactly one active flow');
  } else {
    fail('AT9', `Expected 1 active flow, got ${count}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
