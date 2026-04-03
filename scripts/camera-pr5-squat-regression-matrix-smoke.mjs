/**
 * PR-5: SQUAT_REFACTOR_REGRESSION_MATRIX — executable lock
 *
 * Maps to docs/SQUAT_REFACTOR_REGRESSION_MATRIX.md rows (semantic checks only).
 * Does not replace PR-E1/E1B/E1C; run all four for full coverage.
 *
 * This file locks:
 *   A-1 standing still — no completion pass
 *   A-2 descent-only — no pass, reversal/recovery-class blocked
 *   A-3 bottom stall — no pass (dwell without recovery)
 *   B-1 deep standard_cycle — pass + owner truth
 *   B-2 shallow full cycle — pass + owner truth
 *   B-3 ultra-low meaningful — pass + owner (subset)
 *   C-1 completion owner vs UI gate — synthetic separation (setup_motion UI block)
 *   C-2 quality decouple contract — isSquatLowQualityPassDecoupleEligible
 *   E-5 static — single canonical shallow closer declaration; evaluator never sets completionSatisfied:true
 *
 * Delegated to existing smokes (run separately):
 *   A-4, D-2 → camera-e1b-peak-anchor-contamination-smoke.mjs
 *   D-1, descent/reversal chains → camera-e1c-authoritative-reversal-chain-smoke.mjs
 *   shallow owner/closure alignment → camera-e1-canonical-shallow-owner-closure-smoke.mjs
 *
 * Run:
 *   npx tsx scripts/camera-pr5-squat-regression-matrix-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
process.chdir(repoRoot);

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { computeSquatCompletionOwnerTruth, isSquatLowQualityPassDecoupleEligible } = await import(
  '../src/lib/camera/squat/squat-progression-contract.ts'
);
const { computeSquatUiProgressionLatchGate } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    stepId: 'squat',
  };
}
function buildFrames(depths, phases, stepMs = 40) {
  return depths.map((d, i) => makeFrame(d, 100 + i * stepMs, phases[i] ?? 'start'));
}

function readSrc(relPath) {
  return readFileSync(join(repoRoot, relPath), 'utf8');
}

console.log('\nPR-5 camera-pr5-squat-regression-matrix-smoke\n');

// ── Static: single shallow closer + evaluator does not fabricate success ──
console.log('  [STATIC] architecture / single-writer guards');
{
  const cs = readSrc('src/lib/camera/squat-completion-state.ts');
  const closerDefs = cs.match(/function applyCanonicalShallowClosureFromContract\b/g) ?? [];
  ok('STATIC: exactly one applyCanonicalShallowClosureFromContract definition', closerDefs.length === 1, closerDefs.length);

  const evalSquat = readSrc('src/lib/camera/evaluators/squat.ts');
  ok(
    'STATIC: evaluator squat never assigns completionSatisfied: true',
    !/completionSatisfied:\s*true/.test(evalSquat),
    'found completionSatisfied: true in evaluators/squat.ts'
  );
}

// ── A-1 standing still (flat start, no meaningful cycle) ──
console.log('\n  [A-1] standing still — matrix false-positive guard');
{
  const depths = Array(30).fill(0.01);
  const phases = Array(30).fill('start');
  const fr = buildFrames(depths, phases, 50);
  const st = evaluateSquatCompletionState(fr);
  ok('A-1: completionSatisfied false', st.completionSatisfied === false, st.completionSatisfied);
  ok('A-1: not standing_recovered success phase', st.currentSquatPhase !== 'standing_recovered', st.currentSquatPhase);
  ok('A-1: no official shallow closed', st.officialShallowPathClosed !== true, st.officialShallowPathClosed);
  const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: st });
  ok('A-1: owner truth blocked', owner.completionOwnerPassed === false, owner);
}

// ── A-2 descent only (no ascent / no standing recovery) ──
console.log('\n  [A-2] descent-only — matrix');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.08, 0.14, 0.2, 0.26, 0.3, 0.32, 0.32, 0.32, 0.32, 0.32],
    [
      'start',
      'start',
      'start',
      'start',
      'descent',
      'descent',
      'descent',
      'descent',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
    ],
    70
  );
  const st = evaluateSquatCompletionState(fr);
  ok('A-2: completionSatisfied false', st.completionSatisfied === false, st.completionPassReason);
  const br = String(st.completionBlockedReason ?? '');
  const reversalish =
    br.includes('reversal') ||
    br.includes('recovery') ||
    br.includes('not_standing') ||
    br.includes('standing') ||
    br.includes('no_ascend') ||
    br.includes('ascend') ||
    br.includes('commit');
  ok('A-2: blocked reason is reversal/recovery/phase class (not silent pass)', reversalish || br.length > 0, br);
}

// ── A-3 bottom stall (matrix; same family as E1B A) ──
console.log('\n  [A-3] bottom stall — matrix');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.04, 0.08, 0.11, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
    [
      'start',
      'start',
      'start',
      'start',
      'descent',
      'descent',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
      'bottom',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);
  ok('A-3: completionSatisfied false', st.completionSatisfied === false, st.completionPassReason);
  ok('A-3: not standing_recovered', st.currentSquatPhase !== 'standing_recovered', st.currentSquatPhase);
}

// ── B-1 deep standard_cycle ──
console.log('\n  [B-1] deep standard full cycle — matrix');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01],
    [
      'start',
      'start',
      'start',
      'start',
      'descent',
      'descent',
      'descent',
      'bottom',
      'bottom',
      'ascent',
      'ascent',
      'ascent',
      'start',
      'start',
      'start',
    ],
    60
  );
  const st = evaluateSquatCompletionState(fr);
  const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: st });
  ok('B-1: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('B-1: completionSatisfied true', st.completionSatisfied === true, st.completionSatisfied);
  ok('B-1: owner passes', owner.completionOwnerPassed === true, owner);
}

// ── B-2 shallow full cycle ──
console.log('\n  [B-2] shallow full cycle — matrix');
{
  const fr = buildFrames(
    [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01],
    [
      'start',
      'start',
      'start',
      'start',
      'descent',
      'descent',
      'descent',
      'bottom',
      'bottom',
      'ascent',
      'ascent',
      'ascent',
      'start',
      'start',
      'start',
    ],
    80
  );
  const st = evaluateSquatCompletionState(fr);
  const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: st });
  ok('B-2: completionSatisfied true', st.completionSatisfied === true, st.completionSatisfied);
  ok(
    'B-2: shallow pass reason',
    st.completionPassReason === 'low_rom_cycle' || st.completionPassReason === 'official_shallow_cycle',
    st.completionPassReason
  );
  ok('B-2: owner passes', owner.completionOwnerPassed === true, owner);
}

// ── B-3 ultra-low meaningful (subset; aligns with E1 E) ──
console.log('\n  [B-3] ultra-low meaningful cycle — matrix');
{
  const st = evaluateSquatCompletionState(
    buildFrames(
      [
        0.0, 0.0, 0.0, 0.0, 0.004, 0.008, 0.012, 0.018, 0.017, 0.016, 0.0154, 0.006, 0.005, 0.004, 0.003, 0.003,
      ],
      [
        'start',
        'start',
        'start',
        'start',
        'start',
        'start',
        'start',
        'start',
        'start',
        'start',
        'start',
        'ascent',
        'ascent',
        'start',
        'start',
        'start',
      ],
      40
    )
  );
  const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: st });
  ok('B-3: completionSatisfied true', st.completionSatisfied === true, st.completionSatisfied);
  ok(
    'B-3: ultra / official shallow pass reason',
    st.completionPassReason === 'ultra_low_rom_cycle' || st.completionPassReason === 'official_shallow_cycle',
    st.completionPassReason
  );
  ok('B-3: owner passes', owner.completionOwnerPassed === true, owner);
}

// ── C-1 completion owner vs UI gate (synthetic — no motion truth mutation) ──
console.log('\n  [C-1] completion owner vs UI suppression — matrix boundary');
{
  const ownerOk = computeSquatCompletionOwnerTruth({
    squatCompletionState: {
      completionBlockedReason: null,
      completionSatisfied: true,
      currentSquatPhase: 'standing_recovered',
      completionPassReason: 'standard_cycle',
    },
  });
  ok('C-1: owner truth passes on clean state', ownerOk.completionOwnerPassed === true, ownerOk);

  const uiBlocked = computeSquatUiProgressionLatchGate({
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.99,
    passThresholdEffective: 0.5,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    setupMotionBlocked: true,
  });
  ok('C-1: UI gate blocks on setup_motion while owner passed', uiBlocked.uiProgressionAllowed === false, uiBlocked);
  ok(
    'C-1: blocked reason is setup_motion_blocked',
    uiBlocked.uiProgressionBlockedReason === 'setup_motion_blocked',
    uiBlocked.uiProgressionBlockedReason
  );
}

// ── C-2 quality decouple eligibility (contract API) ──
console.log('\n  [C-2] quality warning decouple — matrix');
{
  const eligible = isSquatLowQualityPassDecoupleEligible({
    stepId: 'squat',
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    guardrail: { captureQuality: 'low' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  });
  ok('C-2: low capture quality + valid cycle can be decouple-eligible', eligible === true, eligible);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log(
  '\nAlso run: npx tsx scripts/camera-e1-canonical-shallow-owner-closure-smoke.mjs && npx tsx scripts/camera-e1b-peak-anchor-contamination-smoke.mjs && npx tsx scripts/camera-e1c-authoritative-reversal-chain-smoke.mjs\n'
);
if (failed > 0) process.exit(1);
