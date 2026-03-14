/**
 * PR-ALG-18: Candidate Competition Engine smoke test.
 * Env-free. Uses pure functions and mock templates.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { applyCandidateCompetition } = await import('../src/lib/session/candidate-competition/index.ts');

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

const baseCandidates = [
  { template: { id: 'T_PREP', focus_tags: ['hip_mobility'], phase: 'prep', difficulty: 'low', is_fallback: false }, score: 5 },
  { template: { id: 'T_MAIN_A', focus_tags: ['lower_chain_stability'], phase: 'main', difficulty: 'medium', balance_demand: 'low', complexity: 'low', is_fallback: false }, score: 8 },
  { template: { id: 'T_MAIN_B', focus_tags: ['lower_chain_stability'], phase: 'main', difficulty: 'high', balance_demand: 'high', complexity: 'high', is_fallback: false }, score: 7 },
  { template: { id: 'T_MAIN_C', focus_tags: ['glute_activation'], phase: 'main', difficulty: 'low', is_fallback: false }, score: 6 },
  { template: { id: 'T_FALLBACK', focus_tags: ['full_body_reset'], phase: 'prep', difficulty: 'low', is_fallback: true }, score: 5 },
  { template: { id: 'T_COOL', focus_tags: ['hip_mobility'], phase: 'cooldown', difficulty: 'low', is_fallback: false }, score: 4 },
];

console.log('Candidate Competition Engine smoke test\n');

// A. Deterministic
const ctx1 = { sessionNumber: 2, isFirstSession: false, painMode: 'none', usedTemplateIds: [] };
const r1 = applyCandidateCompetition(baseCandidates, ctx1);
const r2 = applyCandidateCompetition(baseCandidates, ctx1);
ok('A: deterministic - same order', JSON.stringify(r1.ranked.map((x) => x.template.id)) === JSON.stringify(r2.ranked.map((x) => x.template.id)));

// B. First session: safer/lower-risk candidate ranks higher
const firstCtx = { sessionNumber: 1, isFirstSession: true, painMode: 'none', usedTemplateIds: [] };
const firstResult = applyCandidateCompetition(baseCandidates, firstCtx);
const mainBIdx = firstResult.ranked.findIndex((x) => x.template.id === 'T_MAIN_B');
const mainCIdx = firstResult.ranked.findIndex((x) => x.template.id === 'T_MAIN_C');
ok('B: first session - low risk (T_MAIN_C) before high risk (T_MAIN_B)', mainCIdx >= 0 && mainBIdx >= 0 && mainCIdx < mainBIdx);

// C. Pattern/body overload mitigation - diversity factors applied
const samePatternCandidates = [
  { template: { id: 'T1', focus_tags: ['lower_chain_stability'], phase: 'main', difficulty: 'low', is_fallback: false }, score: 6 },
  { template: { id: 'T2', focus_tags: ['lower_chain_stability'], phase: 'main', difficulty: 'low', is_fallback: false }, score: 6 },
  { template: { id: 'T3', focus_tags: ['glute_activation'], phase: 'main', difficulty: 'low', is_fallback: false }, score: 6 },
];
const divResult = applyCandidateCompetition(samePatternCandidates, ctx1);
const hasDiversityFactor = divResult.meta.top_competition_factors.some((f) => f.includes('diversity'));
ok('C: diversity factors applied when pattern overload present', hasDiversityFactor);

// D. Sufficient pool: fallback penalized
const manyCandidates = [
  ...baseCandidates,
  { template: { id: 'T_EXTRA1', focus_tags: ['core_control'], phase: 'main', difficulty: 'low', is_fallback: false }, score: 5 },
  { template: { id: 'T_EXTRA2', focus_tags: ['thoracic_mobility'], phase: 'prep', difficulty: 'low', is_fallback: false }, score: 5 },
  { template: { id: 'T_EXTRA3', focus_tags: ['ankle_mobility'], phase: 'main', difficulty: 'low', is_fallback: false }, score: 5 },
];
const fallbackResult = applyCandidateCompetition(manyCandidates, ctx1);
const fallbackIdx = fallbackResult.ranked.findIndex((x) => x.template.id === 'T_FALLBACK');
const nonFallbackCount = fallbackResult.ranked.filter((x) => !x.template.is_fallback).length;
ok('D: sufficient pool - fallback not at top', fallbackIdx > 0 || nonFallbackCount === 0);

// E. Meta structure
ok('E: meta.candidate_competition exists', !!r1.meta);
ok('E: meta.candidate_competition.version', r1.meta.version === 'candidate_competition_v1');
ok('E: meta.candidate_competition.strategy', r1.meta.strategy === 'score_plus_diversity_bias');
ok('E: meta.candidate_competition.candidate_count_before', r1.meta.candidate_count_before === baseCandidates.length);
ok('E: meta.candidate_competition.candidate_count_after', r1.meta.candidate_count_after === baseCandidates.length);

// F. Constraint/ordering contract unchanged (no import - just verify competition doesn't break)
ok('F: ranked returns same count as input', r1.ranked.length === baseCandidates.length);
ok('F: ranked items have template and score', r1.ranked.every((x) => x.template && typeof x.score === 'number'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
