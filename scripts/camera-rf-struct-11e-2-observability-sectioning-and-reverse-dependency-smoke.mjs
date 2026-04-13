/**
 * PR-RF-STRUCT-11E-2 smoke guard:
 * provenance sectioning + sink-only reverse-dependency checks.
 *
 * Run:
 *   npx tsx scripts/camera-rf-struct-11e-2-observability-sectioning-and-reverse-dependency-smoke.mjs
 */

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${name}`);
    process.exitCode = 1;
  }
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function hasNoLiveTruthImport(source, bannedImportFragments) {
  return bannedImportFragments.every((fragment) => !source.includes(fragment));
}

const panelSource = read('src/components/camera/TraceDebugPanel.tsx');
const traceTypeSource = read('src/lib/camera/camera-trace.ts');
const diagnosisBuilderSource = read('src/lib/camera/trace/camera-trace-diagnosis-summary.ts');
const autoProgressionSource = read('src/lib/camera/auto-progression.ts');
const squatPageSource = read('src/app/movement-test/camera/squat/page.tsx');

console.log('\nA. TraceDebugPanel provenance sections are explicit');
for (const section of [
  'Owner mirrors',
  'Gate / final blocker mirrors',
  'Readiness / setup mirrors',
  'Latch / navigation mirrors',
  'Interpretation-only',
  'Derived / sink-only summaries',
]) {
  ok(`A: section marker exists: ${section}`, panelSource.includes(section));
}

console.log('\nB. passChainProvenance remains additive panel consumption');
ok(
  'B1: panel reads provenance labels',
  panelSource.includes('d.squatCycle.passChainProvenance?.ownerReasonSource') &&
    panelSource.includes('d.squatCycle.passChainProvenance?.gateReasonSource') &&
    panelSource.includes('d.squatCycle.passChainProvenance?.latchSource')
);
ok('B2: panel does not assign passChainProvenance', !panelSource.includes('passChainProvenance: {'));
ok('B3: existing sinkOnly provenance marker remains in trace type', traceTypeSource.includes('sinkOnly: true;'));
ok('B4: diagnosis builder stamps sinkOnly true', diagnosisBuilderSource.includes('sinkOnly: true,'));

console.log('\nC. interpretation-only / derived-only markers are locked in code comments');
ok('C1: trace type labels interpretation-only mirrors', traceTypeSource.includes('Interpretation-only mirrors'));
ok('C2: trace type labels derived/sink-only summaries', traceTypeSource.includes('Derived/sink-only calibration summary'));
ok('C3: diagnosis builder labels derived interpretation summary', diagnosisBuilderSource.includes('Derived interpretation summary'));
ok('C4: diagnosis builder labels compact summaries as sink-only', diagnosisBuilderSource.includes('Derived compact summaries are sink-only'));

console.log('\nD. obvious reverse-dependency risk guard');
ok(
  'D1: auto-progression does not import trace/debug/export sink helpers',
  hasNoLiveTruthImport(autoProgressionSource, [
    'camera-trace',
    'camera-trace-storage',
    'camera-trace-bundle',
    'TraceDebugPanel',
    'getStoredRecent',
    'getRecentAttempts',
    'getRecentCaptureSessionBundles',
  ])
);
ok(
  'D2: squat page does not import trace storage internals as live truth',
  hasNoLiveTruthImport(squatPageSource, [
    'camera-trace-storage',
    'TRACE_STORAGE_KEY',
    'OBSERVATION_STORAGE_KEY',
    'getStoredRecent',
    'pushStoredAttemptSnapshot',
  ])
);
ok(
  'D3: squat page bundle getters stay dev-window tooling, not direct branch predicates',
  squatPageSource.includes('if (!IS_DEV || typeof window') &&
    squatPageSource.includes('__MOVE_RE_CAMERA_TRACE__') &&
    !/if\s*\([^)]*getRecentCaptureSessionBundles/.test(squatPageSource)
);

console.log(`\nPR-RF-STRUCT-11E-2 smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
