/**
 * Deep v3 Smoke Test (PR-ALG-01)
 * Run: npx tsx scripts/deep-v3-smoke.mjs
 * Asserts: state vector, pain_mode, primary_type, priority_vector, derived compatibility
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const fixturesPath = join(projectRoot, 'src/lib/deep-test/golden/fixtures.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

async function run() {
  const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
  const { calculateDeepV3, calculateDeepV3StateVector, resolvePainMode, resolveDeepScoringByVersion } = dv;

  if (typeof calculateDeepV3 !== 'function') {
    console.error('Missing calculateDeepV3');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const fx of fixtures) {
    try {
      const v3 = calculateDeepV3(fx.answers);

      // A. state vector 6축
      const sv = calculateDeepV3StateVector(fx.answers);
      const axes = ['lower_stability', 'lower_mobility', 'upper_mobility', 'trunk_control', 'asymmetry', 'deconditioned'];
      for (const a of axes) {
        if (typeof sv[a] !== 'number') {
          throw new Error(`stateVector.${a} not number`);
        }
      }

      // B. pain_mode
      const painMode = resolvePainMode(fx.answers, sv);
      if (!['none', 'caution', 'protected'].includes(painMode)) {
        throw new Error(`invalid pain_mode: ${painMode}`);
      }

      // C. primary_type / secondary_type
      if (!v3.primary_type) throw new Error('missing primary_type');
      if (v3.secondary_type !== null && typeof v3.secondary_type !== 'string') {
        throw new Error('invalid secondary_type');
      }

      // D. priority_vector
      const pv = v3.priority_vector;
      if (!pv || typeof pv.lower_stability !== 'number') {
        throw new Error('invalid priority_vector');
      }

      // E. derived compatibility (routine engine)
      const d = v3.derived;
      if (typeof d.level !== 'number' || d.level < 1 || d.level > 3) {
        throw new Error(`invalid derived.level: ${d.level}`);
      }
      if (!Array.isArray(d.focus_tags)) throw new Error('missing focus_tags');
      if (!Array.isArray(d.avoid_tags)) throw new Error('missing avoid_tags');
      if (!d.primaryFocus) throw new Error('missing primaryFocus');
      if (!d.secondaryFocus) throw new Error('missing secondaryFocus');

      passed++;
      if (process.env.DEBUG) {
        console.log(`  ${fx.id}: ${v3.primary_type} / ${v3.pain_mode} / level=${d.level}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${fx.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // resolveDeepScoringByVersion
  const { useV3, v3Result } = resolveDeepScoringByVersion('deep_v3', fixtures[0].answers);
  if (!useV3 || !v3Result) {
    console.error('resolveDeepScoringByVersion(deep_v3) failed');
    failed++;
  }
  const v2Res = resolveDeepScoringByVersion('deep_v2', fixtures[0].answers);
  if (v2Res.useV3) {
    console.error('resolveDeepScoringByVersion(deep_v2) should return useV3=false');
    failed++;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
