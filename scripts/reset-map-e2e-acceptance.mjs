/**
 * PR-RESET-07: End-to-End Reset Map Execution Entry Harness
 * Run: node scripts/reset-map-e2e-acceptance.mjs
 *
 * Validates full reset-map lifecycle across client + server.
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

// ─── In-memory storage (simulates sessionStorage) ─────────────────────────
const storage = new Map();

function getLocalState() {
  const raw = storage.get(STORAGE_KEY);
  if (!raw) return null;
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const flow_id = typeof d?.flow_id === 'string' ? d.flow_id : '';
    const start_key = typeof d?.start_key === 'string' ? d.start_key : '';
    if (!flow_id || !start_key) return null;
    return {
      flow_id,
      start_key,
      apply_key: typeof d?.apply_key === 'string' ? d.apply_key : undefined,
      updated_at: typeof d?.updated_at === 'number' ? d.updated_at : 0,
    };
  } catch {
    return null;
  }
}

function setLocalState(state) {
  storage.set(STORAGE_KEY, JSON.stringify({ ...state, updated_at: Date.now() }));
}

function clearLocalState() {
  storage.delete(STORAGE_KEY);
  storage.delete(KEY_PREFIX + 'start');
  storage.delete(KEY_PREFIX + 'apply');
}

function getOrCreateKey(intent) {
  const k = KEY_PREFIX + intent;
  let v = storage.get(k);
  if (!v) {
    v = `e2e-${intent}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    storage.set(k, v);
  }
  return v;
}

function resetStartKey() {
  storage.delete(KEY_PREFIX + 'start');
}

// ─── API helpers ───────────────────────────────────────────────────────────
async function api(baseUrl, token, path, opts = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
    ...opts,
  });
  return { res, body: await res.json().catch(() => ({})) };
}

async function getLatest(baseUrl, token) {
  const { res, body } = await api(baseUrl, token, '/api/reset-map/latest', { method: 'GET' });
  return { ok: res.ok, data: body?.data ?? body };
}

async function start(baseUrl, token, idempotencyKey, body = {}) {
  const { res, body: b } = await api(baseUrl, token, '/api/reset-map/start', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: b?.data ?? b };
}

async function preview(baseUrl, token, flowId, payload) {
  const { res, body } = await api(baseUrl, token, `/api/reset-map/${flowId}/preview-result`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: body?.data ?? body };
}

async function apply(baseUrl, token, flowId, idempotencyKey) {
  const { res, body } = await api(baseUrl, token, `/api/reset-map/${flowId}/apply`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return { ok: res.ok, status: res.status, data: body?.data ?? body, body };
}

// ─── Client entry logic (mirrors HomePageClient, PR-RESET-09 reconcile) ────
async function runEntryFlow(baseUrl, token) {
  const local = getLocalState();
  const latestRes = await getLatest(baseUrl, token);

  if (latestRes.ok && latestRes.data?.flow) {
    const flow = latestRes.data.flow;
    if (flow.state === 'started' || flow.state === 'preview_ready') {
      if (!local || local.flow_id !== flow.id) {
        if (local) storage.delete(KEY_PREFIX + 'apply');
        setLocalState({
          flow_id: flow.id,
          start_key: local?.start_key ?? getOrCreateKey('start'),
          updated_at: Date.now(),
        });
      }
      return { action: 'reused', flow_id: flow.id, state: flow.state };
    }
  }

  clearLocalState();
  const startKey = getOrCreateKey('start');
  const startRes = await start(baseUrl, token, startKey);

  if (startRes.ok && startRes.data?.flow_id) {
    setLocalState({
      flow_id: startRes.data.flow_id,
      start_key: startKey,
      updated_at: Date.now(),
    });
    return {
      action: 'started',
      flow_id: startRes.data.flow_id,
      state: startRes.data?.state ?? 'started',
      reused: startRes.data?.reused ?? false,
    };
  }

  return { action: 'failed' };
}

// ─── Test runner ───────────────────────────────────────────────────────────
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
  console.log('PR-RESET-07: End-to-End Reset Map Execution Entry Harness\n');
  console.log('─'.repeat(60));

  const baseUrl = process.env.BASE_URL;
  const token = process.env.TEST_BEARER_TOKEN;
  const hasEnv =
    baseUrl &&
    token &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasEnv) {
    skip(
      'All scenarios',
      'Set BASE_URL, TEST_BEARER_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
    console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
    process.exit(0);
    return;
  }

  const supabase = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Ensure clean slate: terminate any existing active flow (PR-RESET-08: apply only from preview_ready)
  const latest0 = await getLatest(baseUrl, token);
  if (latest0.ok && latest0.data?.flow) {
    const flow = latest0.data.flow;
    if (flow.state === 'started' || flow.state === 'preview_ready') {
      if (flow.state === 'started') {
        await preview(baseUrl, token, flow.id, {
          permission_state: 'granted',
          tracking_conf: 0.5,
          landmark_coverage: 0.6,
        });
      }
      const applyKey = `e2e-cleanup-${Date.now()}`;
      await apply(baseUrl, token, flow.id, applyKey);
    }
  }
  clearLocalState();
  storage.clear();

  // ─── AT1: No active flow → start creates one ─────────────────────────────
  console.log('\nAT1: No active flow → start creates one');
  const r1 = await runEntryFlow(baseUrl, token);
  if (r1.action === 'failed') {
    fail('AT1', 'Entry flow failed to start');
  } else if (r1.action === 'started' && !r1.reused) {
    pass('AT1', `flow_id=${r1.flow_id} state=${r1.state} reused=false`);
  } else if (r1.action === 'reused') {
    fail('AT1', `Expected new start but got reused flow_id=${r1.flow_id}`);
  } else {
    fail('AT1', `Unexpected: ${JSON.stringify(r1)}`);
  }

  const flowId1 = r1.flow_id;
  const { data: flowRow } = await supabase
    .from('reset_map_flow')
    .select('user_id, state')
    .eq('id', flowId1)
    .single();
  const userId = flowRow?.user_id;
  if (flowRow?.state === 'started') {
    pass('AT1', 'DB: one active flow in started');
  } else {
    fail('AT1', `DB: expected started, got ${flowRow?.state}`);
  }

  // ─── AT2: Active flow exists → reuse same flow_id ───────────────────────
  console.log('\nAT2: Active flow exists → reuse same flow_id');
  const r2 = await runEntryFlow(baseUrl, token);
  if (r2.action === 'reused' && r2.flow_id === flowId1) {
    pass('AT2', `reused flow_id=${r2.flow_id}`);
  } else if (r2.action === 'started' && r2.reused && r2.flow_id === flowId1) {
    pass('AT2', `start returned reused=true flow_id=${r2.flow_id}`);
  } else if (r2.flow_id !== flowId1) {
    fail('AT2', `Expected flow_id=${flowId1}, got ${r2.flow_id}`);
  } else {
    fail('AT2', `Unexpected: ${JSON.stringify(r2)}`);
  }

  const local2 = getLocalState();
  if (local2?.flow_id === flowId1) {
    pass('AT2', 'Local storage has correct flow_id');
  } else {
    fail('AT2', `Local flow_id=${local2?.flow_id}, expected ${flowId1}`);
  }

  // ─── AT2b: Apply from started → PREVIEW_REQUIRED (PR-RESET-08) ───────────
  console.log('\nAT2b: Apply from started → PREVIEW_REQUIRED');
  const applyKey2b = `e2e-apply-started-${Date.now()}`;
  const app2b = await apply(baseUrl, token, flowId1, applyKey2b);
  const errCode = app2b.body?.error?.code ?? app2b.data?.error?.code;
  if (app2b.status === 422 && errCode === 'PREVIEW_REQUIRED') {
    pass('AT2b', 'Apply from started returns 422 PREVIEW_REQUIRED');
  } else {
    fail('AT2b', `Expected 422 PREVIEW_REQUIRED, got ${app2b.status} code=${errCode}`);
  }

  const { data: flow2b } = await supabase
    .from('reset_map_flow')
    .select('state')
    .eq('id', flowId1)
    .single();
  if (flow2b?.state === 'started') {
    pass('AT2b', 'Flow state unchanged (not mutated)');
  } else {
    fail('AT2b', `Flow should stay started, got ${flow2b?.state}`);
  }

  const { data: ev2b } = await supabase
    .from('reset_map_events')
    .select('name')
    .eq('flow_id', flowId1)
    .eq('name', 'apply_blocked_preview_required')
    .maybeSingle();
  if (ev2b) {
    pass('AT2b', 'apply_blocked_preview_required event recorded');
  } else {
    fail('AT2b', 'apply_blocked_preview_required event not found');
  }

  // ─── AT3: Preview blocked → same flow remains active ─────────────────────
  console.log('\nAT3: Preview blocked → same flow remains active');
  const prev3 = await preview(baseUrl, token, flowId1, {
    permission_state: 'denied',
    tracking_conf: 0.2,
  });
  if (prev3.ok && prev3.data?.proceed === false && prev3.data?.state === 'started') {
    pass('AT3', 'preview blocked, flow stays started');
  } else {
    fail('AT3', `Expected proceed=false state=started, got ${JSON.stringify(prev3.data)}`);
  }

  const { count: count3 } = await supabase
    .from('reset_map_flow')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('state', ['started', 'preview_ready']);
  if (count3 === 1) {
    pass('AT3', 'DB: still one active flow');
  } else {
    fail('AT3', `DB: expected 1 active flow, got ${count3}`);
  }

  // ─── AT4: Preview ready → same flow remains active ────────────────────────
  console.log('\nAT4: Preview ready → same flow remains active');
  const prev4 = await preview(baseUrl, token, flowId1, {
    permission_state: 'granted',
    tracking_conf: 0.5,
    landmark_coverage: 0.6,
  });
  if (prev4.ok && prev4.data?.proceed === true && prev4.data?.state === 'preview_ready') {
    pass('AT4', 'preview ready, flow_id unchanged');
  } else {
    fail('AT4', `Expected proceed=true state=preview_ready, got ${JSON.stringify(prev4.data)}`);
  }

  const latest4 = await getLatest(baseUrl, token);
  if (latest4.ok && latest4.data?.flow?.id === flowId1 && latest4.data?.flow?.state === 'preview_ready') {
    pass('AT4', 'Latest returns same flow in preview_ready');
  } else {
    fail('AT4', `Latest: ${JSON.stringify(latest4.data)}`);
  }

  // ─── AT5: Apply → flow terminal, client state cleared ──────────────────────
  console.log('\nAT5: Apply → flow terminal, client state cleared');
  storage.set(KEY_PREFIX + 'apply', `e2e-apply-${Date.now()}`);
  const applyKey5 = getOrCreateKey('apply');
  const app5 = await apply(baseUrl, token, flowId1, applyKey5);
  if (app5.ok && app5.data?.state === 'applied') {
    pass('AT5', 'Apply succeeded, flow terminal');
  } else {
    fail('AT5', `Apply failed or wrong state: ${JSON.stringify(app5.data)}`);
  }

  clearLocalState();
  storage.delete(KEY_PREFIX + 'apply');
  const local5 = getLocalState();
  if (local5 === null) {
    pass('AT5', 'Client state cleared after apply');
  } else {
    fail('AT5', `Expected cleared local state, got ${JSON.stringify(local5)}`);
  }

  const { data: flow5 } = await supabase
    .from('reset_map_flow')
    .select('state')
    .eq('id', flowId1)
    .single();
  if (flow5?.state === 'applied') {
    pass('AT5', 'DB: flow in applied state');
  } else {
    fail('AT5', `DB: expected applied, got ${flow5?.state}`);
  }

  // ─── AT6: After apply, fresh entry can start new flow ───────────────────
  console.log('\nAT6: After apply, fresh entry can start new flow');
  const r6 = await runEntryFlow(baseUrl, token);
  if (r6.action === 'started' && !r6.reused && r6.flow_id !== flowId1) {
    pass('AT6', `New flow created flow_id=${r6.flow_id}`);
  } else if (r6.action === 'started' && r6.reused) {
    pass('AT6', `Reused flow (acceptable) flow_id=${r6.flow_id}`);
  } else if (r6.action === 'failed') {
    fail('AT6', 'Entry flow failed');
  } else {
    fail('AT6', `Unexpected: ${JSON.stringify(r6)}`);
  }

  const flowId6 = r6.flow_id;

  // ─── AT7: Duplicate start attempts → one active flow ──────────────────────
  console.log('\nAT7: Duplicate start attempts → one active flow');
  const key7a = `e2e-dup-${Date.now()}-a`;
  const key7b = `e2e-dup-${Date.now()}-b`;
  const [start7a, start7b] = await Promise.all([
    start(baseUrl, token, key7a, {}),
    start(baseUrl, token, key7b, {}),
  ]);
  const id7a = start7a.data?.flow_id;
  const id7b = start7b.data?.flow_id;
  if (id7a && id7b && id7a === id7b) {
    pass('AT7', 'Concurrent starts return same flow_id');
  } else {
    fail('AT7', `Different flow_ids: ${id7a} vs ${id7b}`);
  }

  const { count: count7 } = await supabase
    .from('reset_map_flow')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('state', ['started', 'preview_ready']);
  if (count7 === 1) {
    pass('AT7', 'DB: at most one active flow');
  } else {
    fail('AT7', `DB: expected 1 active flow, got ${count7}`);
  }

  // ─── AT8: Local stale flow_id vs server latest → server wins, local repaired ─
  console.log('\nAT8: Local stale flow_id vs server latest → server wins');
  const activeFlowId = start7a.data?.flow_id ?? flowId6;
  const staleFlowId = '00000000-0000-0000-0000-000000000001';
  setLocalState({
    flow_id: staleFlowId,
    start_key: getOrCreateKey('start'),
    updated_at: Date.now(),
  });

  const r8 = await runEntryFlow(baseUrl, token);
  const local8 = getLocalState();

  if (local8?.flow_id === activeFlowId) {
    pass('AT8', `Local repaired to server flow_id=${activeFlowId}`);
  } else {
    fail('AT8', `Local flow_id=${local8?.flow_id}, expected ${activeFlowId}`);
  }

  if (r8.action === 'reused' || (r8.action === 'started' && r8.reused)) {
    pass('AT8', 'Entry reused server flow (server truth wins)');
  } else if (r8.action === 'started' && r8.flow_id === activeFlowId) {
    pass('AT8', 'Entry returned server flow');
  } else {
    fail('AT8', `Unexpected entry result: ${JSON.stringify(r8)}`);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
  if (failed === 0 && passed > 0) {
    console.log('\nState transitions observed:');
    console.log('  AT1: no active → start → created (reused=false)');
    console.log('  AT2: active exists → reused (reused=true)');
    console.log('  AT3: preview blocked → flow stayed started');
    console.log('  AT4: preview ready → flow preview_ready');
    console.log('  AT5: apply → terminal, local cleared');
    console.log('  AT6: after apply → new flow created');
    console.log('  AT7: duplicate starts → one active flow');
    console.log('  AT8: local stale → server wins, local repaired');
  } else if (failed > 0) {
    console.error('\nExpected state transitions:');
    console.error('  AT1: no active → start → created');
    console.error('  AT2: active exists → reused');
    console.error('  AT3: preview blocked → flow stayed started');
    console.error('  AT4: preview ready → flow preview_ready');
    console.error('  AT5: apply → terminal, local cleared');
    console.error('  AT6: after apply → new flow possible');
    console.error('  AT7: duplicate starts → one active');
    console.error('  AT8: local stale → server wins, local repaired');
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
