/**
 * PR-ALG-19: Plan Quality Audit smoke test.
 * Env-free. Uses pure functions and mock plans/templates.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { auditPlanQuality } = await import('../src/lib/session/plan-quality-audit/index.ts');

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
  { id: 'T_PREP', focus_tags: ['hip_mobility'], phase: 'prep', difficulty: 'low', is_fallback: false },
  { id: 'T_MAIN_SAFE', focus_tags: ['glute_activation'], phase: 'main', difficulty: 'low', is_fallback: false },
  { id: 'T_MAIN_RISK', focus_tags: ['lower_chain_stability'], phase: 'main', difficulty: 'high', balance_demand: 'high', complexity: 'high', is_fallback: false },
  { id: 'T_COOL', focus_tags: ['hip_mobility'], phase: 'cooldown', difficulty: 'low', is_fallback: false },
  { id: 'T_FALLBACK', focus_tags: ['full_body_reset'], phase: 'prep', difficulty: 'low', is_fallback: true },
];

function buildPlan(overrides = {}) {
  return {
    version: 'session_plan_v1',
    meta: {
      session_number: 2,
      session_focus_axes: ['glute_activation'],
      priority_vector: { lower_stability: 1 },
      pain_mode: 'none',
      policy_registry: { version: 'v1', selection_rule_ids: [], excluded_count_by_rule: {}, taxonomy_mode: 'derived_v1' },
      candidate_competition: { version: 'v1', applied: true },
      constraint_engine: { version: 'v1' },
      ordering_engine: { version: 'v1' },
      ...overrides.meta,
    },
    flags: { recovery: false, short: false },
    segments: [
      { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', focus_tag: 'hip_mobility' }] },
      { title: 'Main', duration_sec: 300, items: [{ order: 1, templateId: 'T_MAIN_SAFE', name: 'main', focus_tag: 'glute_activation' }] },
      { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', focus_tag: 'hip_mobility' }] },
    ],
    ...overrides,
  };
}

const ctx = { sessionNumber: 2, isFirstSession: false, painMode: 'none', priorityVector: { lower_stability: 1 } };

console.log('Plan Quality Audit smoke test\n');

// A. First session + high risk main item → risky or warn
const firstSessionHighRisk = buildPlan({
  meta: { session_number: 1, session_focus_axes: ['lower_chain_stability'] },
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', focus_tag: 'hip_mobility' }] },
    { title: 'Main', duration_sec: 300, items: [{ order: 1, templateId: 'T_MAIN_RISK', name: 'high risk', focus_tag: 'lower_chain_stability' }] },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', focus_tag: 'hip_mobility' }] },
  ],
});
const auditHighRisk = auditPlanQuality(firstSessionHighRisk, baseTemplates, {
  sessionNumber: 1,
  isFirstSession: true,
  painMode: 'none',
  priorityVector: null,
});
const hasHighRiskIssue = auditHighRisk.issues.some((i) => i.code === 'FIRST_SESSION_HIGH_RISK_ITEM');
ok('A: first session + high risk main → warn/high issue', hasHighRiskIssue);

// B. Balanced plan → strength
const balancedPlan = buildPlan();
const auditBalanced = auditPlanQuality(balancedPlan, baseTemplates, ctx);
const hasStrength = auditBalanced.strengths.length > 0;
ok('B: balanced Prep/Main/Cooldown → strength', hasStrength);

// C. Missing cooldown → issue
const noCooldownPlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', focus_tag: 'hip_mobility' }] },
    { title: 'Main', duration_sec: 300, items: [{ order: 1, templateId: 'T_MAIN_SAFE', name: 'main', focus_tag: 'glute_activation' }] },
  ],
});
const auditNoCool = auditPlanQuality(noCooldownPlan, baseTemplates, ctx);
const hasCooldownIssue = auditNoCool.issues.some((i) => i.code === 'MISSING_COOLDOWN_FLOW');
ok('C: missing cooldown → issue', hasCooldownIssue);

// D. Missing explainability meta → trace issue
const noTracePlan = buildPlan({
  meta: {
    session_number: 2,
    session_focus_axes: ['glute_activation'],
    policy_registry: undefined,
    candidate_competition: undefined,
    constraint_engine: undefined,
    ordering_engine: undefined,
  },
});
const auditNoTrace = auditPlanQuality(noTracePlan, baseTemplates, ctx);
const hasTraceIssue = auditNoTrace.issues.some((i) => i.code.startsWith('MISSING_') && i.code.endsWith('_TRACE'));
ok('D: missing explainability meta → trace issue', hasTraceIssue);

// E. Deterministic
const r1 = auditPlanQuality(balancedPlan, baseTemplates, ctx);
const r2 = auditPlanQuality(balancedPlan, baseTemplates, ctx);
ok('E: deterministic output', r1.score === r2.score && r1.band === r2.band && JSON.stringify(r1.issues) === JSON.stringify(r2.issues));

// F. Additive meta shape
ok('F: meta.plan_quality_audit has version', auditBalanced.version === 'plan_quality_audit_v1');
ok('F: meta has score', typeof auditBalanced.score === 'number');
ok('F: meta has band', ['good', 'acceptable', 'risky'].includes(auditBalanced.band));
ok('F: meta has issues array', Array.isArray(auditBalanced.issues));
ok('F: meta has summary', typeof auditBalanced.summary === 'string');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
