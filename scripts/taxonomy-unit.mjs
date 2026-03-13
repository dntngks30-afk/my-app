/**
 * PR-ALG-16B: Minimum viable taxonomy normalization unit test.
 * Env-free. Uses pure functions.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { normalizeExerciseTaxonomy } = await import('../src/lib/session/taxonomy/normalizeExerciseTaxonomy.ts');

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

console.log('Taxonomy normalization unit test\n');

const t1 = { focus_tags: ['core_stability'], phase: 'main', difficulty: 'medium', progression_level: 1 };
const tax1 = normalizeExerciseTaxonomy(t1);
ok('pattern_family from focus_tags', tax1.pattern_family === 'core_stability');
ok('body_region derived', tax1.body_region === 'trunk');
ok('load_type derived', tax1.load_type === 'stability');
ok('training_intent from phase', tax1.training_intent === 'main');
ok('risk_group low for safe template', tax1.risk_group === 'low');

const t2 = { focus_tags: ['glute_medius'], phase: 'main', difficulty: 'high', balance_demand: 'high', complexity: 'high' };
const tax2 = normalizeExerciseTaxonomy(t2);
ok('risk_group high for high difficulty + balance + complexity', tax2.risk_group === 'high');

const t3 = { focus_tags: ['hip_mobility'], phase: 'prep', avoid_if_pain_mode: ['caution'] };
const tax3 = normalizeExerciseTaxonomy(t3);
ok('risk_group medium with caution avoid', tax3.risk_group === 'medium');
ok('pattern_family hip_mobility', tax3.pattern_family === 'hip_mobility');
ok('body_region lower for hip', tax3.body_region === 'lower');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
