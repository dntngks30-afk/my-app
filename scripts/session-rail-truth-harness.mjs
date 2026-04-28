/**
 * Session rail truth harness — pure generator observation (no HTTP, no session-gen-cache).
 *
 * Run:
 *   npx tsx scripts/session-rail-truth-harness.mjs
 *   npx tsx scripts/session-rail-truth-harness.mjs --mode static-neutral
 *   npx tsx scripts/session-rail-truth-harness.mjs --mode adaptive-branch
 *   npx tsx scripts/session-rail-truth-harness.mjs --mode secondary-type-ab
 *   npx tsx scripts/session-rail-truth-harness.mjs --mode all
 *   npx tsx scripts/session-rail-truth-harness.mjs --template-source fixture-48 --out-dir artifacts/session-rail-48
 *
 * --template-source: auto (default) | supabase | static-28 | fixture-48
 * --fixture-path: optional path to exercise-templates-session-plan-m01-m48.v1.json
 *
 * See: docs/pr/PR-SESSION-RAIL-TRUTH-HARNESS-01.md
 */

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

// plan-generator transitively imports exercise-templates-db → supabase client init.
// Placeholders allow static template fallback when real Supabase is unavailable.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://harness.placeholder.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'harness-placeholder-anon-key';
}

const HARNESS_VERSION = '1.0.0';
const SCRIPT_NAME = 'session-rail-truth-harness.mjs';
const USED_WINDOW_K = 4;

/** Mirrors src/lib/session/profile.ts */
const FREQUENCY_TO_TOTAL = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

const VALID_FREQUENCIES = [2, 3, 4, 5];

/** Mirrors buildSessionDeepSummaryFromPublicResult PRIMARY_TYPE_TO_SESSION_BAND */
const PRIMARY_TO_RESULT_TYPE = {
  LOWER_INSTABILITY: 'LOWER-LIMB',
  LOWER_MOBILITY_RESTRICTION: 'LOWER-LIMB',
  UPPER_IMMOBILITY: 'UPPER-LIMB',
  CORE_CONTROL_DEFICIT: 'LUMBO-PELVIS',
  DECONDITIONED: 'DECONDITIONED',
  STABLE: 'STABLE',
};

/** Mirrors buildSessionDeepSummaryFromPublicResult PRIMARY_TYPE_TO_BASELINE_ANCHOR */
const PRIMARY_TO_BASELINE_ANCHOR = {
  LOWER_INSTABILITY: 'lower_stability',
  LOWER_MOBILITY_RESTRICTION: 'lower_mobility',
  UPPER_IMMOBILITY: 'upper_mobility',
  CORE_CONTROL_DEFICIT: 'trunk_control',
  DECONDITIONED: 'deconditioned',
  STABLE: 'balanced_reset',
};

/** Representative focus tags per primary (aligned with public adapter map). */
const PRIMARY_FOCUS_BY_TYPE = {
  LOWER_INSTABILITY: ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance'],
  LOWER_MOBILITY_RESTRICTION: ['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch', 'lower_chain_stability'],
  UPPER_IMMOBILITY: ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation', 'shoulder_stability'],
  CORE_CONTROL_DEFICIT: ['core_control', 'core_stability', 'global_core'],
  DECONDITIONED: ['full_body_reset', 'core_control', 'lower_chain_stability'],
  STABLE: ['core_stability', 'global_core', 'shoulder_mobility'],
};

/** Representative priority_vector per primary — stable for A/B isolation. */
const PRIORITY_BY_PRIMARY = {
  LOWER_INSTABILITY: { lower_stability: 3, lower_mobility: 1, trunk_control: 1 },
  LOWER_MOBILITY_RESTRICTION: { lower_mobility: 3, lower_stability: 1, trunk_control: 1 },
  UPPER_IMMOBILITY: { upper_mobility: 3, trunk_control: 1, lower_stability: 1 },
  CORE_CONTROL_DEFICIT: { trunk_control: 3, upper_mobility: 1, lower_stability: 1 },
  DECONDITIONED: { deconditioned: 3, trunk_control: 2, lower_stability: 1 },
  STABLE: { trunk_control: 2, upper_mobility: 2, lower_stability: 1 },
};

const BASELINE_LABELS = {
  LOWER_INSTABILITY: 'Lower instability',
  LOWER_MOBILITY_RESTRICTION: 'Lower mobility restriction',
  UPPER_IMMOBILITY: 'Upper immobility',
  CORE_CONTROL_DEFICIT: 'Core control deficit',
  DECONDITIONED: 'Deconditioned',
  STABLE: 'Stable',
};

const PRIMARY_ORDER = [
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
  'DECONDITIONED',
  'STABLE',
];

/**
 * PR-FIRST-SESSION-LOWER-ANCHOR-MAIN-GUARD-01 — mirrors lower-pair-session1-shared.ts (metadata-only).
 */
