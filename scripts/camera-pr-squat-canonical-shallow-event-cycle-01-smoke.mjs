/**
 * PR-CAM-SQUAT-CANONICAL-SHALLOW-EVENT-CYCLE-01
 *
 * Run:
 *   npx tsx scripts/camera-pr-squat-canonical-shallow-event-cycle-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { detectSquatEventCycle } = await import(
  '../src/lib/camera/squat/squat-event-cycle.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

function makeFrames(depths, phases, { stepMs = 80 } = {}) {
  return depths.map((depth, i) => ({
    timestampMs: 200 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'start',
    derived: {
      squatDepthProxy: depth,
      squatDepthProxyBlended: depth,
    },
  }));
}

console.log('\nP1. standing jitter should NOT detect');
{
  const depths = Array(16).fill(0.012).map((d, i) => d + Math.sin(i * 0.8) * 0.002);
  const phases = Array(16).fill('start');
  const s = detectSquatEventCycle(makeFrames(depths, phases), {
    baselineFrozenDepth: 0,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 8,
    lockedSource: 'primary',
  });
  ok('P1: detected false', s.detected === false);
}

console.log('\nP2. shallow real down-up should detect via canonical fallback');
{
  const depths = [
    0.00, 0.00, 0.01, 0.02, 0.03,
    0.04, 0.05, 0.058,
    0.052, 0.040, 0.028, 0.018, 0.010,
    0.009, 0.008, 0.008,
  ];
  const phases = [
    'start','start','descent','descent','descent',
    'bottom','bottom','bottom',
    'ascent','ascent','ascent','start','start',
    'start','start','start',
  ];
  const s = detectSquatEventCycle(makeFrames(depths, phases), {
    baselineFrozenDepth: 0,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 7,
    lockedSource: 'primary',
  });
  ok('P2: detected true', s.detected === true);
  ok('P2: ultra_low_rom', s.band === 'ultra_low_rom');
  ok(
    'P2: canonical fallback note',
    Array.isArray(s.notes) && s.notes.includes('descent_structural_cycle_canonical_fallback')
  );
}

console.log('\nP3. too-early peak should NOT detect');
{
  const depths = [0.00, 0.03, 0.058, 0.04, 0.02, 0.01, 0.008, 0.008];
  const phases = ['start','descent','bottom','ascent','ascent','start','start','start'];
  const s = detectSquatEventCycle(makeFrames(depths, phases), {
    baselineFrozenDepth: 0,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 2,
    lockedSource: 'primary',
  });
  ok('P3: detected false', s.detected === false);
}

console.log('\nP4. deep standard should stay out of shallow event band');
{
  const depths = [0.00,0.08,0.18,0.35,0.50,0.70,0.50,0.25,0.08,0.02,0.01];
  const phases = ['start','descent','descent','descent','bottom','bottom','ascent','ascent','ascent','start','start'];
  const s = detectSquatEventCycle(makeFrames(depths, phases), {
    baselineFrozenDepth: 0,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 5,
    lockedSource: 'primary',
  });
  ok('P4: shallow band not detected', s.band === null && s.detected === false);
}

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
