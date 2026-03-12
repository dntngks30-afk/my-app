/**
 * PR-02: Centralized adaptive merge smoke test
 * Verifies resolveAdaptiveMerge precedence rules.
 * Run: npx tsx scripts/adaptive-merge-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { resolveAdaptiveMerge } = await import('../src/lib/session/adaptive-merge.ts');

const neutralModifier = { volume_modifier: 0, complexity_cap: 'none', recovery_bias: false };
const recoveryModifier = { volume_modifier: 0, complexity_cap: 'none', recovery_bias: true };
const basicCapModifier = { volume_modifier: 0, complexity_cap: 'basic', recovery_bias: false };
const volumeModifier = { volume_modifier: -0.2, complexity_cap: 'none', recovery_bias: false };

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

console.log('PR-02 Adaptive merge smoke test\n');

// neutral + neutral
const r0 = resolveAdaptiveMerge({
  progression: { reason: 'none', targetLevelDelta: 0, avoidExerciseKeys: [] },
  modifier: neutralModifier,
  summary: null,
});
ok('neutral + neutral: targetLevelDelta 0', r0.targetLevelDelta === 0);
ok('neutral + neutral: overlay undefined when no content', r0.overlay === undefined);

// CASE A: pain_flare + neutral
const rA = resolveAdaptiveMerge({
  progression: {
    reason: 'pain_flare',
    targetLevelDelta: -1,
    forceShort: true,
    forceRecovery: true,
    avoidExerciseKeys: ['ex-1'],
    maxDifficultyCap: 'low',
  },
  modifier: neutralModifier,
  summary: null,
});
ok('A. pain_flare + neutral: targetLevelDelta -1', rA.targetLevelDelta === -1);
ok('A. pain_flare + neutral: forceRecovery true', rA.forceRecovery === true);
ok('A. pain_flare + neutral: forceShort true', rA.forceShort === true);
ok('A. pain_flare + neutral: avoidTemplateIds preserved', rA.avoidTemplateIds.includes('ex-1'));

// CASE B: high_tolerance + recovery_bias
const rB = resolveAdaptiveMerge({
  progression: {
    reason: 'high_tolerance',
    targetLevelDelta: 1,
    forceShort: false,
    forceRecovery: false,
    avoidExerciseKeys: [],
  },
  modifier: recoveryModifier,
  summary: null,
});
ok('B. high_tolerance + recovery_bias: targetLevelDelta NOT +1', rB.targetLevelDelta !== 1);
ok('B. high_tolerance + recovery_bias: targetLevelDelta 0', rB.targetLevelDelta === 0);
ok('B. high_tolerance + recovery_bias: forceRecovery true', rB.forceRecovery === true);

// CASE C: high_tolerance + complexity_cap basic
const rC = resolveAdaptiveMerge({
  progression: {
    reason: 'high_tolerance',
    targetLevelDelta: 1,
    forceShort: false,
    forceRecovery: false,
    avoidExerciseKeys: [],
  },
  modifier: basicCapModifier,
  summary: null,
});
ok('C. high_tolerance + basic cap: targetLevelDelta NOT +1', rC.targetLevelDelta !== 1);
ok('C. high_tolerance + basic cap: maxDifficultyCap medium', rC.maxDifficultyCap === 'medium');

// CASE D: low_tolerance + recovery_bias
const rD = resolveAdaptiveMerge({
  progression: {
    reason: 'low_tolerance',
    targetLevelDelta: -1,
    forceShort: true,
    forceRecovery: false,
    avoidExerciseKeys: ['ex-2'],
  },
  modifier: recoveryModifier,
  summary: null,
});
ok('D. low_tolerance + recovery_bias: targetLevelDelta -1', rD.targetLevelDelta === -1);
ok('D. low_tolerance + recovery_bias: forceRecovery true', rD.forceRecovery === true);
ok('D. low_tolerance + recovery_bias: forceShort true', rD.forceShort === true);

// CASE E: none + volume_modifier only
const rE = resolveAdaptiveMerge({
  progression: { reason: 'none', targetLevelDelta: 0, avoidExerciseKeys: [] },
  modifier: volumeModifier,
  summary: null,
});
ok('E. none + volume -0.2: volumeModifier -0.2', rE.volumeModifier === -0.2);
ok('E. none + volume only: no overlay aggression', rE.targetLevelDelta === 0);

// CASE F: avoid ids union/dedupe/sort
const rF = resolveAdaptiveMerge({
  progression: {
    reason: 'low_tolerance',
    targetLevelDelta: -1,
    avoidExerciseKeys: ['z-id', 'a-id', 'z-id'],
  },
  modifier: neutralModifier,
  summary: null,
});
ok('F. avoidTemplateIds sorted', rF.avoidTemplateIds[0] === 'a-id' && rF.avoidTemplateIds[1] === 'z-id');
ok('F. avoidTemplateIds deduped', rF.avoidTemplateIds.length === 2);

// deterministic output
const rG1 = resolveAdaptiveMerge({
  progression: { reason: 'high_tolerance', targetLevelDelta: 1, avoidExerciseKeys: [] },
  modifier: recoveryModifier,
  summary: null,
});
const rG2 = resolveAdaptiveMerge({
  progression: { reason: 'high_tolerance', targetLevelDelta: 1, avoidExerciseKeys: [] },
  modifier: recoveryModifier,
  summary: null,
});
ok('G. deterministic: same input same output', JSON.stringify(rG1) === JSON.stringify(rG2));

// sources populated
const rH = resolveAdaptiveMerge({
  progression: { reason: 'pain_flare', targetLevelDelta: -1, avoidExerciseKeys: [] },
  modifier: recoveryModifier,
  summary: { flags: ['low_completion'], created_at: '2024-01-01T00:00:00Z' },
});
ok('H. sources.progression_reason', rH.sources.progression_reason === 'pain_flare');
ok('H. sources.summary_flags', Array.isArray(rH.sources.summary_flags) && rH.sources.summary_flags.length > 0);

// stricter cap wins: progression low + modifier basic
const rI = resolveAdaptiveMerge({
  progression: {
    reason: 'pain_flare',
    targetLevelDelta: -1,
    maxDifficultyCap: 'low',
    avoidExerciseKeys: [],
  },
  modifier: basicCapModifier,
  summary: null,
});
ok('I. stricter cap: low wins over basic(medium)', rI.maxDifficultyCap === 'low');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