function isLowerStabilityMainAnchorCandidate(t) {
  const tv = t.target_vector ?? [];
  if (tv.includes('lower_stability')) return true;
  return (t.focus_tags ?? []).some((tag) =>
    ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance', 'core_stability'].includes(tag),
  );
}

function isUpperOnlyMainOffAxisForLowerStability(t) {
  if (!t || !Array.isArray(t.focus_tags)) return false;
  if (isLowerStabilityMainAnchorCandidate(t)) return false;
  return t.focus_tags.some((tag) =>
    ['upper_back_activation', 'shoulder_stability', 'shoulder_mobility', 'upper_mobility'].includes(tag),
  );
}

function poolLooksLikeHasLowerStabilityAnchor(templates) {
  return templates.some(
    (tpl) =>
      tpl &&
      typeof tpl.focus_tags?.length === 'number' &&
      isLowerStabilityMainAnchorCandidate(tpl) &&
      !isUpperOnlyMainOffAxisForLowerStability(tpl) &&
      (tpl.level ?? 1) <= 3,
  );
}

/** lower_stability S1 Main: 금지 upper-only 메타 태그, 풀에 후보가 있으면 Main에 앵커 1개 이상 */
function assertLowerInstabilityLowerStabilityS1MainGuard(plan, templates, fixture, sessionNumber) {
  if (sessionNumber !== 1) return;
  if (fixture.primary_type !== 'LOWER_INSTABILITY') return;
  if ((fixture.baseline_session_anchor ?? '').trim() !== 'lower_stability') return;
  const gv = plan?.meta?.baseline_alignment?.gold_path_vector;
  if (gv !== 'lower_stability') return;
  const byId = new Map(templates.map((x) => [x.id, x]));
  const main = plan?.segments?.find((s) => s.title === 'Main');
  for (const it of main?.items ?? []) {
    const tpl = byId.get(it.templateId);
    if (tpl && isUpperOnlyMainOffAxisForLowerStability(tpl)) {
      throw new Error(
        `[SESSION_RAIL Harness] lower_stability S1 Main must not contain upper-only off-axis templates; got templateId=${it.templateId}, focus_tags=${JSON.stringify(tpl.focus_tags)}, target_vector=${JSON.stringify(tpl.target_vector ?? [])}`,
      );
    }
  }
  if (poolLooksLikeHasLowerStabilityAnchor(templates)) {
    const hasAnchor =
      main?.items?.some((item) => {
        const tpl = byId.get(item.templateId);
        return tpl && isLowerStabilityMainAnchorCandidate(tpl);
      }) ?? false;
    if (!hasAnchor) {
      throw new Error(
        '[SESSION_RAIL Harness] lower_stability S1 Main should contain at least one lower-stability anchor when pool supplies candidates.',
      );
    }
  }
}

function buildBaselineFixture(primary_type) {
  const pain_mode = 'none';
  const safety_mode = 'none';
  return {
    label: BASELINE_LABELS[primary_type] ?? primary_type,
    baseline_session_anchor: PRIMARY_TO_BASELINE_ANCHOR[primary_type],
    resultType: PRIMARY_TO_RESULT_TYPE[primary_type],
    primary_type,
    secondary_type: 'HARNESS_DEFAULT_SECONDARY',
    priority_vector: { ...PRIORITY_BY_PRIMARY[primary_type] },
    pain_mode,
    safety_mode,
    deep_level: 2,
    red_flags: false,
    focus: [...PRIMARY_FOCUS_BY_TYPE[primary_type]],
    avoid: [],
    scoringVersion: 'deep_v2',
    confidence: 0.82,
  };
}

function buildPolicyOptions(fixture) {
  return {
    deepLevel: fixture.deep_level ?? null,
    safetyMode: fixture.safety_mode ?? null,
    redFlags: fixture.red_flags ?? null,
  };
}

function inferTargetVector(focusTags) {
  const hasAny = (tags) => tags.some((tag) => focusTags.includes(tag));
  const vectors = [];
  if (hasAny(['lower_chain_stability', 'glute_medius', 'glute_activation', 'basic_balance'])) {
    vectors.push('lower_stability');
  }
  if (hasAny(['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch', 'calf_release'])) {
    vectors.push('lower_mobility');
  }
  if (hasAny(['core_control', 'core_stability', 'global_core'])) {
    vectors.push('trunk_control');
  }
  if (hasAny(['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability', 'upper_back_activation'])) {
    vectors.push('upper_mobility');
  }
  if (hasAny(['full_body_reset'])) {
    vectors.push('deconditioned');
  }
  return [...new Set(vectors)];
}

