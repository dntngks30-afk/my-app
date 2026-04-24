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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
