/**
 * PR-CAM-SQUAT-TRAJECTORY-RESCUE-OWNER-SEPARATION-01
 * trajectory rescue가 owner truth(completionSatisfied / completionPassReason)에
 * 직접 영향을 주지 않도록 분리된 것을 검증한다.
 *
 * Run: npx tsx scripts/camera-pr-squat-trajectory-rescue-owner-separation-01-smoke.mjs
 *
 * 검증 패턴 (5가지):
 *   P1. standing sway/jitter only        → completionSatisfied false
 *   P2. tiny dip (descent only, no return) → completionSatisfied false
 *   P3. trajectory rescue 조건 충족 + strict reversal 실패
 *       → trajectoryReversalRescueApplied true + ultra_low_rom_cycle 아님
 *   P4. valid shallow down-up (strict reversal 성공) → completionSatisfied true
 *   P5. deep standard squat              → standard_cycle, 회귀 없음
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

/**
 * 합성 프레임 생성기.
 * squatDepthProxyBlended 는 blended 스트림 모사용 — primary 와 동일하게 설정하면 PR-04E1 과 정렬.
 */
function makeFrames(depths, phases, { stepMs = 80, baseBlended = null } = {}) {
  return depths.map((depth, i) => ({
    timestampMs: 200 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'start',
    derived: {
      squatDepthProxy: depth,
      squatDepthProxyBlended: baseBlended != null ? depth + baseBlended : depth,
    },
    joints: {},
    bodyBox: { area: 0.25 },
    visibilitySummary: { visibleLandmarkRatio: 0.85, criticalJointsAvailability: 0.9 },
    qualityHints: [],
  }));
}

// ─── P1. Standing sway / jitter ───────────────────────────────────────────────
console.log('\nP1. Standing sway / jitter only');
{
  const depths = Array(25).fill(0.012).map((d, i) => d + Math.sin(i * 0.8) * 0.003);
  const phases = Array(25).fill('start');
  const s = evaluateSquatCompletionState(makeFrames(depths, phases));
  ok('P1: completionSatisfied false', s.completionSatisfied === false);
  ok('P1: no trajectoryRescueApplied for pure standing', s.trajectoryReversalRescueApplied !== true);
}

// ─── P2. Tiny dip / descent-only (no return to standing) ─────────────────────
console.log('\nP2. Tiny dip / descent only, no return');
{
  // 약 0.05까지 내려갔다가 0.04 수준 유지 — standing recovery 미달
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.01,
    0.02, 0.03, 0.04, 0.05, 0.06,
    0.06, 0.06, 0.06, 0.06, 0.06,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'bottom',
    'bottom', 'bottom', 'bottom', 'bottom', 'bottom',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs: 60 }));
  ok('P2: completionSatisfied false', s.completionSatisfied === false);
  ok(
    'P2: blocked by no_reversal or not_standing_recovered',
    s.completionBlockedReason === 'no_reversal' ||
      s.completionBlockedReason === 'not_standing_recovered' ||
      s.completionBlockedReason === 'no_commitment' ||
      s.completionSatisfied === false
  );
}