function inferPhase(focusTags) {
  const hasAny = (tags) => tags.some((tag) => focusTags.includes(tag));
  if (
    hasAny([
      'full_body_reset',
      'calf_release',
      'upper_trap_release',
      'neck_mobility',
      'thoracic_mobility',
      'shoulder_mobility',
      'hip_flexor_stretch',
      'hip_mobility',
      'ankle_mobility',
    ])
  ) {
    return 'prep';
  }
  if (
    hasAny([
      'core_stability',
      'global_core',
      'upper_back_activation',
      'shoulder_stability',
      'glute_activation',
      'lower_chain_stability',
      'glute_medius',
      'basic_balance',
    ])
  ) {
    return 'main';
  }
  return 'accessory';
}

function deriveDifficulty(level) {
  if (level <= 1) return 'low';
  if (level === 2) return 'medium';
  return 'high';
}

function mapStatic28Templates(et) {
  return et.map((t) => ({
    id: t.id,
    name: t.name,
    level: t.level ?? 1,
    focus_tags: [...(t.focus_tags ?? [])],
    contraindications: [...(t.avoid_tags ?? [])],
    duration_sec: 300,
    media_ref: null,
    is_fallback: t.id === 'M01' || t.id === 'M28',
    phase: t.phase ?? inferPhase(t.focus_tags ?? []),
    target_vector: t.target_vector?.length ? [...t.target_vector] : inferTargetVector(t.focus_tags ?? []),
    difficulty: t.difficulty ?? deriveDifficulty(t.level ?? 1),
    avoid_if_pain_mode: t.avoid_if_pain_mode?.length ? [...t.avoid_if_pain_mode] : null,
    progression_level: t.progression_level ?? 1,
    balance_demand: t.balance_demand ?? 'low',
    complexity: t.complexity ?? 'low',
  }));
}

/**
 * @param {object} opts
 * @param {'auto'|'supabase'|'static-28'|'fixture-48'} [opts.templateSource]
 * @param {string} [opts.fixturePath] default: scripts/fixtures/exercise-templates-session-plan-m01-m48.v1.json
 */
