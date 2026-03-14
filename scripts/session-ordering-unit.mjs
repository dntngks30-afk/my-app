/**
 * PR-ALG-17: Session Ordering Engine unit test
 * Env-free. Uses pure functions and mock templates/plans.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { applySessionOrdering } = await import('../src/lib/session/ordering/applySessionOrdering.ts');
const { applySessionConstraints } = await import('../src/lib/session/constraints/applySessionConstraints.ts');

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

function buildPlan(overrides = {}) {
  return {
    version: 'session_plan_v1',
    meta: {
      session_number: 2,
      phase: 1,
      focus: ['lower_stability'],
      avoid: [],
      scoring_version: 'deep_v2',
      used_template_ids: ['T_PREP', 'T_MAIN_A', 'T_MAIN_B', 'T_MAIN_C', 'T_COOL'],
      constraint_flags: {},
      ...overrides.meta,
    },
    flags: { recovery: false, short: false },
    segments: [
      {
        title: 'Prep',
        duration_sec: 120,
        items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }],
      },
      {
        title: 'Main',
        duration_sec: 300,
        items: [
          { order: 1, templateId: 'T_MAIN_PATTERN', name: 'pattern', sets: 2, reps: 12 },
          { order: 2, templateId: 'T_MAIN_ACT', name: 'activation', sets: 2, reps: 12 },
          { order: 3, templateId: 'T_MAIN_MOB', name: 'mobility', sets: 2, reps: 12 },
        ],
      },
      {
        title: 'Cooldown',
        duration_sec: 120,
        items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }],
      },
    ],
    ...overrides,
  };
}

const baseTemplates = [
  { id: 'T_PREP', name: 'prep', phase: 'prep', focus_tags: ['full_body_reset'], difficulty: 'low', progression_level: 1 },
  { id: 'T_MAIN_ACT', name: 'activation', phase: 'main', focus_tags: ['glute_activation'], difficulty: 'low', progression_level: 1 },
  { id: 'T_MAIN_MOB', name: 'mobility', phase: 'main', focus_tags: ['hip_mobility'], difficulty: 'low', progression_level: 1 },
  { id: 'T_MAIN_PATTERN', name: 'pattern', phase: 'main', focus_tags: ['lower_chain_stability'], difficulty: 'medium', progression_level: 2 },
  { id: 'T_MAIN_COMPLEX', name: 'complex', phase: 'main', focus_tags: ['lower_chain_stability'], difficulty: 'high', progression_level: 3, balance_demand: 'high', complexity: 'high' },
  { id: 'T_MAIN_SIMPLE', name: 'simple', phase: 'main', focus_tags: ['core_control'], difficulty: 'low', progression_level: 1, balance_demand: 'low', complexity: 'low' },
  { id: 'T_COOL', name: 'cool', phase: 'cooldown', focus_tags: ['hip_mobility'], difficulty: 'low', progression_level: 1 },
];

console.log('Session Ordering Engine unit test\n');

// 1. Normal session ordering: activation/mobility before pattern
const normalPlan = buildPlan();
const normalResult = applySessionOrdering(normalPlan, baseTemplates, {
  sessionNumber: 2,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
const mainItems = normalResult.plan.segments.find((s) => s.title === 'Main')?.items ?? [];
const actIdx = mainItems.findIndex((i) => i.templateId === 'T_MAIN_ACT');
const mobIdx = mainItems.findIndex((i) => i.templateId === 'T_MAIN_MOB');
const patIdx = mainItems.findIndex((i) => i.templateId === 'T_MAIN_PATTERN');
ok('normal session: Prep/Main/Cooldown segment order preserved', (() => {
  const titles = normalResult.plan.segments.map((s) => s.title);
  const prepIdx = titles.indexOf('Prep');
  const mainIdx = titles.indexOf('Main');
  const coolIdx = titles.indexOf('Cooldown');
  return prepIdx >= 0 && mainIdx >= 0 && coolIdx >= 0 && prepIdx < mainIdx && mainIdx < coolIdx;
})());
ok('normal session: activation/mobility before pattern', actIdx >= 0 && mobIdx >= 0 && patIdx >= 0 && Math.max(actIdx, mobIdx) < patIdx);
ok('normal session: has additive ordering meta', !!normalResult.plan.meta.ordering_engine);
ok('normal session: ordering meta has strategy', !!normalResult.meta.strategy);

// 2. First session ordering: easy/safe items first
const firstSessionPlan = buildPlan({
  meta: { session_number: 1 },
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }] },
    {
      title: 'Main',
      duration_sec: 300,
      items: [
        { order: 1, templateId: 'T_MAIN_COMPLEX', name: 'complex', sets: 2, reps: 12 },
        { order: 2, templateId: 'T_MAIN_SIMPLE', name: 'simple', sets: 2, reps: 12 },
      ],
    },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
  ],
});
const firstResult = applySessionOrdering(firstSessionPlan, baseTemplates, {
  sessionNumber: 1,
  isFirstSession: true,
  painMode: 'none',
  priorityVector: null,
});
const firstMainItems = firstResult.plan.segments.find((s) => s.title === 'Main')?.items ?? [];
const simpleIdx = firstMainItems.findIndex((i) => i.templateId === 'T_MAIN_SIMPLE');
const complexIdx = firstMainItems.findIndex((i) => i.templateId === 'T_MAIN_COMPLEX');
ok('first session: easy/safe items before hard', simpleIdx >= 0 && complexIdx >= 0 && simpleIdx < complexIdx);
ok('first session: ordering meta has first_session strategy', firstResult.meta.strategy === 'first_session');

// 3. Pain mode protected: low complexity/balance first
const painPlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }] },
    {
      title: 'Main',
      duration_sec: 300,
      items: [
        { order: 1, templateId: 'T_MAIN_COMPLEX', name: 'complex', sets: 2, reps: 12 },
        { order: 2, templateId: 'T_MAIN_SIMPLE', name: 'simple', sets: 2, reps: 12 },
      ],
    },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
  ],
});
const painResult = applySessionOrdering(painPlan, baseTemplates, {
  sessionNumber: 3,
  isFirstSession: false,
  painMode: 'protected',
  priorityVector: null,
});
const painMainItems = painResult.plan.segments.find((s) => s.title === 'Main')?.items ?? [];
const painSimpleIdx = painMainItems.findIndex((i) => i.templateId === 'T_MAIN_SIMPLE');
const painComplexIdx = painMainItems.findIndex((i) => i.templateId === 'T_MAIN_COMPLEX');
ok('pain_mode protected: low complexity first', painSimpleIdx >= 0 && painComplexIdx >= 0 && painSimpleIdx < painComplexIdx);
ok('pain_mode: ordering meta has pain_mode_protected strategy', painResult.meta.strategy === 'pain_mode_protected');

// 4. Accessory aware: Main then Accessory order preserved
const accessoryPlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }] },
    { title: 'Main', duration_sec: 300, items: [{ order: 1, templateId: 'T_MAIN_ACT', name: 'act', sets: 2, reps: 12 }] },
    { title: 'Accessory', duration_sec: 120, items: [{ order: 1, templateId: 'T_MAIN_MOB', name: 'mob', sets: 2, reps: 12 }] },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
  ],
});
const accessoryResult = applySessionOrdering(accessoryPlan, baseTemplates, {
  sessionNumber: 4,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
const accTitles = accessoryResult.plan.segments.map((s) => s.title);
ok('accessory: Main before Accessory before Cooldown', (() => {
  const m = accTitles.indexOf('Main');
  const a = accTitles.indexOf('Accessory');
  const c = accTitles.indexOf('Cooldown');
  return m >= 0 && a >= 0 && c >= 0 && m < a && a < c;
})());

// 5. Deterministic: same input → same order
const planA = buildPlan();
const resultA1 = applySessionOrdering(planA, baseTemplates, { sessionNumber: 5, isFirstSession: false, painMode: 'none', priorityVector: null });
const resultA2 = applySessionOrdering(planA, baseTemplates, { sessionNumber: 5, isFirstSession: false, painMode: 'none', priorityVector: null });
const orderA1 = resultA1.plan.segments.flatMap((s) => s.items.map((i) => i.templateId));
const orderA2 = resultA2.plan.segments.flatMap((s) => s.items.map((i) => i.templateId));
ok('deterministic: same input yields same item order', JSON.stringify(orderA1) === JSON.stringify(orderA2));

// 6. Additive meta: constraint_engine preserved when chaining
const fullPlan = buildPlan();
const constraintResult = applySessionConstraints(fullPlan, baseTemplates, {
  sessionNumber: 6,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
const orderingAfterConstraint = applySessionOrdering(constraintResult.plan, baseTemplates, {
  sessionNumber: 6,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
ok('additive meta: constraint_engine preserved after ordering', !!orderingAfterConstraint.plan.meta.constraint_engine);
ok('additive meta: ordering_engine present', !!orderingAfterConstraint.plan.meta.ordering_engine);

// 7. Backward compatibility: plan shape unchanged
ok('backward compatibility: segments array', Array.isArray(normalResult.plan.segments));
ok('backward compatibility: items have order/templateId/name', normalResult.plan.segments.every((s) => s.items.every((i) => i.order != null && i.templateId && i.name)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
