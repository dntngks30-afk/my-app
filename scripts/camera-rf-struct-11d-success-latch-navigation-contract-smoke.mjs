/**
 * PR-RF-STRUCT-11D smoke guard: squat success latch ↔ page navigation contract.
 *
 * Run:
 *   npx tsx scripts/camera-rf-struct-11d-success-latch-navigation-contract-smoke.mjs
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

const source = readFileSync('src/app/movement-test/camera/squat/page.tsx', 'utf8');

console.log('\nA. Domain latch -> page latch -> scheduling -> route execution chain markers');
ok('A1: domain latch consumer marker exists', source.includes('const domainLatchOpen = effectivePassLatched;'));
ok('A2: page success-event latch marker exists', source.includes('const pageSuccessConsumedForStep = passLatchedStepKeyRef.current === currentStepKey;'));
ok('A3: route execution idempotency marker exists', source.includes('const routeAlreadyTriggeredForStep ='));

console.log('\nB. Route execution owner helper');
ok('B1: triggerLatchedNavigation helper exists', source.includes('const triggerLatchedNavigation = useCallback('));
ok('B2: helper guards current step latch consumption', source.includes('if (passLatchedStepKeyRef.current !== currentStepKey) return false;'));
ok('B3: helper guards route idempotency per step key', source.includes('if (triggeredAdvanceStepKeyRef.current === currentStepKey) return false;'));
ok('B4: helper performs actual route push', source.includes('router.push(nextPath);'));

console.log('\nC. Scheduling and modal hold are route-delay consumers only');
ok(
  'C1: auto-advance timer triggers route execution through helper only',
  source.includes("triggerLatchedNavigation('route_push_next_step');")
);
ok(
  'C2: debug modal close also consumes the same route execution helper',
  source.includes("triggerLatchedNavigation('debug_modal_closed');")
);

console.log('\nD. Existing route/timer contract unchanged');
ok('D1: auto-advance delay constant remains 700ms', source.includes('const SQUAT_AUTO_ADVANCE_MS = 700;'));
ok('D2: success path still routes with nextPath', source.includes('router.push(nextPath);'));

console.log(`\nPR-RF-STRUCT-11D success latch/navigation smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
