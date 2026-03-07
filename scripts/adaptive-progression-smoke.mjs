/**
 * PR-P2-3: Adaptive progression smoke test (deriveAdaptiveModifiers only, no DB)
 * Run: npx tsx scripts/adaptive-progression-smoke.mjs
 * Note: deriveAdaptiveModifiers is pure; loadRecentAdaptiveSignals needs Supabase env.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { deriveAdaptiveModifiers } = await import('../src/lib/session/adaptive-progression.ts');

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

console.log('Adaptive progression smoke test\n');

// 1) No feedback → none
const noFeedback = deriveAdaptiveModifiers([], [], []);
ok('no feedback returns none', noFeedback.reason === 'none');
ok('no feedback targetLevelDelta 0', noFeedback.targetLevelDelta === 0);
ok('no feedback empty avoid', noFeedback.avoidExerciseKeys.length === 0);

// 2) Empty source sessions → none
const emptySource = deriveAdaptiveModifiers(
  [{ session_number: 3, pain_after: 8 }],
  [],
  []
);
ok('empty source_sessions returns none', emptySource.reason === 'none');

// 3) Pain flare (pain_after >= 5)
const painFlare = deriveAdaptiveModifiers(
  [{ session_number: 2, pain_after: 6 }],
  [],
  [2]
);
ok('pain_after >= 5 triggers pain_flare', painFlare.reason === 'pain_flare');
ok('pain_flare targetLevelDelta -1', painFlare.targetLevelDelta === -1);
ok('pain_flare forceShort', painFlare.forceShort === true);
ok('pain_flare forceRecovery', painFlare.forceRecovery === true);

// 4) Pain flare via exercise pain_delta
const painFlareEx = deriveAdaptiveModifiers(
  [],
  [{ session_number: 2, exercise_key: 't1', pain_delta: 3 }],
  [2]
);
ok('exercise pain_delta >= 2 triggers pain_flare', painFlareEx.reason === 'pain_flare');

// 5) Low tolerance (completion < 0.6)
const lowTol = deriveAdaptiveModifiers(
  [{ session_number: 2, completion_ratio: 0.5 }],
  [],
  [2]
);
ok('low completion triggers low_tolerance', lowTol.reason === 'low_tolerance');
ok('low_tolerance targetLevelDelta -1', lowTol.targetLevelDelta === -1);
ok('low_tolerance forceShort', lowTol.forceShort === true);
ok('low_tolerance no forceRecovery', lowTol.forceRecovery === false);

// 6) Low tolerance via too_hard
const lowTolHard = deriveAdaptiveModifiers(
  [{ session_number: 2, difficulty_feedback: 'too_hard' }],
  [],
  [2]
);
ok('too_hard triggers low_tolerance', lowTolHard.reason === 'low_tolerance');

// 7) Low tolerance via high RPE
const lowTolRpe = deriveAdaptiveModifiers(
  [{ session_number: 2, overall_rpe: 9 }],
  [],
  [2]
);
ok('RPE >= 8 triggers low_tolerance', lowTolRpe.reason === 'low_tolerance');

// 8) High tolerance (2 sessions, high completion, low RPE, no pain)
const highTol = deriveAdaptiveModifiers(
  [
    { session_number: 2, completion_ratio: 0.95, overall_rpe: 3, pain_after: 1 },
    { session_number: 1, completion_ratio: 0.92, overall_rpe: 4, pain_after: 0 },
  ],
  [],
  [1, 2]
);
ok('high completion + low RPE triggers high_tolerance', highTol.reason === 'high_tolerance');
ok('high_tolerance targetLevelDelta +1', highTol.targetLevelDelta === 1);
ok('high_tolerance no forceShort', highTol.forceShort === false);
ok('high_tolerance no forceRecovery', highTol.forceRecovery === false);

// 9) Priority: pain_flare over high_tolerance
const both = deriveAdaptiveModifiers(
  [
    { session_number: 2, completion_ratio: 0.95, pain_after: 6 },
    { session_number: 1, completion_ratio: 0.92 },
  ],
  [],
  [1, 2]
);
ok('pain_flare takes priority over high_tolerance', both.reason === 'pain_flare');

// 10) Problem exercise keys
const withProblems = deriveAdaptiveModifiers(
  [{ session_number: 2, pain_after: 6 }],
  [
    { session_number: 2, exercise_key: 'bad-tpl', pain_delta: 3 },
    { session_number: 2, exercise_key: 'bad-tpl', skipped: true },
  ],
  [2]
);
ok('pain_flare includes problem exercise in avoid', withProblems.avoidExerciseKeys.includes('bad-tpl'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
