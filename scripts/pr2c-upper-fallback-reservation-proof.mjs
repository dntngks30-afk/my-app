/**
 * PR2-C follow-up 3 proof:
 * verify upper-main reservation also holds in final conservative fallback pass
 * for both materialized(plan-generator) and preview(bootstrap-summary) paths.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const RESERVED_IDS = new Set(['U_MAIN_1', 'U_MAIN_2']);

function topCounts(items, limit = 4) {
  const map = new Map();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function collectVectors(segmentCarrier, templateById, title) {
  const seg = segmentCarrier.segments.find((s) => s.title === title);
  const vectors = [];
  for (const item of seg?.items ?? []) {
    const t = templateById.get(item.templateId);
    for (const v of t?.target_vector ?? []) vectors.push(v);
  }
  return topCounts(vectors);
}

function hasReservedInNonMain(segmentCarrier) {
  for (const seg of segmentCarrier.segments) {
    if (seg.title === 'Main') continue;
    for (const item of seg.items ?? []) {
      if (RESERVED_IDS.has(item.templateId)) return true;
    }
  }
  return false;
}

function buildSparseTemplatePool() {
  return [
    {
      id: 'U_MAIN_1',
      name: '상체 메인 안정화 A',
      level: 2,
      focus_tags: ['shoulder_stability', 'core_control'],
      contraindications: [],
      duration_sec: 300,
      media_ref: null,
      is_fallback: false,
      phase: 'main',
      target_vector: ['upper_mobility'],
      difficulty: 'medium',
      avoid_if_pain_mode: null,
      progression_level: 2,
      balance_demand: 'low',
      complexity: 'low',
    },
    {
      id: 'U_MAIN_2',
      name: '상체 메인 활성화 B',
      level: 2,
      focus_tags: ['upper_back_activation', 'thoracic_mobility'],
      contraindications: [],
      duration_sec: 300,
      media_ref: null,
      is_fallback: false,
      phase: 'main',
      target_vector: ['upper_mobility'],
      difficulty: 'medium',
      avoid_if_pain_mode: null,
      progression_level: 1,
      balance_demand: 'low',
      complexity: 'low',
    },
    {
      id: 'PREP_ONLY_1',
      name: '흉추 프렙',
      level: 1,
      focus_tags: ['thoracic_mobility'],
      contraindications: [],
      duration_sec: 300,
      media_ref: null,
      is_fallback: false,
      phase: 'prep',
      target_vector: ['upper_mobility'],
      difficulty: 'low',
      avoid_if_pain_mode: null,
      progression_level: 1,
      balance_demand: 'low',
      complexity: 'low',
    },
    {
      id: 'DECOND_1',
      name: '회복 리셋',
      level: 1,
      focus_tags: ['full_body_reset'],
      contraindications: [],
      duration_sec: 300,
      media_ref: null,
      is_fallback: false,
      phase: 'prep',
      target_vector: ['deconditioned'],
      difficulty: 'low',
      avoid_if_pain_mode: null,
      progression_level: 1,
      balance_demand: 'low',
      complexity: 'low',
    },
  ];
}

async function run() {
  const [{ buildSessionPlanJson }, { buildSessionBootstrapSummaryFromTemplates }] = await Promise.all([
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/bootstrap-summary.ts'),
  ]);

  const templates = buildSparseTemplatePool();
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const plan = await buildSessionPlanJson({
    templatePool: templates,
    sessionNumber: 1,
    totalSessions: 16,
    phase: 1,
    theme: 'PR2-C fallback reservation proof',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: ['shoulder_mobility', 'thoracic_mobility'],
    avoid: [],
    painFlags: [],
    usedTemplateIds: [],
    scoringVersion: 'deep_v3',
    deep_level: 2,
    safety_mode: 'yellow',
    resultType: 'UPPER-LIMB',
    primary_type: 'UPPER_IMMOBILITY',
    secondary_type: null,
    priority_vector: {
      lower_stability: 0,
      lower_mobility: 0,
      upper_mobility: 1,
      trunk_control: 0,
      deconditioned: 0.2,
    },
    pain_mode: 'caution',
    baseline_session_anchor: 'upper_mobility',
  });

  const preview = buildSessionBootstrapSummaryFromTemplates(templates, {
    sessionNumber: 1,
    deepSummary: {
      focus: ['shoulder_mobility', 'thoracic_mobility'],
      avoid: [],
      deep_level: 2,
      safety_mode: 'yellow',
      red_flags: false,
      primary_type: 'UPPER_IMMOBILITY',
      secondary_type: null,
      priority_vector: {
        lower_stability: 0,
        lower_mobility: 0,
        upper_mobility: 1,
        trunk_control: 0,
        deconditioned: 0.2,
      },
      pain_mode: 'caution',
      result_type: 'UPPER-LIMB',
      baseline_session_anchor: 'upper_mobility',
    },
  });

  const planMainVectors = collectVectors(plan, templateById, 'Main');
  const previewMainVectors = collectVectors(preview, templateById, 'Main');

  const out = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-C follow-up 3: fallback-pass upper reservation proof',
    sparse_fixture_template_ids: templates.map((t) => t.id),
    reserved_main_candidate_ids: [...RESERVED_IDS],
    materialized: {
      segment_ids: plan.segments.map((s) => ({ title: s.title, ids: s.items.map((i) => i.templateId) })),
      main_vectors_top: planMainVectors,
      non_main_reserved_leak: hasReservedInNonMain(plan),
      first_session_guardrail_applied: plan.meta?.constraint_flags?.first_session_guardrail_applied ?? null,
    },
    preview: {
      segment_ids: preview.segments.map((s) => ({ title: s.title, ids: s.items.map((i) => i.templateId) })),
      main_vectors_top: previewMainVectors,
      non_main_reserved_leak: hasReservedInNonMain(preview),
      first_session_guardrail_applied:
        Array.isArray(preview.constraint_flags) && preview.constraint_flags.includes('first_session_guardrail_applied'),
    },
    checks: {
      materialized_no_non_main_leak: !hasReservedInNonMain(plan),
      preview_no_non_main_leak: !hasReservedInNonMain(preview),
      materialized_main_upper_dominant: planMainVectors.some((v) => v.key === 'upper_mobility'),
      preview_main_upper_dominant: previewMainVectors.some((v) => v.key === 'upper_mobility'),
      guardrail_kept:
        plan.meta?.constraint_flags?.first_session_guardrail_applied === true &&
        Array.isArray(preview.constraint_flags) &&
        preview.constraint_flags.includes('first_session_guardrail_applied'),
    },
  };

  const outPath = join(process.cwd(), 'artifacts/pr2c/upper-fallback-reservation-proof.json');
  mkdirSync(join(process.cwd(), 'artifacts/pr2c'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote fallback-pass reservation proof: ${outPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
