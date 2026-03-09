/**
 * PR-ALG-09: Shadow compare smoke test
 * Run: npx tsx scripts/deep-v3-shadow-compare.mjs
 * Validates: shadow compare produces diff when pain_mode differs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const fixturesPath = join(__dirname, '..', 'src/lib/deep-test/golden/fixtures.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

async function run() {
  const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
  const { calculateDeepV3, calculateDeepV3WithCandidate, buildShadowCompare } = dv;

  let passed = 0;
  let failed = 0;

  for (const fx of fixtures) {
    try {
      const active = calculateDeepV3(fx.answers);
      const shadow = calculateDeepV3WithCandidate(fx.answers, 'pain_mode_relaxed');
      const compare = buildShadowCompare(
        active,
        shadow,
        'pain_mode_relaxed',
        'deep_v3_pain_mode_candidate_relaxed'
      );

      if (compare.active_primary_type !== active.primary_type) {
        throw new Error('active_primary_type mismatch');
      }
      if (compare.shadow_primary_type !== shadow.primary_type) {
        throw new Error('shadow_primary_type mismatch');
      }
      if (compare.active_pain_mode !== active.pain_mode) {
        throw new Error('active_pain_mode mismatch');
      }
      if (compare.shadow_pain_mode !== shadow.pain_mode) {
        throw new Error('shadow_pain_mode mismatch');
      }
      if (!Array.isArray(compare.diff_flags)) {
        throw new Error('diff_flags must be array');
      }
      if (active.pain_mode !== shadow.pain_mode && !compare.diff_flags.includes('pain_mode_changed')) {
        throw new Error('pain_mode differs but diff_flags missing pain_mode_changed');
      }

      passed++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${fx.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let painModeChangedCount = 0;
  for (const fx of fixtures) {
    const active = calculateDeepV3(fx.answers);
    const shadow = calculateDeepV3WithCandidate(fx.answers, 'pain_mode_relaxed');
    if (active.pain_mode !== shadow.pain_mode) painModeChangedCount++;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`pain_mode_changed count: ${painModeChangedCount}/${fixtures.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
