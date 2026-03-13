/**
 * PR-22: Adaptive explanation rules smoke test
 * Run: npx tsx scripts/adaptive-explanation-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  buildAdaptiveExplanationFromTrace,
  buildAdaptiveExplanationFromModifier,
  getSummaryForReason,
} = await import('../src/lib/session/adaptive-explanation.ts');

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

console.log('Adaptive explanation smoke test\n');

// 1) Trace: pain_flare
const painFlareTrace = {
  reason: 'pain_flare',
  source_sessions: [1, 2],
  applied_modifiers: { target_level_delta: -1, force_short: true, force_recovery: true },
};
const painFlareResult = buildAdaptiveExplanationFromTrace(painFlareTrace);
ok('pain_flare trace returns result', painFlareResult != null);
ok('pain_flare summary contains 회복', painFlareResult?.summary?.includes('회복') ?? false);
ok('pain_flare title is 세션 조정', painFlareResult?.title === '세션 조정');

// 2) Trace: low_tolerance
const lowTolTrace = { reason: 'low_tolerance', source_sessions: [2], applied_modifiers: { target_level_delta: -1 } };
const lowTolResult = buildAdaptiveExplanationFromTrace(lowTolTrace);
ok('low_tolerance trace returns result', lowTolResult != null);
ok('low_tolerance summary contains 강도', lowTolResult?.summary?.includes('강도') ?? false);

// 3) Trace: high_tolerance
const highTolTrace = { reason: 'high_tolerance', source_sessions: [1, 2], applied_modifiers: { target_level_delta: 1 } };
const highTolResult = buildAdaptiveExplanationFromTrace(highTolTrace);
ok('high_tolerance trace returns result', highTolResult != null);
ok('high_tolerance summary contains 올렸어요', highTolResult?.summary?.includes('올렸어요') ?? false);

// 4) Trace: none → null (no event triggers)
const noneTrace = { reason: 'none', source_sessions: [], applied_modifiers: { target_level_delta: 0 } };
const noneResult = buildAdaptiveExplanationFromTrace(noneTrace);
ok('none trace returns null', noneResult === null);

// 5) Trace: none + event_recovery_bias
const eventRecoveryTrace = {
  reason: 'none',
  source_sessions: [],
  applied_modifiers: {},
  event_based_summary: { trigger_reasons: ['discomfort_burden_high'] },
};
const eventRecoveryResult = buildAdaptiveExplanationFromTrace(eventRecoveryTrace);
ok('event discomfort_burden_high returns recovery explanation', eventRecoveryResult != null);
ok('event recovery summary contains 회복', eventRecoveryResult?.summary?.includes('회복') ?? false);

// 6) Modifier: difficulty_reduction
const diffRedModifier = {
  volume_modifier: 0,
  difficulty_modifier: -1,
  protection_mode: false,
  discomfort_area: null,
};
const diffRedResult = buildAdaptiveExplanationFromModifier(diffRedModifier);
ok('difficulty_modifier -1 returns result', diffRedResult != null);
ok('difficulty reduction message contains 난이도', diffRedResult?.message?.includes('난이도') ?? false);

// 7) Modifier: protection_mode
const protectionModifier = {
  volume_modifier: 0,
  difficulty_modifier: -1,
  protection_mode: true,
  discomfort_area: null,
};
const protectionResult = buildAdaptiveExplanationFromModifier(protectionModifier);
ok('protection_mode returns result', protectionResult != null);
ok('protection message contains 안전', protectionResult?.message?.includes('안전') ?? false);

// 8) Modifier: discomfort_protection
const discomfortModifier = {
  volume_modifier: 0,
  difficulty_modifier: 0,
  protection_mode: false,
  discomfort_area: 'lower_back',
};
const discomfortResult = buildAdaptiveExplanationFromModifier(discomfortModifier);
ok('discomfort_area returns result', discomfortResult != null);
ok('discomfort message contains 부위', discomfortResult?.message?.includes('부위') ?? false);

// 9) Modifier: neutral
const neutralModifier = {
  volume_modifier: 0,
  difficulty_modifier: 0,
  protection_mode: false,
  discomfort_area: null,
};
const neutralResult = buildAdaptiveExplanationFromModifier(neutralModifier);
ok('neutral modifier returns null', neutralResult === null);

// 10) getSummaryForReason
ok('getSummaryForReason pain_flare', getSummaryForReason('pain_flare').includes('회복'));
ok('getSummaryForReason none is empty', getSummaryForReason('none') === '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