async function loadTemplates(opts = {}) {
  const templateSource = opts.templateSource ?? 'auto';
  const defaultFixture = join(__dirname, 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');
  const fixturePath = opts.fixturePath
    ? opts.fixturePath.startsWith('/') || /^[A-Za-z]:/.test(opts.fixturePath)
      ? opts.fixturePath
      : resolve(root, opts.fixturePath)
    : defaultFixture;

  if (templateSource === 'fixture-48') {
    const raw = readFileSync(fixturePath, 'utf8');
    const data = JSON.parse(raw);
    const arr = data.templates ?? data;
    if (!Array.isArray(arr)) {
      throw new Error('fixture-48: expected templates array in JSON');
    }
    const templates = arr.map((row) => ({
      id: row.id,
      name: row.name,
      level: row.level ?? 1,
      focus_tags: [...(row.focus_tags ?? [])],
      contraindications: [...(row.contraindications ?? [])],
      duration_sec: row.duration_sec ?? 300,
      media_ref: row.media_ref ?? null,
      is_fallback: !!row.is_fallback,
      phase: row.phase ?? null,
      target_vector: row.target_vector?.length ? [...row.target_vector] : null,
      difficulty: row.difficulty ?? null,
      avoid_if_pain_mode:
        row.avoid_if_pain_mode == null
          ? null
          : Array.isArray(row.avoid_if_pain_mode)
            ? [...row.avoid_if_pain_mode]
            : null,
      progression_level: row.progression_level ?? null,
      balance_demand: row.balance_demand ?? null,
      complexity: row.complexity ?? null,
    }));
    return {
      templates,
      source: 'fixture_m01_m48_session_plan_v1',
      template_count: templates.length,
    };
  }

  if (templateSource === 'static-28') {
    const { EXERCISE_TEMPLATES: et } = await import('../src/lib/workout-routine/exercise-templates.ts');
    const templates = mapStatic28Templates(et);
    return {
      templates,
      source: 'static_exercise_templates_28',
      template_count: 28,
    };
  }

  if (templateSource === 'supabase') {
    const { getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts');
    const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
    return {
      templates,
      source: 'supabase_deep_v2',
      template_count: templates.length,
    };
  }

  // auto: try Supabase, fall back to static 28
  try {
    const { getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts');
    const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
    return {
      templates,
      source: 'supabase_deep_v2',
      template_count: templates.length,
    };
  } catch (e) {
    const msg = String(e?.message ?? '');
    const recoverable =
      msg.includes('SUPABASE') ||
      msg.includes('Missing') ||
      msg.includes('fetch failed') ||
      msg.includes('session plan fetch failed');
    if (!recoverable) throw e;
  }

  const { EXERCISE_TEMPLATES: et } = await import('../src/lib/workout-routine/exercise-templates.ts');
  const templates = mapStatic28Templates(et);
  return {
    templates,
    source: 'static_exercise_templates_28',
    template_count: 28,
  };
}

/** Production-like rolling window of used template ids (session/create USED_WINDOW_K). */
function computeUsedTemplateIdsForNextSession(sessionRecords, nextSessionNumber) {
  if (nextSessionNumber <= 1) return [];
  const K = Math.max(1, Math.min(8, USED_WINDOW_K));
  const low = Math.max(1, nextSessionNumber - K);
  const high = nextSessionNumber - 1;
  const set = new Set();
  for (const rec of sessionRecords) {
    if (rec.session_number >= low && rec.session_number <= high) {
      for (const id of rec.used_template_ids ?? []) {
        set.add(id);
      }
    }
  }
  return Array.from(set);
}

function getAdaptiveFixtureForBranch(branch, sessionNumber) {
  if (branch === 'neutral') {
    return { adaptiveOverlay: undefined, volumeModifier: undefined, conditionMood: 'ok' };
  }
  if (branch === 'low_tolerance_or_pain_flare') {
    if (sessionNumber <= 1) {
      return { adaptiveOverlay: undefined, volumeModifier: undefined, conditionMood: 'ok' };
    }
    return {
      adaptiveOverlay: {
        forceRecovery: true,
        targetLevelDelta: -1,
        maxDifficultyCap: 'medium',
      },
      volumeModifier: -0.25,
      conditionMood: 'ok',
    };
  }
  if (branch === 'high_tolerance') {
    if (sessionNumber <= 1) {
      return { adaptiveOverlay: undefined, volumeModifier: undefined, conditionMood: 'ok' };
    }
    return {
      adaptiveOverlay: { targetLevelDelta: 1 },
      volumeModifier: 0.15,
      conditionMood: 'ok',
    };
  }
  throw new Error(`Unknown adaptive branch: ${branch}`);
}

function segmentsSummary(plan) {
  return (plan.segments ?? []).map((seg) => ({
    title: seg.title,
    item_count: (seg.items ?? []).length,
    items: (seg.items ?? []).map((it) => ({
      templateId: it.templateId,
      name: it.name,
      focus_tag: it.focus_tag ?? null,
    })),
  }));
}

function metaDiffFriendly(plan, fixture) {
  const m = plan.meta ?? {};
  return {
    session_focus_axes: m.session_focus_axes ?? [],
    primary_type: m.primary_type ?? fixture.primary_type,
    secondary_type: m.secondary_type ?? fixture.secondary_type,
    baseline_session_anchor: m.baseline_alignment?.baseline_session_anchor ?? fixture.baseline_session_anchor,
    result_type: m.result_type ?? fixture.resultType,
  };
}

function planQualityAuditSummary(plan) {
  const a = plan.meta?.plan_quality_audit;
  if (!a || typeof a !== 'object') return null;
  return {
    version: a.version ?? null,
    score: a.score ?? null,
    band: a.band ?? null,
    summary: a.summary ?? null,
    issue_count: Array.isArray(a.issues) ? a.issues.length : 0,
    strengths_count: Array.isArray(a.strengths) ? a.strengths.length : 0,
  };
}

function orderedSegmentTemplateIds(plan) {
  const out = [];
  for (const seg of plan.segments ?? []) {
    for (const it of seg.items ?? []) {
      out.push({ segment: seg.title, id: it.templateId });
    }
  }
  return out;
}

function stableStringify(x) {
  return JSON.stringify(x, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          acc[k] = v[k];
          return acc;
        }, {});
    }
    return v;
  });
}

function compareSecondaryAbSession(rowA, rowB) {
  const confounderOk =
    rowA.input_locked?.baseline_session_anchor === rowB.input_locked?.baseline_session_anchor &&
    rowA.input_locked?.primary_type === rowB.input_locked?.primary_type &&
    stableStringify(rowA.input_locked?.priority_vector) === stableStringify(rowB.input_locked?.priority_vector) &&
    rowA.input_locked?.secondary_type_a !== rowB.input_locked?.secondary_type_b;

  const idsA = stableStringify(orderedSegmentTemplateIds(rowA.plan));
  const idsB = stableStringify(orderedSegmentTemplateIds(rowB.plan));
  const axesA = stableStringify(rowA.plan?.meta?.session_focus_axes ?? []);
  const axesB = stableStringify(rowB.plan?.meta?.session_focus_axes ?? []);
  const ratA = rowA.plan?.meta?.session_rationale ?? null;
  const ratB = rowB.plan?.meta?.session_rationale ?? null;

  const segmentsSame = idsA === idsB;
  const axesSame = axesA === axesB;
  const rationaleSame = ratA === ratB;

  const metaA = metaDiffFriendly(rowA.plan, rowA.fixture);
  const metaB = metaDiffFriendly(rowB.plan, rowB.fixture);
  const metaStripSecondary = (m) => {
    const { secondary_type: _s, ...rest } = m;
    return rest;
  };
  const metaOtherSame = stableStringify(metaStripSecondary(metaA)) === stableStringify(metaStripSecondary(metaB));

  let classification = 'inconclusive';
  if (!confounderOk) classification = 'inconclusive';
  else if (segmentsSame && axesSame && rationaleSame && metaOtherSame) {
    classification = 'metadata_only_strong';
  } else if (segmentsSame && axesSame && rationaleSame) {
    classification = 'metadata_only';
  } else if (!segmentsSame || !axesSame || !rationaleSame) {
    classification = 'material_generation_diff';
  }

  return {
    confounder_check_ok: confounderOk,
    segments_identical: segmentsSame,
    session_focus_axes_identical: axesSame,
    rationale_identical: rationaleSame,
    meta_except_secondary_identical: metaOtherSame,
    classification,
    changed_fields: collectChangedFields(rowA, rowB),
  };
}

