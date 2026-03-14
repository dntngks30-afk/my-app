/**
 * PR-ALG-16B: Policy Registry selection trace smoke test.
 * Env-free. Uses pure functions and mock templates.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  applySelectionExcludes,
  applySelectionExcludesWithTrace,
} = await import('../src/lib/session/policy-registry/index.ts');

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

const baseTemplates = [
  { id: 'T_SAFE', name: 'safe', focus_tags: ['core_control'], difficulty: 'low', progression_level: 1, balance_demand: 'low', complexity: 'low' },
  { id: 'T_HIGH_RISK', name: 'high risk', focus_tags: ['lower_chain_stability'], difficulty: 'high', progression_level: 3, balance_demand: 'high', complexity: 'high' },
  { id: 'T_PROTECTED_AVOID', name: 'protected avoid', focus_tags: ['glute_medius'], avoid_if_pain_mode: ['protected'], difficulty: 'medium' },
  { id: 'T_MEDIUM_RISK', name: 'medium risk', focus_tags: ['hip_mobility'], difficulty: 'medium', balance_demand: 'high', complexity: 'low' },
];

console.log('Policy Registry selection trace smoke test\n');

// A. sessionNumber=1 + high-risk template → first-session selection exclusion
const firstSessionResult = applySelectionExcludesWithTrace(baseTemplates, {
  sessionNumber: 1,
  painMode: 'none',
});
const firstExcluded = baseTemplates.filter((t) => !firstSessionResult.templates.some((x) => x.id === t.id));
ok('A: first session excludes high-risk template', firstExcluded.some((t) => t.id === 'T_HIGH_RISK'));
ok('A: first session selection_rule_ids includes sel_first_session', firstSessionResult.appliedRuleIds.includes('sel_first_session'));
ok('A: excluded_count_by_rule has sel_first_session', (firstSessionResult.excludedCountByRule['sel_first_session'] ?? 0) > 0);

// B. painMode=protected + medium/high risk → protected exclusion
const protectedResult = applySelectionExcludesWithTrace(baseTemplates, {
  sessionNumber: 2,
  painMode: 'protected',
});
ok('B: protected excludes avoid_if_pain_mode template', !protectedResult.templates.some((t) => t.id === 'T_PROTECTED_AVOID'));
ok('B: protected excludes high risk template', !protectedResult.templates.some((t) => t.id === 'T_HIGH_RISK'));
ok('B: protected excludes medium risk (balance high)', !protectedResult.templates.some((t) => t.id === 'T_MEDIUM_RISK'));
ok('B: appliedRuleIds includes sel_protected_v2 or sel_pain_avoid', protectedResult.appliedRuleIds.some((id) => id === 'sel_protected_v2' || id === 'sel_pain_avoid'));

// C. selection trace has ruleId / reasonCode / excludedCountByRule
ok('C: trace has ruleId', firstSessionResult.trace.length === 0 || firstSessionResult.trace.every((e) => e.ruleId));
ok('C: trace has reasonCode', firstSessionResult.trace.length === 0 || firstSessionResult.trace.every((e) => e.reasonCode));
ok('C: excludedCountByRule is object', typeof firstSessionResult.excludedCountByRule === 'object');

// D. same input → deterministic output
const d1 = applySelectionExcludesWithTrace(baseTemplates, { sessionNumber: 1, painMode: 'none' });
const d2 = applySelectionExcludesWithTrace(baseTemplates, { sessionNumber: 1, painMode: 'none' });
ok('D: deterministic - same templates', JSON.stringify(d1.templates.map((t) => t.id)) === JSON.stringify(d2.templates.map((t) => t.id)));
ok('D: deterministic - same excludedCountByRule', JSON.stringify(d1.excludedCountByRule) === JSON.stringify(d2.excludedCountByRule));

// E. applySelectionExcludes wrapper compatibility
const wrapped = applySelectionExcludes(baseTemplates, { sessionNumber: 1, painMode: 'none' });
ok('E: applySelectionExcludes returns array', Array.isArray(wrapped));
ok('E: applySelectionExcludes excludes high-risk in first session', !wrapped.some((t) => t.id === 'T_HIGH_RISK'));

// F. constraint/ordering flow unchanged (no import of those - just verify policy doesn't break)
ok('F: policy registry exports work', typeof applySelectionExcludes === 'function' && typeof applySelectionExcludesWithTrace === 'function');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
