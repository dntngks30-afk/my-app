/**
 * PR-P2-4: Plan generator constraint hardening smoke test
 * Run: npx tsx scripts/plan-generator-smoke.mjs
 * Note: Requires Supabase env for full DB tests.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

let mod;
try {
  mod = await import('../src/lib/session/plan-generator.ts');
} catch (e) {
  if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing')) {
    console.log('SKIP: Supabase env required for plan-generator tests.');
    process.exit(0);
  }
  throw e;
}

const { buildSessionPlanJson } = mod;

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

const baseInput = {
  sessionNumber: 1,
  totalSessions: 16,
  phase: 1,
  theme: 'Phase 1 · glute_medius 안정화',
  timeBudget: 'normal',
  conditionMood: 'ok',
  focus: ['glute_medius', 'hip_mobility'],
  avoid: [],
  painFlags: [],
  usedTemplateIds: [],
  scoringVersion: 'deep_v2',
  deep_level: 2,
  safety_mode: 'none',
};

console.log('Plan generator smoke test\n');

try {
  const plan = await buildSessionPlanJson(baseInput);

  ok('plan has segments', Array.isArray(plan.segments) && plan.segments.length > 0);
  ok('plan has meta', typeof plan.meta === 'object');
  ok('plan has flags', typeof plan.flags === 'object');
  ok('plan has constraint_flags', typeof plan.meta.constraint_flags === 'object');

  const allItems = plan.segments.flatMap((s) => s.items);
  const templateIds = allItems.map((i) => i.templateId);
  const uniqueIds = new Set(templateIds);
  ok('no duplicate templateId in session', uniqueIds.size === templateIds.length);

  ok('constraint_flags.avoid_filter_applied', typeof plan.meta.constraint_flags.avoid_filter_applied === 'boolean');
  ok('constraint_flags.focus_diversity_enforced', plan.meta.constraint_flags.focus_diversity_enforced === true);
  ok('constraint_flags.short_mode_applied', typeof plan.meta.constraint_flags.short_mode_applied === 'boolean');

  const shortPlan = await buildSessionPlanJson({
    ...baseInput,
    timeBudget: 'short',
    conditionMood: 'bad',
    adaptiveOverlay: { forceShort: true, forceRecovery: true },
  });

  const shortItems = shortPlan.segments.flatMap((s) => s.items);
  ok('short+recovery has fewer or equal items', shortItems.length <= allItems.length);
  ok('short mode flags', shortPlan.flags.short === true && shortPlan.flags.recovery === true);

  const avoidPlan = await buildSessionPlanJson({
    ...baseInput,
    adaptiveOverlay: { avoidTemplateIds: allItems.slice(0, 2).map((i) => i.templateId) },
  });
  const avoidItems = avoidPlan.segments.flatMap((s) => s.items);
  const avoidedIds = new Set(allItems.slice(0, 2).map((i) => i.templateId));
  const overlap = avoidItems.filter((i) => avoidedIds.has(i.templateId));
  ok('avoidTemplateIds excludes templates when possible', overlap.length === 0 || avoidPlan.meta.constraint_flags.fallback_used);
} catch (e) {
  failed++;
  console.error('  ✗ buildSessionPlanJson threw', e);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
