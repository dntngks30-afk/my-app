/**
 * HOTFIX-CAM-PASS-LATCH-PRECEDENCE-01 — 스쿼트 페이지 settled vs 성공 래치 선행 순서
 *
 * 실행: npx tsx scripts/camera-hotfix-pass-latch-precedence-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

const {
  squatCaptureShouldClearSettledForPassLatch,
  recordPassLatchOrderingDiag,
  getRecentPassLatchOrderingDiags,
} = await import('../src/lib/camera/camera-success-diagnostic.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}${extra !== undefined ? ` | ${JSON.stringify(extra)}` : ''}`);
    process.exitCode = 1;
  }
}

console.log('\nA. final pass ready + settled + page latch pending → clear settled wins');
{
  const r = squatCaptureShouldClearSettledForPassLatch({
    settled: true,
    finalPassLatched: true,
    passLatched: false,
  });
  ok('clearSettled', r.clearSettled === true, r);
  ok('reason', r.reason === 'final_pass_ready_page_latch_pending', r);
}

console.log('\nB. true retry (no final pass) + settled → stay blocked');
{
  const r = squatCaptureShouldClearSettledForPassLatch({
    settled: true,
    finalPassLatched: false,
    passLatched: false,
  });
  ok('no clear', r.clearSettled === false, r);
  ok('no reason', r.reason === null, r);
}

console.log('\nC. already latched + settled → do not clear (dedupe)');
{
  const r = squatCaptureShouldClearSettledForPassLatch({
    settled: true,
    finalPassLatched: true,
    passLatched: true,
  });
  ok('no clear when passLatched', r.clearSettled === false, r);
}

console.log('\nD. not settled → no-op');
{
  const r = squatCaptureShouldClearSettledForPassLatch({
    settled: false,
    finalPassLatched: true,
    passLatched: false,
  });
  ok('unsettled', r.clearSettled === false && r.reason === null, r);
}

console.log('\nE. recordPassLatchOrderingDiag + getRecent (additive fields)');
{
  store.clear();
  recordPassLatchOrderingDiag({
    ts: new Date().toISOString(),
    passLatchBlockedBySettled: true,
    passLatchDeferredReason: 'final_pass_ready_page_latch_pending',
    gateStatus: 'retry',
    finalPassLatched: true,
    passLatched: false,
    currentStepKey: 'squat:smoke-1',
  });
  const list = getRecentPassLatchOrderingDiags();
  ok('one entry', list.length === 1, list.length);
  const e = list[0];
  ok('passLatchBlockedBySettled', e?.passLatchBlockedBySettled === true, e);
  ok('passLatchDeferredReason', e?.passLatchDeferredReason === 'final_pass_ready_page_latch_pending', e);
  ok('gateStatus', e?.gateStatus === 'retry', e);
}

console.log(`\nDone. passed=${passed} failed=${failed}`);