function collectChangedFields(rowA, rowB) {
  const fields = [];
  if (stableStringify(orderedSegmentTemplateIds(rowA.plan)) !== stableStringify(orderedSegmentTemplateIds(rowB.plan))) {
    fields.push('segment_template_selection');
  }
  if (stableStringify(rowA.plan?.meta?.session_focus_axes) !== stableStringify(rowB.plan?.meta?.session_focus_axes)) {
    fields.push('session_focus_axes');
  }
  if ((rowA.plan?.meta?.session_rationale ?? null) !== (rowB.plan?.meta?.session_rationale ?? null)) {
    fields.push('session_rationale');
  }
  if (stableStringify(rowA.plan?.meta?.constraint_flags) !== stableStringify(rowB.plan?.meta?.constraint_flags)) {
    fields.push('constraint_flags');
  }
  if (stableStringify(planQualityAuditSummary(rowA.plan)) !== stableStringify(planQualityAuditSummary(rowB.plan))) {
    fields.push('plan_quality_audit_summary');
  }
  return fields;
}

async function materializeRail({
  buildSessionPlanJson,
  computePhase,
  resolvePhaseLengths,
  buildTheme,
  templates,
  fixture,
  targetFrequency,
  adaptiveBranch,
  secondaryTypeOverride,
  volumeModifierOverride,
  adaptiveOverlayOverride,
  conditionMoodOverride,
  templatePoolSource,
  templateCount,
}) {
  const totalSessions = FREQUENCY_TO_TOTAL[targetFrequency];
  const policyOptions = buildPolicyOptions(fixture);
  const phaseLengthsArr = resolvePhaseLengths(totalSessions, policyOptions);
  const phaseLengths = [...phaseLengthsArr];

  const sessionRows = [];
  const recordsForWindow = [];

  for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber++) {
    const phase = computePhase(totalSessions, sessionNumber, {
      phaseLengths: phaseLengthsArr,
      policyOptions,
    });
    const theme = buildTheme(sessionNumber, totalSessions, {
      result_type: fixture.resultType,
      focus: fixture.focus,
    }, { phaseLengths: phaseLengthsArr, policyOptions });

    const usedTemplateIds = computeUsedTemplateIdsForNextSession(recordsForWindow, sessionNumber);

    const secondary_type =
      secondaryTypeOverride !== undefined ? secondaryTypeOverride : fixture.secondary_type;

    const branch = adaptiveBranch ?? 'neutral';
    const {
      adaptiveOverlay: branchOverlay,
      volumeModifier: branchVm,
      conditionMood: branchMood,
    } = getAdaptiveFixtureForBranch(branch, sessionNumber);

    const adaptiveOverlay = adaptiveOverlayOverride ?? branchOverlay;
    const volumeModifier = volumeModifierOverride ?? branchVm;
    const conditionMood = conditionMoodOverride ?? branchMood;

    const plan = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber,
      totalSessions,
      phase,
      theme,
      timeBudget: 'normal',
      conditionMood,
      focus: fixture.focus,
      avoid: fixture.avoid,
      painFlags: [],
      usedTemplateIds,
      resultType: fixture.resultType,
      confidence: fixture.confidence,
      scoringVersion: fixture.scoringVersion,
      deep_level: fixture.deep_level,
      pain_risk: fixture.pain_risk,
      red_flags: fixture.red_flags,
      safety_mode: fixture.safety_mode,
      primary_type: fixture.primary_type,
      secondary_type,
      priority_vector: fixture.priority_vector,
      pain_mode: fixture.pain_mode,
      adaptiveOverlay,
      volumeModifier,
      baseline_session_anchor: fixture.baseline_session_anchor,
    });

    assertLowerInstabilityLowerStabilityS1MainGuard(plan, templates, fixture, sessionNumber);

    const usedIds = plan.meta?.used_template_ids ?? [];
    recordsForWindow.push({
      session_number: sessionNumber,
      used_template_ids: usedIds,
    });

    const m = plan.meta ?? {};
    const row = {
      session_number: sessionNumber,
      total_sessions: totalSessions,
      target_frequency: targetFrequency,
      phase,
      phase_lengths: phaseLengths,
      theme,
      result_type: m.result_type ?? fixture.resultType,
      primary_type: m.primary_type ?? fixture.primary_type,
      secondary_type,
      baseline_session_anchor: fixture.baseline_session_anchor,
      session_focus_axes: m.session_focus_axes ?? [],
      session_rationale: m.session_rationale ?? null,
      used_template_ids: usedIds,
      constraint_flags: m.constraint_flags ?? null,
      baseline_alignment: m.baseline_alignment ?? null,
      plan_quality_audit_summary: planQualityAuditSummary(plan),
      first_session_intent_anchor: m.baseline_alignment?.first_session_intent_anchor ?? null,
      gold_path_vector: m.baseline_alignment?.gold_path_vector ?? null,
      main_segment_template_ids: (plan.segments ?? [])
        .find((s) => s.title === 'Main')
        ?.items?.map((it) => it.templateId) ?? [],
      all_template_ids: orderedSegmentTemplateIds(plan).map((x) => x.id),
      segments: segmentsSummary(plan),
      template_pool_source: templatePoolSource,
      template_count: templateCount,
      meta_diff_friendly: metaDiffFriendly(plan, { ...fixture, secondary_type }),
      plan,
    };
    sessionRows.push(row);
  }

  return {
    fixture_label: fixture.label,
    primary_type: fixture.primary_type,
    target_frequency: targetFrequency,
    total_sessions: totalSessions,
    phase_lengths: phaseLengths,
    adaptive_branch: adaptiveBranch ?? 'neutral',
    sessions: sessionRows.map(({ plan: _p, ...rest }) => rest),
    _embedded_plans_for_harness: sessionRows.map((r) => r.plan),
  };
}

