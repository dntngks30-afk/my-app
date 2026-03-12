/**
 * PR-FIX-02: Focused test suite for neck/shoulder classification trust
 * Run: npx tsx scripts/deep-v3-neck-shoulder-pr-fix-02.mjs
 *
 * Asserts:
 * - NS-01, NS-02: user-visible result is neck/shoulder-compatible, NOT pure LUMBO-PELVIS
 * - NS-03/UM-01: upper/neck-shoulder compatible, NOT trunk-dominant
 * - TC-01, TC-02: trunk-control style result remains valid
 * - UM-02: upper mobility intact, NOT hijacked to neck
 * - DC-01: deconditioned intact, NOT absorbed to neck
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const scenariosPath = join(projectRoot, 'src/lib/deep-test/scenarios/pr-fix-02-scenarios.json');
const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8'));

const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
const copyMod = await import('../src/lib/deep-result/copy.ts').catch(() => ({}));
const getCopy = copyMod.getCopy;

let passed = 0;
let failed = 0;

for (const s of scenarios) {
  try {
    const v3 = dv.calculateDeepV3(s.answers);
    const exp = s.expected || {};

    if (exp.result_type && v3.result_type !== exp.result_type) {
      throw new Error(`result_type: expected ${exp.result_type}, got ${v3.result_type}`);
    }
    if (exp.primaryFocus && v3.primaryFocus !== exp.primaryFocus) {
      throw new Error(`primaryFocus: expected ${exp.primaryFocus}, got ${v3.primaryFocus}`);
    }
    if (exp.not_result_type && v3.result_type === exp.not_result_type) {
      throw new Error(`result_type must NOT be ${exp.not_result_type}, got ${v3.result_type}`);
    }
    if (exp.result_type_one_of && !exp.result_type_one_of.includes(v3.result_type)) {
      throw new Error(
        `result_type: expected one of [${exp.result_type_one_of.join(', ')}], got ${v3.result_type}`
      );
    }

    // User-visible: NECK-SHOULDER must not display as pure core-only (badgeTitle check)
    if (v3.result_type === 'NECK-SHOULDER' && getCopy) {
      const copy = getCopy(v3.result_type);
      if (copy.badgeTitle?.includes('코어 컨트롤 부족') && !copy.badgeTitle?.includes('상체')) {
        throw new Error(`badgeTitle should not read as pure core-only for NECK-SHOULDER`);
      }
    }

    passed++;
    if (process.env.DEBUG) {
      console.log(`  ✓ ${s.id}: ${v3.result_type} / ${v3.primaryFocus}`);
    }
  } catch (err) {
    failed++;
    console.error(`  ✗ ${s.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Finalize simulation: resolveDeepScoringByVersion + v3Result (same path as finalize route)
console.log('\nFinalize simulation (deep_v3 path)');
const { resolveDeepScoringByVersion } = dv;
for (const s of scenarios.slice(0, 3)) {
  try {
    const { useV3, v3Result } = resolveDeepScoringByVersion('deep_v3', s.answers);
    if (!useV3 || !v3Result) throw new Error('resolveDeepScoringByVersion(deep_v3) failed');
    const exp = s.expected || {};
    if (exp.result_type && v3Result.result_type !== exp.result_type) {
      throw new Error(`finalize: result_type expected ${exp.result_type}, got ${v3Result.result_type}`);
    }
    passed++;
  } catch (err) {
    failed++;
    console.error(`  ✗ finalize ${s.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\nPR-FIX-02 scenarios: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
