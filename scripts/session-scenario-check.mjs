/**
 * PR-ALG-07: Session scenario check
 * Run: npx tsx scripts/session-scenario-check.mjs
 * Validates: deep summary -> session plan. Requires Supabase env.
 * Skips when DB unavailable (like plan-generator-smoke).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const personasPath = join(projectRoot, 'src/lib/deep-test/scenarios/personas.json');
const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));

async function run() {
  let mod;
  try {
    mod = await import('../src/lib/session/plan-generator.ts');
  } catch (e) {
    if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing')) {
      console.log('SKIP: Supabase env required for session-scenario-check.');
      process.exit(0);
    }
    throw e;
  }

  const { buildSessionPlanJson } = mod;
  const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
  const { calculateDeepV3 } = dv;

  let passed = 0;
  let failed = 0;

  for (const p of personas) {
    try {
      const v3 = calculateDeepV3(p.input);
      const derived = v3.derived || {};
      const focus = derived.focus_tags || [];
      const avoid = derived.avoid_tags || [];

      const plan = await buildSessionPlanJson({
        sessionNumber: 1,
        totalSessions: 16,
        phase: 1,
        theme: 'Phase 1 · test',
        timeBudget: 'normal',
        conditionMood: 'ok',
        focus,
        avoid,
        painFlags: [],
        usedTemplateIds: [],
        scoringVersion: 'deep_v3',
        deep_level: derived.level ?? 2,
        safety_mode: v3.pain_mode === 'protected' ? 'red' : v3.pain_mode === 'caution' ? 'yellow' : 'none',
        primary_type: v3.primary_type,
        pain_mode: v3.pain_mode,
      });

      const hints = p.expected_plan_hints || {};
      const preferred = hints.preferred_target_vectors || [];
      const avoided = hints.avoided_characteristics || [];
      const bias = hints.expected_session_bias || '';

      if (!Array.isArray(plan.segments) || plan.segments.length === 0) {
        throw new Error('plan has no segments');
      }

      const planFocus = plan.meta?.focus || [];
      const planAvoid = plan.meta?.avoid || [];
      const allFocusTags = new Set(
        plan.segments.flatMap((s) => s.items.flatMap((i) => (i.focus_tag ? [i.focus_tag] : [])))
      );

      if (preferred.length > 0) {
        const hasOverlap =
          planFocus.some((f) => preferred.includes(f)) ||
          [...allFocusTags].some((f) => preferred.includes(f));
        if (!hasOverlap) {
          throw new Error(
            `expected preferred overlap; plan focus=[${planFocus.join(',')}], preferred=[${preferred.join(',')}]`
          );
        }
      }

      if (avoided.length > 0) {
        const avoidApplied =
          planAvoid.some((a) => avoided.includes(a)) || plan.meta?.constraint_flags?.avoid_filter_applied;
        if (!avoidApplied) {
          throw new Error(
            `expected avoid applied; plan avoid=[${planAvoid.join(',')}], avoided=[${avoided.join(',')}]`
          );
        }
      }

      passed++;
      if (process.env.DEBUG) {
        console.log(`  ${p.id}: plan ok (${plan.segments.length} segments)`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