/** Strip in-memory plans before writing JSON artifacts. */
function railToJsonSafe(rail) {
  const { _embedded_plans_for_harness: _e, ...rest } = rail;
  return rest;
}

function phaseDistributionTableMarkdown(resolvePhaseLengths, computePhase, policyOptions) {
  const lines = ['| total_sessions | Phase1 | Phase2 | Phase3 | Phase4 |', '| --- | --- | --- | --- | --- |'];
  for (const total of [8, 12, 16, 20]) {
    const pl = [...resolvePhaseLengths(total, policyOptions)];
    const ranges = [];
    let start = 1;
    for (let p = 0; p < 4; p++) {
      const len = pl[p];
      const end = start + len - 1;
      ranges.push(len > 0 ? `${start}–${end}` : '—');
      start = end + 1;
    }
    lines.push(`| ${total} | ${ranges[0]} | ${ranges[1]} | ${ranges[2]} | ${ranges[3]} |`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const out = {
    mode: 'all',
    outDir: join(root, 'artifacts', 'session-rail'),
    templateSource: 'auto',
    fixturePath: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode' && argv[i + 1]) {
      out.mode = argv[i + 1];
      i++;
    } else if (a === '--out-dir' && argv[i + 1]) {
      out.outDir = argv[i + 1].startsWith('/') || /^[A-Za-z]:/.test(argv[i + 1])
        ? argv[i + 1]
        : join(root, argv[i + 1]);
      i++;
    } else if (a === '--template-source' && argv[i + 1]) {
      out.templateSource = argv[i + 1];
      i++;
    } else if (a === '--fixture-path' && argv[i + 1]) {
      out.fixturePath = argv[i + 1];
      i++;
    }
  }
  return out;
}

function aggregateSecondaryClassification(abResults) {
  let sawAny = false;
  let anyMaterial = false;
  let anyInconclusive = false;
  for (const caseResult of abResults) {
    for (const cmp of caseResult.session_comparisons ?? []) {
      sawAny = true;
      const c = cmp.comparison?.classification;
      if (c === 'material_generation_diff') anyMaterial = true;
      if (c === 'inconclusive') anyInconclusive = true;
    }
  }
  if (!sawAny) return 'inconclusive';
  if (anyMaterial) return 'secondary_type materially affects generation';
  if (anyInconclusive) return 'inconclusive';
  return 'secondary_type metadata-only';
}

async function main() {
  const { mode, outDir, templateSource, fixturePath } = parseArgs(process.argv.slice(2));
  const modesToRun =
    mode === 'all'
      ? ['static-neutral', 'adaptive-branch', 'secondary-type-ab']
      : [mode];

  const [{ buildSessionPlanJson }, { computePhase, resolvePhaseLengths }, { buildTheme }] = await Promise.all([
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/phase.ts'),
    import('../src/app/api/session/create/_lib/helpers.ts'),
  ]);

  const loadOpts = { templateSource, ...(fixturePath ? { fixturePath } : {}) };
  const { templates, source: templateSourceResolved, template_count: templateCount } = await loadTemplates(loadOpts);
  const generatedAt = new Date().toISOString();

  const baselineFixtures = PRIMARY_ORDER.map((p) => buildBaselineFixture(p));
  const staticNeutralResults = [];
  const adaptiveResults = [];
  const secondaryAbResults = [];

  const metaHeader = {
    harness_version: HARNESS_VERSION,
    script: SCRIPT_NAME,
    generated_at: generatedAt,
    template_pool_source: templateSourceResolved,
    template_count: templateCount,
    modes: modesToRun,
    note: 'Direct buildSessionPlanJson calls only — no HTTP, no session-gen-cache.',
  };

  if (modesToRun.includes('static-neutral')) {
    const dir = join(outDir, 'static-neutral');
    mkdirSync(dir, { recursive: true });
    for (const fx of baselineFixtures) {
      for (const freq of VALID_FREQUENCIES) {
        const rail = await materializeRail({
          buildSessionPlanJson,
          computePhase,
          resolvePhaseLengths,
          buildTheme,
          templates,
          fixture: fx,
          targetFrequency: freq,
          adaptiveBranch: 'neutral',
          templatePoolSource: templateSourceResolved,
          templateCount: templateCount,
        });
        staticNeutralResults.push(rail);
        const fname = `${fx.primary_type}_freq${freq}.json`;
        writeFileSync(
          join(dir, fname),
          JSON.stringify(
            {
              ...metaHeader,
              mode: 'static-neutral',
              case_label: `${fx.primary_type}×freq${freq}`,
              ...railToJsonSafe(rail),
            },
            null,
            2
          ) + '\n'
        );
      }
    }
    writeFileSync(
      join(dir, 'rail-matrix.json'),
      JSON.stringify(
        {
          ...metaHeader,
          mode: 'static-neutral',
          matrix: staticNeutralResults.map((r) => ({
            primary_type: r.primary_type,
            target_frequency: r.target_frequency,
            total_sessions: r.total_sessions,
            phase_lengths: r.phase_lengths,
            sessions: r.sessions,
          })),
        },
        null,
        2
      ) + '\n'
    );
  }

  if (modesToRun.includes('adaptive-branch')) {
    const dir = join(outDir, 'adaptive-branch');
    mkdirSync(dir, { recursive: true });
    const branches = ['neutral', 'low_tolerance_or_pain_flare', 'high_tolerance'];
    for (const branch of branches) {
      const branchRails = [];
      for (const fx of baselineFixtures) {
        for (const freq of VALID_FREQUENCIES) {
          const rail = await materializeRail({
            buildSessionPlanJson,
            computePhase,
            resolvePhaseLengths,
            buildTheme,
            templates,
            fixture: fx,
            targetFrequency: freq,
            adaptiveBranch: branch,
            templatePoolSource: templateSourceResolved,
            templateCount: templateCount,
          });
          branchRails.push(rail);
        }
      }
      adaptiveResults.push({ branch, rails: branchRails });
      writeFileSync(
        join(dir, `${branch}.json`),
        JSON.stringify(
          {
            ...metaHeader,
            mode: 'adaptive-branch',
            branch,
            rails: branchRails.map(railToJsonSafe),
          },
          null,
          2
        ) + '\n'
      );
    }
    writeFileSync(
      join(dir, 'comparison.json'),
      JSON.stringify(
        {
          ...metaHeader,
          mode: 'adaptive-branch',
          adaptiveResults: adaptiveResults.map((ar) => ({
            branch: ar.branch,
            rails: ar.rails.map(railToJsonSafe),
          })),
        },
        null,
        2
      ) + '\n'
    );
  }

  if (modesToRun.includes('secondary-type-ab')) {
    const dir = join(outDir, 'secondary-type-ab');
    mkdirSync(dir, { recursive: true });
    const SECONDARY_A = 'HARNESS_AB_SECONDARY_ALPHA';
    const SECONDARY_B = 'HARNESS_AB_SECONDARY_BETA';

    for (const fx of baselineFixtures) {
      for (const freq of VALID_FREQUENCIES) {
        const railA = await materializeRail({
          buildSessionPlanJson,
          computePhase,
          resolvePhaseLengths,
          buildTheme,
          templates,
          fixture: fx,
          targetFrequency: freq,
          adaptiveBranch: 'neutral',
          secondaryTypeOverride: SECONDARY_A,
          templatePoolSource: templateSourceResolved,
          templateCount: templateCount,
        });
        const railB = await materializeRail({
          buildSessionPlanJson,
          computePhase,
          resolvePhaseLengths,
          buildTheme,
          templates,
          fixture: fx,
          targetFrequency: freq,
          adaptiveBranch: 'neutral',
          secondaryTypeOverride: SECONDARY_B,
          templatePoolSource: templateSourceResolved,
          templateCount: templateCount,
        });

        const session_comparisons = [];
        for (let i = 0; i < railA.sessions.length; i++) {
          const rowA = {
            ...railA.sessions[i],
            plan: railA._embedded_plans_for_harness[i],
            fixture: fx,
            input_locked: {
              baseline_session_anchor: fx.baseline_session_anchor,
              primary_type: fx.primary_type,
              priority_vector: fx.priority_vector,
              secondary_type_a: SECONDARY_A,
            },
          };
          const rowB = {
            ...railB.sessions[i],
            plan: railB._embedded_plans_for_harness[i],
            fixture: { ...fx, secondary_type: SECONDARY_B },
            input_locked: {
              baseline_session_anchor: fx.baseline_session_anchor,
              primary_type: fx.primary_type,
              priority_vector: fx.priority_vector,
              secondary_type_b: SECONDARY_B,
            },
          };
          session_comparisons.push({
            session_number: rowA.session_number,
            comparison: compareSecondaryAbSession(rowA, rowB),
          });
        }

        const caseResult = {
          case_label: `${fx.primary_type}_freq${freq}`,
          primary_type: fx.primary_type,
          target_frequency: freq,
          secondary_a: SECONDARY_A,
          secondary_b: SECONDARY_B,
          session_comparisons,
          confounder_assertions: {
            anchor_primary_priority_unchanged: true,
            only_secondary_type_varies_in_generator_input: true,
          },
        };
        secondaryAbResults.push(caseResult);
        writeFileSync(
          join(dir, `${fx.primary_type}_freq${freq}_ab.json`),
          JSON.stringify({ ...metaHeader, mode: 'secondary-type-ab', ...caseResult }, null, 2) + '\n'
        );
      }
    }
    writeFileSync(
      join(dir, 'ab-summary.json'),
      JSON.stringify(
        {
          ...metaHeader,
          mode: 'secondary-type-ab',
          cases: secondaryAbResults,
          final_classification: aggregateSecondaryClassification(secondaryAbResults),
        },
        null,
        2
      ) + '\n'
    );
  }

  const equalPolicy = buildPolicyOptions(baselineFixtures[0]);
  const phaseMd = phaseDistributionTableMarkdown(resolvePhaseLengths, computePhase, equalPolicy);

  const finalSecondaryClass =
    secondaryAbResults.length > 0
      ? aggregateSecondaryClassification(secondaryAbResults)
      : '(run --mode secondary-type-ab or all)';

  const md = `# Session rail truth summary

Generated: ${generatedAt}
Harness: ${SCRIPT_NAME} v${HARNESS_VERSION}
Template pool: ${templateSourceResolved} (count=${templateCount})

## 1. Executive summary

- **Rail model:** Next-session materialization only — this harness calls \`buildSessionPlanJson\` once per session index with a production-like \`usedTemplateIds\` rolling window (last ${USED_WINDOW_K} sessions).
- **Frequency:** \`target_frequency\` 2/3/4/5 maps to \`total_sessions\` 8/12/16/20 (see section 2).
- **secondary_type A/B:** Final classification from this run: **${finalSecondaryClass}**

## 2. Frequency → total_sessions truth

| target_frequency | total_sessions |
| --- | --- |
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |

## 3. Phase distribution (equal policy fixture: deep_level=2, safety none, red_flags false)

${phaseMd}

## 4. Six baseline type rail summary

Static-neutral artifacts: \`${join(outDir, 'static-neutral')}\`
- Per case: \`*_freq*.json\`
- Matrix: \`rail-matrix.json\`

## 5. Adaptive branch comparison

Branches: \`neutral\`, \`low_tolerance_or_pain_flare\`, \`high_tolerance\` (overlay/modifier injected from session 2+; session 1 identical).

Artifacts: \`${join(outDir, 'adaptive-branch')}\`

## 6. secondary_type A/B summary

Artifacts: \`${join(outDir, 'secondary-type-ab')}\`
- \`ab-summary.json\` — per-session classification + aggregate.

## 7. Final classification (secondary_type)

**${finalSecondaryClass}**

---

## Manual interpretation guide

- **metadata-only:** segment template ids, focus axes, and rationale match between A/B; only \`secondary_type\` (and derived meta echo) differs.
- **material:** any session shows different template selection or rationale/focus axes.
- **inconclusive:** confounder check failed or mixed outcomes.

`;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'SESSION_RAIL_SUMMARY.md'), md);

  console.log(`Session rail truth harness complete.`);
  console.log(`Out dir: ${outDir}`);
  console.log(`Template pool: ${templateSourceResolved} (count=${templateCount})`);
  console.log(`secondary_type classification: ${finalSecondaryClass}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
