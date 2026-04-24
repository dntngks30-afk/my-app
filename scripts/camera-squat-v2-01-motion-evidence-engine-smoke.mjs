/**
 * PR3 - SquatMotionEvidenceEngineV2 synthetic smoke.
 * Run: npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatMotionEvidenceV2 } = await import('../src/lib/camera/squat/squat-motion-evidence-v2.ts');

let passed = 0;
let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`);
  }
}

function framesFromDepths(depths, options = {}) {
  const {
    visible = true,
    lowerVisible = true,
    setup = false,
    upper = depths.map(() => 0),
    fps = 30,
    gapAfterIndex = null,
  } = options;
  let t = 0;
  return depths.map((depth, index) => {
    if (index > 0) t += 1000 / fps;
    if (gapAfterIndex !== null && index === gapAfterIndex + 1) t += 1400;
    return {
      timestampMs: t,
      depth,
      lowerBodySignal: depth,
      upperBodySignal: upper[index] ?? 0,
      bodyVisibleEnough: visible,
      lowerBodyVisibleEnough: lowerVisible,
      setupPhase: setup,
    };
  });
}

function expectDecision(name, frames, expected) {
  const decision = evaluateSquatMotionEvidenceV2(frames);
  ok(`${name}: usableMotionEvidence`, decision.usableMotionEvidence === expected.usableMotionEvidence, JSON.stringify(decision));
  ok(`${name}: motionPattern`, decision.motionPattern === expected.motionPattern, JSON.stringify(decision));
  ok(`${name}: blockReason`, decision.blockReason === expected.blockReason, JSON.stringify(decision));
  ok(`${name}: romBand`, decision.romBand === expected.romBand, JSON.stringify(decision));
  for (const [key, value] of Object.entries(expected.evidence ?? {})) {
    ok(`${name}: evidence.${key}`, decision.evidence[key] === value, JSON.stringify(decision));
  }
  if (expected.warningIncludes) {
    ok(
      `${name}: qualityWarnings includes ${expected.warningIncludes}`,
      decision.qualityWarnings.includes(expected.warningIncludes),
      JSON.stringify(decision)
    );
  }
}

console.log('SquatMotionEvidenceEngineV2 synthetic smoke\n');

expectDecision(
  'valid shallow down-up-return',
  framesFromDepths([0, 0.006, 0.026, 0.048, 0.058, 0.052, 0.034, 0.016, 0.007, 0.006]),
  {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    blockReason: null,
    romBand: 'shallow',
    warningIncludes: 'low_rom',
    evidence: {
      bodyVisibleEnough: true,
      lowerBodyMotionDominant: true,
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      sameRepOwnership: true,
      notMicroBounce: true,
      notUpperBodyOnly: true,
    },
  }
);

expectDecision(
  'valid deep down-up-return',
  framesFromDepths([0, 0.035, 0.16, 0.34, 0.52, 0.49, 0.31, 0.13, 0.026, 0.01, 0.008]),
  {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    blockReason: null,
    romBand: 'deep',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      sameRepOwnership: true,
    },
  }
);

expectDecision(
  'valid shallow short duration clear order',
  framesFromDepths([0, 0.04, 0.074, 0.052, 0.014, 0.009, 0.008], { fps: 60 }),
  {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    blockReason: null,
    romBand: 'shallow',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      sameRepOwnership: true,
    },
  }
);

expectDecision(
  'valid shallow with low_rom warning',
  framesFromDepths([0, 0.012, 0.03, 0.052, 0.06, 0.038, 0.014, 0.007, 0.007]),
  {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    blockReason: null,
    romBand: 'shallow',
    warningIncludes: 'low_rom',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      sameRepOwnership: true,
    },
  }
);

expectDecision(
  'standing only',
  framesFromDepths([0, 0.002, 0.001, 0.003, 0.001, 0.002, 0.001]),
  {
    usableMotionEvidence: false,
    motionPattern: 'standing_only',
    blockReason: 'no_meaningful_descent',
    romBand: 'micro',
    evidence: {
      meaningfulDescent: false,
      reversal: false,
      nearStartReturn: false,
      sameRepOwnership: false,
    },
  }
);

expectDecision(
  'seated only',
  framesFromDepths([0.48, 0.49, 0.485, 0.49, 0.48, 0.485]),
  {
    usableMotionEvidence: false,
    motionPattern: 'bottom_hold',
    blockReason: 'no_return_to_start',
    romBand: 'micro',
    evidence: {
      meaningfulDescent: false,
      nearStartReturn: false,
    },
  }
);

expectDecision(
  'setup/readiness alignment only',
  framesFromDepths([0, 0.01, 0.02, 0.014, 0.006, 0.003], { setup: true }),
  {
    usableMotionEvidence: false,
    motionPattern: 'setup_only',
    blockReason: 'setup_phase_only',
    romBand: 'micro',
    evidence: {
      notSetupPhase: false,
      meaningfulDescent: false,
    },
  }
);

expectDecision(
  'arm movement only',
  framesFromDepths([0, 0.002, 0.003, 0.002, 0.003, 0.002], {
    upper: [0, 0.05, 0.12, 0.2, 0.12, 0.04],
  }),
  {
    usableMotionEvidence: false,
    motionPattern: 'upper_body_only',
    blockReason: 'lower_body_motion_not_dominant',
    romBand: 'micro',
    evidence: {
      lowerBodyMotionDominant: false,
      notUpperBodyOnly: false,
    },
  }
);

expectDecision(
  'upper body sway only',
  framesFromDepths([0, 0.004, 0.006, 0.005, 0.004, 0.003], {
    upper: [0.02, 0.09, 0.16, 0.1, 0.17, 0.08],
  }),
  {
    usableMotionEvidence: false,
    motionPattern: 'upper_body_only',
    blockReason: 'lower_body_motion_not_dominant',
    romBand: 'micro',
    evidence: {
      lowerBodyMotionDominant: false,
      notUpperBodyOnly: false,
    },
  }
);

expectDecision(
  'descent only',
  framesFromDepths([0, 0.018, 0.044, 0.076, 0.105, 0.13]),
  {
    usableMotionEvidence: false,
    motionPattern: 'descent_only',
    blockReason: 'no_reversal',
    romBand: 'standard',
    evidence: {
      meaningfulDescent: true,
      reversal: false,
      nearStartReturn: false,
    },
  }
);

expectDecision(
  'bottom hold only',
  framesFromDepths([0, 0.026, 0.072, 0.125, 0.15, 0.149, 0.148, 0.15]),
  {
    usableMotionEvidence: false,
    motionPattern: 'bottom_hold',
    blockReason: 'no_return_to_start',
    romBand: 'standard',
    evidence: {
      meaningfulDescent: true,
      reversal: false,
      nearStartReturn: false,
    },
  }
);

expectDecision(
  'incomplete return',
  framesFromDepths([0, 0.036, 0.1, 0.15, 0.13, 0.1, 0.078, 0.07]),
  {
    usableMotionEvidence: false,
    motionPattern: 'incomplete_return',
    blockReason: 'incomplete_return',
    romBand: 'standard',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: false,
    },
  }
);

expectDecision(
  'micro bounce',
  framesFromDepths([0, 0.006, 0.014, 0.021, 0.016, 0.008, 0.004]),
  {
    usableMotionEvidence: false,
    motionPattern: 'standing_only',
    blockReason: 'micro_bounce',
    romBand: 'micro',
    evidence: {
      meaningfulDescent: false,
      notMicroBounce: false,
    },
  }
);

expectDecision(
  'noisy mixed without same rep ownership',
  framesFromDepths([0, 0.032, 0.075, 0.038, 0.01, 0.009, 0.009], { gapAfterIndex: 2 }),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'same_rep_ownership_failed',
    romBand: 'shallow',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      sameRepOwnership: false,
    },
  }
);

expectDecision(
  'lower body not visible',
  framesFromDepths([0, 0.04, 0.09, 0.05, 0.01, 0.008], { lowerVisible: false }),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'body_not_visible',
    romBand: 'shallow',
    evidence: {
      bodyVisibleEnough: false,
    },
  }
);

expectDecision(
  'body visibility too low',
  framesFromDepths([0, 0.04, 0.09, 0.05, 0.01, 0.008], { visible: false }),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'body_not_visible',
    romBand: 'shallow',
    evidence: {
      bodyVisibleEnough: false,
    },
  }
);

// ── PR5-FIX-2 temporal closure guard cases ─────────────────────────────────

console.log('\n── PR5-FIX-2 temporal closure guard cases ──\n');

expectDecision(
  'descent_start_only_must_fail',
  // User has just started descending: meaningful depth but no reversal yet.
  // Must NOT pass: reversal=false, nearStartReturn=false.
  framesFromDepths([0, 0.005, 0.012, 0.026, 0.042, 0.055, 0.07]),
  {
    usableMotionEvidence: false,
    motionPattern: 'descent_only',
    blockReason: 'no_reversal',
    romBand: 'shallow',
    evidence: {
      meaningfulDescent: true,
      reversal: false,
      nearStartReturn: false,
      temporalClosureSatisfied: false,
      activeAttemptWindowSatisfied: true,
    },
  }
);

expectDecision(
  'early_descent_no_reversal_must_fail',
  // Strong descent with no upward reversal signal — still descending.
  framesFromDepths([0, 0.02, 0.055, 0.11, 0.18, 0.26]),
  {
    usableMotionEvidence: false,
    motionPattern: 'descent_only',
    blockReason: 'no_reversal',
    romBand: 'standard',
    evidence: {
      meaningfulDescent: true,
      reversal: false,
      nearStartReturn: false,
    },
  }
);

expectDecision(
  'descent_then_partial_rise_no_return_must_fail',
  // Descent + partial reversal but has NOT returned to near-start yet.
  framesFromDepths([0, 0.036, 0.09, 0.15, 0.13, 0.095, 0.065, 0.055]),
  {
    usableMotionEvidence: false,
    motionPattern: 'incomplete_return',
    blockReason: 'incomplete_return',
    romBand: 'standard',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: false,
    },
  }
);

expectDecision(
  'near_start_without_prior_descent_return_must_fail',
  // Frames hover near start position with tiny fluctuations. No real descent.
  // nearStartReturn must NOT be triggered by initial standing frames.
  framesFromDepths([0, 0.003, 0.005, 0.003, 0.004, 0.002, 0.003]),
  {
    usableMotionEvidence: false,
    motionPattern: 'standing_only',
    blockReason: 'micro_bounce',
    romBand: 'micro',
    evidence: {
      meaningfulDescent: false,
      nearStartReturn: false,
      temporalClosureSatisfied: false,
    },
  }
);

// stale_buffer_closure_must_fail: frames span > MAX_SQUAT_CYCLE_MS (4500ms).
// Simulates the regression where setup/prior-attempt frames are in the buffer
// and the algorithm finds a stale complete cycle.
// fps=2 (500ms/frame) keeps gap < MAX_REP_FRAME_GAP_MS(750ms) while
// total duration (21 frames → returnMs=9500ms) exceeds MAX_SQUAT_CYCLE_MS(4500ms).
// The staleAfterReturnIndex=20 = lastFrameIndex → closureFreshAtTail=true (tail distance=0ms).
// Caught by the attempt-duration cap, not the tail freshness check.
expectDecision(
  'stale_buffer_closure_must_fail',
  framesFromDepths(
    [0, 0.04, 0.08, 0.07, 0.065, 0.062, 0.06, 0.058, 0.056, 0.054,
     0.052, 0.05, 0.048, 0.046, 0.044, 0.042, 0.04, 0.038, 0.036, 0.018, 0.012],
    { fps: 2 }
  ),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'attempt_duration_out_of_scope',
    romBand: 'shallow',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      closureFreshAtTail: true,
      activeAttemptWindowSatisfied: false,
      temporalClosureSatisfied: false,
    },
  }
);

expectDecision(
  'setup_or_readiness_motion_must_fail',
  // Setup/readiness motion only — setup phase flag is set.
  framesFromDepths([0, 0.01, 0.025, 0.018, 0.008, 0.004], { setup: true }),
  {
    usableMotionEvidence: false,
    motionPattern: 'setup_only',
    blockReason: 'setup_phase_only',
    romBand: 'micro',
    evidence: {
      notSetupPhase: false,
    },
  }
);

// ── PR5-FIX-3 attempt-epoch tail closure lock cases ───────────────────────
// All cases below test the stale_closure_not_at_tail guard:
// stableAfterReturnFrameIndex is far from the input tail (>400ms), meaning
// the detected complete cycle is a stale closure from past setup/positioning.

console.log('\n── PR5-FIX-3 attempt-epoch tail closure lock cases ──\n');

// Mimic real-device false positive case 1 (fail01.json):
// descentStartFrameIndex=0, slow rise over 10 frames, sharp drop at frame 10,
// stable at frame 11, then 13 more frames of new descent (tail at frame 24).
// tailDistanceMs = (24-11)*100ms = 1300ms >> MAX_TAIL_CLOSURE_LAG_MS(400ms) → FAIL.
{
  const rise01 = Array.from({ length: 10 }, (_, i) =>
    parseFloat((0.01 + i * 0.006).toFixed(3))
  ); // [0.010, 0.016, 0.022, 0.028, 0.034, 0.040, 0.046, 0.052, 0.058, 0.064]
  const depths01 = [
    ...rise01,
    0.020, // frame 10: reversal+return (sharp drop)
    0.008, // frame 11: stable after return (stableAfterReturnIndex=11)
    0.006, // frame 12: stable
    ...Array.from({ length: 12 }, (_, j) => parseFloat((0.006 + j * 0.003).toFixed(3))), // frames 13-24: new descent
  ];
  expectDecision(
    'real_device_false_pass_descent_start_01_must_fail',
    framesFromDepths(depths01, { fps: 10 }),
    {
      usableMotionEvidence: false,
      motionPattern: 'none',
      blockReason: 'stale_closure_not_at_tail',
      romBand: 'shallow',
      evidence: {
        meaningfulDescent: true,
        reversal: true,
        nearStartReturn: true,
        stableAfterReturn: true,
        closureFreshAtTail: false,
        preDescentBaselineSatisfied: false,
        activeAttemptWindowSatisfied: true,
        temporalClosureSatisfied: false,
      },
    }
  );
}

// Mimic real-device false positive case 2 (fail02.json):
// 12-frame slow rise, sharp drop at frame 12, stable at frame 13,
// then 11 more frames of new descent (tail at frame 24).
// tailDistanceMs = (24-13)*100ms = 1100ms > 400ms → FAIL.
{
  const rise02 = Array.from({ length: 12 }, (_, i) =>
    parseFloat((0.010 + i * 0.005).toFixed(3))
  ); // [0.010, 0.015, ..., 0.065]
  const depths02 = [
    ...rise02,
    0.022, // frame 12: reversal+return
    0.008, // frame 13: stable after return (stableAfterReturnIndex=13)
    0.006, // frame 14: stable
    ...Array.from({ length: 10 }, (_, j) => parseFloat((0.006 + j * 0.003).toFixed(3))), // frames 15-24: new descent
  ];
  expectDecision(
    'real_device_false_pass_descent_start_02_must_fail',
    framesFromDepths(depths02, { fps: 10 }),
    {
      usableMotionEvidence: false,
      motionPattern: 'none',
      blockReason: 'stale_closure_not_at_tail',
      romBand: 'shallow',
      evidence: {
        meaningfulDescent: true,
        reversal: true,
        nearStartReturn: true,
        stableAfterReturn: true,
        closureFreshAtTail: false,
        preDescentBaselineSatisfied: false,
        activeAttemptWindowSatisfied: true,
        temporalClosureSatisfied: false,
      },
    }
  );
}

// descent_start_frame_zero_must_fail:
// Complete cycle at the very start of the buffer (startIndex=0, no baseline),
// followed by 22 frames of standing. The closure is 22*33ms=726ms before tail.
// tailDistanceMs > 400ms → stale_closure_not_at_tail.
expectDecision(
  'descent_start_frame_zero_must_fail',
  framesFromDepths(
    [0, 0.04, 0.07, 0.04, 0.02, 0.01, 0.008, ...Array.from({ length: 22 }, () => 0.008)],
  ),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'stale_closure_not_at_tail',
    romBand: 'shallow',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      closureFreshAtTail: false,
      preDescentBaselineSatisfied: false,
      temporalClosureSatisfied: false,
    },
  }
);

// reversal_return_same_frame_must_fail:
// Sharp drop causes reversal and return to land on the same frame (frame 3).
// 22 standing frames after → tailDistanceMs ≈ 22*33ms=726ms > 400ms → FAIL.
expectDecision(
  'reversal_return_same_frame_must_fail',
  framesFromDepths(
    [0, 0.04, 0.08, 0.01, 0.006, ...Array.from({ length: 22 }, () => 0.006)],
  ),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'stale_closure_not_at_tail',
    romBand: 'shallow',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      closureFreshAtTail: false,
      temporalClosureSatisfied: false,
    },
  }
);

// stale_closure_not_at_tail_must_fail:
// Explicit test: complete cycle (cycle < 4500ms so duration cap won't fire),
// followed by 20 standing frames → tailDistanceMs ≈ 20*33ms=660ms > 400ms → FAIL.
// This verifies the tail-freshness guard fires independently of the cycle-duration cap.
expectDecision(
  'stale_closure_not_at_tail_must_fail',
  framesFromDepths(
    [0, 0.03, 0.09, 0.15, 0.12, 0.06, 0.01, 0.006, ...Array.from({ length: 20 }, () => 0.006)],
  ),
  {
    usableMotionEvidence: false,
    motionPattern: 'none',
    blockReason: 'stale_closure_not_at_tail',
    romBand: 'standard',
    evidence: {
      meaningfulDescent: true,
      reversal: true,
      nearStartReturn: true,
      stableAfterReturn: true,
      closureFreshAtTail: false,
      activeAttemptWindowSatisfied: true,
      temporalClosureSatisfied: false,
    },
  }
);

// setup_positioning_then_stand_then_later_descent_start_must_fail:
// Simulates the full regression pattern: positioning motion in frames 0-6
// (rise+fall, peak=0.12), standing frames 7-19, new descent frames 20-24.
// stableAfterReturnIndex≈7, lastFrameIndex=24, tailDistanceMs≈17*100ms=1700ms > 400ms → FAIL.
{
  const positioningMotion = [0.01, 0.03, 0.07, 0.12, 0.09, 0.05, 0.02, 0.01, 0.01, 0.01];
  const standingFrames = Array.from({ length: 10 }, () => 0.01);
  const newDescent = [0.01, 0.02, 0.03, 0.04, 0.05];
  expectDecision(
    'setup_positioning_then_stand_then_later_descent_start_must_fail',
    framesFromDepths([...positioningMotion, ...standingFrames, ...newDescent], { fps: 10 }),
    {
      usableMotionEvidence: false,
      motionPattern: 'none',
      blockReason: 'stale_closure_not_at_tail',
      romBand: 'shallow',
      evidence: {
        meaningfulDescent: true,
        reversal: true,
        nearStartReturn: true,
        stableAfterReturn: true,
        closureFreshAtTail: false,
        preDescentBaselineSatisfied: false,
        temporalClosureSatisfied: false,
      },
    }
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
