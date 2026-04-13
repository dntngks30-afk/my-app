/**
 * PR-RF-STRUCT-11E smoke guard: observability sink-only cleanup.
 *
 * Run:
 *   npx tsx scripts/camera-rf-struct-11e-observability-sink-only-cleanup-smoke.mjs
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

const traceTypeSource = readFileSync('src/lib/camera/camera-trace.ts', 'utf8');
const diagnosisBuilderSource = readFileSync(
  'src/lib/camera/trace/camera-trace-diagnosis-summary.ts',
  'utf8'
);
const debugPanelSource = readFileSync('src/components/camera/TraceDebugPanel.tsx', 'utf8');

console.log('\nA. Trace type exposes sink-only provenance envelope (no runtime gate rewiring)');
ok(
  'A1: passChainProvenance field exists on squatCycle',
  traceTypeSource.includes('passChainProvenance?: {') ||
    traceTypeSource.includes('passChainProvenance?: SquatPassChainProvenance;')
);
ok('A2: owner source label locked to runtime_completion_owner', traceTypeSource.includes("ownerReasonSource: 'runtime_completion_owner';"));
ok('A3: gate source label locked to runtime_ui_gate', traceTypeSource.includes("gateReasonSource: 'runtime_ui_gate';"));
ok('A4: latch source label locked to runtime_final_latch', traceTypeSource.includes("latchSource: 'runtime_final_latch';"));
ok('A5: sink-only marker exists', traceTypeSource.includes('sinkOnly: true;'));

console.log('\nB. Diagnosis summary stamps provenance as additive observability-only data');
ok('B1: passChainProvenance assignment exists', diagnosisBuilderSource.includes('passChainProvenance: {'));
ok('B2: diagnosis builder stamps sinkOnly true', diagnosisBuilderSource.includes('sinkOnly: true,'));

console.log('\nC. Debug panel separates owner/gate/latch display with provenance labels');
ok('C1: ownerReason/gateReason/latch split line exists', debugPanelSource.includes('ownerReason={d.squatCycle.completionOwnerReason'));
ok('C2: provenance line renders source labels', debugPanelSource.includes('provenance owner={d.squatCycle.passChainProvenance?.ownerReasonSource'));

console.log(`\nPR-RF-STRUCT-11E observability sink-only smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
