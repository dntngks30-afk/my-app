/**
 * PR-ALG-16A: General Session Constraint Engine unit test
 * Env-free. Uses pure functions and mock templates/plans.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { applySessionConstraints } = await import('../src/lib/session/constraints/applySessionConstraints.ts');
const { applySessionGuardrailWithTemplates } = await import('../src/core/session-guardrail/applySessionGuardrail.ts');

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
      used_template_ids: ['T_PREP', 'T_MAIN_A', 'T_MAIN_B', 'T_COOL'],
      constraint_flags: {
        avoid_filter_applied: false,
        duplicate_filtered_count: 0,
        focus_diversity_enforced: true,
        fallback_used: false,
        short_mode_applied: false,
        recovery_mode_applied: false,
      },
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
          { order: 1, templateId: 'T_MAIN_A', name: 'main a', sets: 2, reps: 12 },
          { order: 2, templateId: 'T_MAIN_B', name: 'main b', sets: 2, reps: 12 },
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
  { id: 'T_MAIN_A', name: 'main a', phase: 'main', focus_tags: ['lower_stability'], difficulty: 'medium', progression_level: 1 },
  { id: 'T_MAIN_B', name: 'main b', phase: 'main', focus_tags: ['trunk_control'], difficulty: 'medium', progression_level: 1 },
  { id: 'T_MAIN_C', name: 'main c', phase: 'main', focus_tags: ['upper_mobility'], difficulty: 'low', progression_level: 1 },
  { id: 'T_MAIN_D', name: 'main d', phase: 'main', focus_tags: ['lower_stability'], difficulty: 'high', progression_level: 3, avoid_if_pain_mode: ['protected'], balance_demand: 'high', complexity: 'high' },
  { id: 'T_ACCESSORY', name: 'accessory', phase: 'accessory', focus_tags: ['upper_mobility'], difficulty: 'low', progression_level: 1 },
  { id: 'T_COOL', name: 'cool', phase: 'cooldown', focus_tags: ['hip_mobility'], difficulty: 'low', progression_level: 1 },
  { id: 'T_SAFE_PROTECTED', name: 'safe protected', phase: 'main', focus_tags: ['core_control'], difficulty: 'low', progression_level: 1 },
];

console.log('General Session Constraint Engine unit test\n');

const normal = applySessionConstraints(buildPlan(), baseTemplates, {
  sessionNumber: 2,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
ok('normal session keeps prep before main before cooldown', (() => {
  const titles = normal.plan.segments.map((s) => s.title);
  const prepIdx = titles.indexOf('Prep');
  const mainIdx = titles.indexOf('Main');
  const cooldownIdx = titles.indexOf('Cooldown');
  return prepIdx >= 0 && mainIdx >= 0 && cooldownIdx >= 0 && prepIdx < mainIdx && mainIdx < cooldownIdx;
})());
ok('normal session main count >= 2', (normal.plan.segments.find((s) => s.title === 'Main')?.items.length ?? 0) >= 2);
ok('normal session has additive constraint meta', !!normal.plan.meta.constraint_engine);

const lowInventoryTemplates = baseTemplates.slice(0, 4);
const lowInventoryPlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }] },
    { title: 'Main', duration_sec: 300, items: [{ order: 1, templateId: 'T_MAIN_A', name: 'main a', sets: 2, reps: 12 }] },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
  ],
});
const lowInventory = applySessionConstraints(lowInventoryPlan, lowInventoryTemplates, {
  sessionNumber: 3,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
ok('low inventory does not crash', !!lowInventory.plan);
ok(
  'low inventory leaves degrade reason',
  lowInventory.meta.reasons.some((reason) => reason.code === 'degraded_due_to_low_inventory' || reason.code === 'degraded_due_to_main_count_shortage')
);

const painProtectedPlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }] },
    { title: 'Main', duration_sec: 300, items: [{ order: 1, templateId: 'T_MAIN_D', name: 'unsafe', sets: 2, reps: 12 }] },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
  ],
});
const painProtected = applySessionConstraints(painProtectedPlan, baseTemplates, {
  sessionNumber: 4,
  isFirstSession: false,
  painMode: 'protected',
  priorityVector: null,
});
ok(
  'protected pain mode replaces or removes unsafe template',
  !painProtected.plan.segments.flatMap((s) => s.items).some((item) => item.templateId === 'T_MAIN_D')
);
ok(
  'protected pain mode records blocked_by_pain_mode',
  painProtected.meta.reasons.some((reason) => reason.code === 'blocked_by_pain_mode')
);

const patternOverloadPlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 1, reps: 8 }] },
    {
      title: 'Main',
      duration_sec: 300,
      items: [
        { order: 1, templateId: 'T_MAIN_A', name: 'main a', sets: 2, reps: 12 },
        { order: 2, templateId: 'T_MAIN_D', name: 'main d', sets: 2, reps: 12 },
        { order: 3, templateId: 'T_MAIN_A', name: 'main a 2', sets: 2, reps: 12 },
      ],
    },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
  ],
});
const patternOverload = applySessionConstraints(patternOverloadPlan, baseTemplates, {
  sessionNumber: 5,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
ok('pattern overload creates Accessory segment', patternOverload.plan.segments.some((s) => s.title === 'Accessory'));
ok(
  'pattern overload records blocked_by_pattern_cap',
  patternOverload.meta.reasons.some((reason) => reason.code === 'blocked_by_pattern_cap')
);

const fatiguePlan = buildPlan({
  segments: [
    { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 2, reps: 16 }] },
    {
      title: 'Main',
      duration_sec: 300,
      items: [
        { order: 1, templateId: 'T_MAIN_D', name: 'hard a', sets: 3, reps: 16 },
        { order: 2, templateId: 'T_MAIN_D', name: 'hard b', sets: 3, reps: 16 },
      ],
    },
    { title: 'Accessory', duration_sec: 120, items: [{ order: 1, templateId: 'T_ACCESSORY', name: 'acc', sets: 2, reps: 16 }] },
    { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 45 }] },
  ],
});
const fatigue = applySessionConstraints(fatiguePlan, baseTemplates, {
  sessionNumber: 6,
  isFirstSession: false,
  painMode: 'none',
  priorityVector: null,
});
ok(
  'fatigue overload records blocked_by_fatigue_cap',
  fatigue.meta.reasons.some((reason) => reason.code === 'blocked_by_fatigue_cap')
);
ok('fatigue summary score is capped or reduced', fatigue.meta.summary.fatigue_score <= 24);

const firstSession = applySessionConstraints(
  buildPlan({
    meta: { session_number: 1, priority_vector: { deconditioned: 1 } },
    segments: [
      { title: 'Prep', duration_sec: 120, items: [{ order: 1, templateId: 'T_PREP', name: 'prep', sets: 2, reps: 8 }] },
      {
        title: 'Main',
        duration_sec: 300,
        items: [
          { order: 1, templateId: 'T_MAIN_D', name: 'unsafe hard', sets: 3, reps: 16 },
          { order: 2, templateId: 'T_MAIN_B', name: 'main b', sets: 2, reps: 12 },
        ],
      },
      { title: 'Cooldown', duration_sec: 120, items: [{ order: 1, templateId: 'T_COOL', name: 'cool', sets: 1, hold_seconds: 30 }] },
    ],
  }),
  baseTemplates,
  {
    sessionNumber: 1,
    isFirstSession: true,
    painMode: 'none',
    priorityVector: { deconditioned: 1 },
  }
);
ok(
  'first session records guardrail reason',
  firstSession.meta.reasons.some((reason) => reason.code === 'first_session_guardrail_applied')
);
ok(
  'first session applies deconditioned reduction or replacement',
  firstSession.meta.reasons.some((reason) => reason.code === 'reduced_due_to_deconditioned' || reason.code === 'first_session_guardrail_applied')
);

const wrapperPlan = applySessionGuardrailWithTemplates(
  buildPlan({
    meta: { session_number: 1 },
  }),
  {
    session_number: 1,
    pain_mode: 'protected',
    priority_vector: { deconditioned: 1 },
    scoring_version: 'deep_v2',
  },
  baseTemplates
);
ok('legacy first-session wrapper still returns plan shape', Array.isArray(wrapperPlan.segments));
ok('legacy wrapper delegates to new constraint meta', !!wrapperPlan.meta.constraint_engine);

// PR-ALG-16B: reason traceability — rule_id and stage in meta
const withReasons = painProtected.meta.reasons.filter((r) => r.rule_id && r.stage);
ok(
  'reason traceability: reasons have rule_id and stage when constraints apply',
  withReasons.length > 0 && withReasons.every((r) => typeof r.rule_id === 'string' && r.stage === 'post_selection')
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