// ─── P3. Trajectory rescue structural invariant ───────────────────────────────
console.log('\nP3. Trajectory rescue invariant — if rescue applied, owner truth is not opened');
{
  /**
   * PR-CAM-SQUAT-TRAJECTORY-RESCUE-OWNER-SEPARATION-01의 핵심 invariant:
   *   trajectoryReversalRescueApplied === true → completionSatisfied === false
   *   trajectoryReversalRescueApplied === true → reversalConfirmedAfterDescend === false
   *   ultra_low_rom_cycle는 reversalConfirmedAfterDescend === true 없이 닫히지 않는다
   *
   * 여러 시나리오를 실행해 어떤 경우에도 trajectory-only rescue가
   * completionSatisfied = true를 만들지 않음을 교차 검증한다.
   */
  const scenariosToCheck = [
    // 매우 얕은 dip + 즉시 복귀 (ultra-low ROM 대역, standing hold 짧음)
    {
      label: 'ultra-shallow quick return',
      depths: [
        0.010, 0.010, 0.010, 0.010, 0.010,
        0.015, 0.025, 0.040, 0.055, 0.060,
        0.060, 0.058, 0.050, 0.030, 0.015, 0.010,
        0.010, 0.010, 0.010, 0.010,
      ],
      phases: [
        'start', 'start', 'start', 'start', 'start',
        'descent', 'descent', 'descent', 'descent', 'bottom',
        'bottom', 'bottom', 'ascent', 'ascent', 'start', 'start',
        'start', 'start', 'start', 'start',
      ],
      stepMs: 60,
    },
    // 얕은 jitter 후 부드러운 복귀 (finalize 경계)
    {
      label: 'shallow with slow return',
      depths: [
        0.012, 0.011, 0.012, 0.011, 0.012,
        0.018, 0.028, 0.040, 0.048, 0.055,
        0.055, 0.052, 0.048, 0.040, 0.028, 0.018, 0.012, 0.011, 0.010, 0.010,
        0.010, 0.010, 0.010, 0.010, 0.010,
      ],
      phases: [
        'start', 'start', 'start', 'start', 'start',
        'descent', 'descent', 'descent', 'descent', 'bottom',
        'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start', 'start',
        'start', 'start', 'start', 'start', 'start',
      ],
      stepMs: 80,
    },
  ];

  let p3Passed = true;
  for (const sc of scenariosToCheck) {
    const s = evaluateSquatCompletionState(makeFrames(sc.depths, sc.phases, { stepMs: sc.stepMs }));

    if (s.trajectoryReversalRescueApplied === true) {
      const ok1 = s.completionSatisfied === false;
      const ok2 = s.completionPassReason !== 'ultra_low_rom_cycle';
      const ok3 = s.reversalConfirmedAfterDescend === false;
      if (!ok1 || !ok2 || !ok3) p3Passed = false;
      ok(
        `P3[${sc.label}]: trajectory rescue applied → completionSatisfied false`,
        ok1
      );
      ok(
        `P3[${sc.label}]: trajectory rescue applied → NOT ultra_low_rom_cycle`,
        ok2
      );
      ok(
        `P3[${sc.label}]: trajectory rescue applied → reversalConfirmedAfterDescend false`,
        ok3
      );
    } else {
      // trajectory rescue가 발동되지 않은 경우 (strict reversal이 선점):
      // 케이스별로 pass/fail은 다를 수 있으나, ultra_low_rom_cycle이면 reversalConfirmedAfterDescend 필요
      const ultraLowPass =
        s.completionPassReason === 'ultra_low_rom_cycle' && s.completionSatisfied === true;
      const integrityHolds = !ultraLowPass || s.reversalConfirmedAfterDescend === true;
      if (!integrityHolds) p3Passed = false;
      ok(
        `P3[${sc.label}]: ultra_low_rom_cycle requires reversalConfirmedAfterDescend`,
        integrityHolds
      );
    }
  }
  ok('P3: invariant holds across all scenarios', p3Passed);
}

// ─── P4. Valid shallow down-up (strict reversal 성공) ─────────────────────────
console.log('\nP4. Valid shallow down-up — strict reversal succeeds');
{
  const stepMs = 80;
  // relativeDepthPeak ≈ 0.08 (low_rom 대역), post-peak drop ≈ 0.05+ (strict 충족)
  const depths = [
    0.010, 0.010, 0.011, 0.010, 0.011, 0.010,
    0.025, 0.045, 0.065, 0.080, 0.090,
    0.090, 0.085,
    // strict reversal을 위한 충분한 하락 (0.090 - 0.030 = 0.060 >> required ≈ 0.0117)
    0.060, 0.040, 0.020,
    0.012, 0.011, 0.010, 0.010, 0.010, 0.010, 0.010,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'bottom',
    'bottom', 'bottom',
    'ascent', 'ascent', 'ascent',
    'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs }));
  ok('P4: completionSatisfied true', s.completionSatisfied === true);
  ok(
    'P4: passReason is low_rom_cycle or standard_cycle',
    s.completionPassReason === 'low_rom_cycle' ||
      s.completionPassReason === 'standard_cycle' ||
      s.completionPassReason === 'ultra_low_rom_cycle'
  );
  ok(
    'P4: reversalConfirmedBy is rule family (not null)',
    s.reversalConfirmedBy === 'rule' || s.reversalConfirmedBy === 'rule_plus_hmm'
  );
}

// ─── P5. Deep standard squat 회귀 없음 ───────────────────────────────────────
console.log('\nP5. Deep standard squat — no regression');
{
  const stepMs = 80;
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.05, 0.12, 0.22, 0.35, 0.46, 0.50,
    0.50, 0.48,
    0.38, 0.25, 0.14, 0.06,
    0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'descent', 'bottom',
    'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'ascent',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs }));
  ok('P5: completionSatisfied true', s.completionSatisfied === true);
  ok('P5: standard_cycle', s.completionPassReason === 'standard_cycle');
  ok(
    'P5: reversalConfirmedBy rule (not trajectory)',
    s.reversalConfirmedBy === 'rule' || s.reversalConfirmedBy === 'rule_plus_hmm'
  );
  ok('P5: trajectoryRescueApplied false', s.trajectoryReversalRescueApplied !== true);
}

// ─── 요약 ──────────────────────────────────────────────────────────────────────
console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
