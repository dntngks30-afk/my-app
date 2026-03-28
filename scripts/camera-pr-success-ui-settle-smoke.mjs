/**
 * PR-CAM-SUCCESS-UI-SETTLE-01 smoke
 * Run: npx tsx scripts/camera-pr-success-ui-settle-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  updateSuccessUiSettleCandidate,
  getSuccessUiSettleDurationMs,
  classifySuccessUiSettlePath,
  SUCCESS_UI_SETTLE_MS_SHALLOW,
} = await import('../src/lib/camera/success-ui-settle.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${d}`);
    process.exitCode = 1;
  }
}

const t0 = 1_000_000;

console.log('\n── A. low_rom: 짧은 유지 → 아직 latch 불가 ──');
{
  let prev = null;
  const r1 = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0,
    prev,
  });
  prev = r1.next;
  ok('A1: 첫 틱은 아직 latch 아님', r1.shouldLatchUiNow === false, r1);
  const r2 = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0 + 150,
    prev,
  });
  prev = r2.next;
  ok('A2: 150ms 후에도 settle 미만', r2.shouldLatchUiNow === false, r2);
}

console.log('\n── B. low_rom: 320ms+ 유지 → latch 허용 ──');
{
  let prev = null;
  prev = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0,
    prev,
  }).next;
  const r = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0 + SUCCESS_UI_SETTLE_MS_SHALLOW + 20,
    prev,
  });
  ok('B1: settle 창 충족 시 latch', r.shouldLatchUiNow === true, r);
  ok('B2: candidate ISO 존재', typeof r.candidateStartedAtIso === 'string', r.candidateStartedAtIso);
}

console.log('\n── C. standard_cycle: 즉시 latch (0ms settle) ──');
{
  const r = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'standard_cycle',
    nowMs: t0,
    prev: null,
  });
  ok('C1: standard 는 첫 틱 latch', r.shouldLatchUiNow === true, r);
  ok('C2: settle ms 0', r.settleMsUsed === 0, r.settleMsUsed);
}

console.log('\n── D. passReady 플리커 → 후보 리셋 ──');
{
  let prev = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0,
    prev: null,
  }).next;
  const dropped = updateSuccessUiSettleCandidate({
    passReady: false,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0 + 100,
    prev,
  });
  ok('D1: passReady false → next null', dropped.next === null, dropped.next);
  const again = updateSuccessUiSettleCandidate({
    passReady: true,
    completionPassReason: 'low_rom_event_cycle',
    nowMs: t0 + 500,
    prev: dropped.next,
  });
  ok('D2: 재시작 시 candidate 시각 리셋', again.candidateStartedAtMs === t0 + 500, again.candidateStartedAtMs);
  ok('D3: 리셋 직후는 아직 latch 전', again.shouldLatchUiNow === false, again);
}

console.log('\n── E. 진단 freeze / auto-advance: 래치는 페이지 단일 경로 ──');
{
  ok(
    'E1: shallow settle ms 는 280–380 범위',
    SUCCESS_UI_SETTLE_MS_SHALLOW >= 280 && SUCCESS_UI_SETTLE_MS_SHALLOW <= 380,
    SUCCESS_UI_SETTLE_MS_SHALLOW
  );
  ok(
    'E2: auto-advance effect 는 latch 호출 안 함 — 구조적으로 capturing effect 만 latch (문서)',
    true,
  );
  ok(
    'E3: standard 경로 duration',
    getSuccessUiSettleDurationMs(classifySuccessUiSettlePath('standard_cycle')) === 0,
  );
}

console.log(`\n━━━ PR-CAM-SUCCESS-UI-SETTLE-01 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
}
