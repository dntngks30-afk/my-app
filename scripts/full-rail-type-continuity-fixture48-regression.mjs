/**
 * PR-FULL-RAIL-TYPE-CONTINUITY-VERIFY-01
 * 6 primary × 4 freq × full monthly rail — phase/session type identity checks (fixture-48, no Supabase).
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://harness.placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'harness-placeholder-anon-key';

const TEMPLATE_SOURCE_EXPECT = 'fixture_m01_m48_session_plan_v1';
const TEMPLATE_COUNT_EXPECT = 48;
const PRIMARY_ORDER = [
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
  'DECONDITIONED',
  'STABLE',
];
const VALID_FREQUENCIES = [2, 3, 4, 5];
const FREQUENCY_TO_TOTAL = { 2: 8, 3: 12, 4: 16, 5: 20 };
const USED_WINDOW_K = 4;

const PRIMARY_TO_RESULT_TYPE = {
  LOWER_INSTABILITY: 'LOWER-LIMB',
  LOWER_MOBILITY_RESTRICTION: 'LOWER-LIMB',
  UPPER_IMMOBILITY: 'UPPER-LIMB',
  CORE_CONTROL_DEFICIT: 'LUMBO-PELVIS',
  DECONDITIONED: 'DECONDITIONED',
  STABLE: 'STABLE',
};

const PRIMARY_TO_BASELINE_ANCHOR = {
  LOWER_INSTABILITY: 'lower_stability',
  LOWER_MOBILITY_RESTRICTION: 'lower_mobility',
  UPPER_IMMOBILITY: 'upper_mobility',
  CORE_CONTROL_DEFICIT: 'trunk_control',
  DECONDITIONED: 'deconditioned',
  STABLE: 'balanced_reset',
};

const PRIMARY_FOCUS_BY_TYPE = {
  LOWER_INSTABILITY: ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance'],
  LOWER_MOBILITY_RESTRICTION: [
    'hip_mobility',
    'ankle_mobility',
    'hip_flexor_stretch',
    'lower_chain_stability',
  ],
  UPPER_IMMOBILITY: ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation', 'shoulder_stability'],
  CORE_CONTROL_DEFICIT: ['core_control', 'core_stability', 'global_core'],
  DECONDITIONED: ['full_body_reset', 'core_control', 'lower_chain_stability'],
  STABLE: ['core_stability', 'global_core', 'shoulder_mobility'],
};

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

const RESET_FOCUS_TAGS = new Set([
  'full_body_reset',
  'calf_release',
  'upper_trap_release',
  'neck_mobility',
  'thoracic_mobility',
  'hip_flexor_stretch',
  'hip_mobility',
  'ankle_mobility',
  'core_control',
]);
const LOWER_RESET_TAGS = new Set(['hip_mobility', 'ankle_mobility', 'calf_release', 'hip_flexor_stretch']);

const SINGLE_LEG_FOCUS = new Set(['basic_balance', 'glute_medius', 'lower_chain_stability']);

function buildPolicyOptions(fixture) {
  return {
    deepLevel: fixture.deep_level ?? null,
    safetyMode: fixture.safety_mode ?? null,
    redFlags: fixture.red_flags ?? null,
  };
}

function buildBaselineFixture(primary_type) {
  return {
    label: BASELINE_LABELS[primary_type] ?? primary_type,
    baseline_session_anchor: PRIMARY_TO_BASELINE_ANCHOR[primary_type],
    resultType: PRIMARY_TO_RESULT_TYPE[primary_type],
    primary_type,
    secondary_type: 'HARNESS_DEFAULT_SECONDARY',
    priority_vector: { ...PRIORITY_BY_PRIMARY[primary_type] },
    pain_mode: 'none',
    safety_mode: 'none',
    deep_level: 2,
    red_flags: false,
    focus: [...PRIMARY_FOCUS_BY_TYPE[primary_type]],
    avoid: [],
    scoringVersion: 'deep_v2',
    confidence: 0.82,
  };
}

function loadFixture48() {
  const p = join(__dirname, 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');
  const raw = readFileSync(p, 'utf8');
  const data = JSON.parse(raw);
  const arr = data.templates ?? data;
  const fileTemplateCount = data.template_count;
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
    target_vector: row.target_vector?.length ? [...row.target_vector] : [],
    difficulty: row.difficulty ?? null,
    avoid_if_pain_mode: row.avoid_if_pain_mode ?? null,
    progression_level: row.progression_level ?? null,
    balance_demand: row.balance_demand ?? null,
    complexity: row.complexity ?? null,
  }));
  if (fileTemplateCount != null && fileTemplateCount !== templates.length) {
    throw new Error(
      `[full-rail-continuity] template_count ${fileTemplateCount} !== parsed templates length ${templates.length}`
    );
  }
  return {
    templates,
    source: TEMPLATE_SOURCE_EXPECT,
    template_count: templates.length,
  };
}

function hasVector(t, v) {
  return (t?.target_vector ?? []).includes(v);
}

function getMainItems(plan) {
  const m = (plan.segments ?? []).find((s) => s.title === 'Main');
  return (m?.items ?? []).map((i) => i.templateId);
}

function getAllItems(plan) {
  const out = [];
  for (const seg of plan.segments ?? []) {
    for (const it of seg.items ?? []) {
      out.push({ segment: seg.title, templateId: it.templateId });
    }
  }
  return out;
}

function isTargetAnchorVector(t, g) {
  return hasVector(t, g);
}

function isTargetSupportForGoldPath(t, g) {
  if (isTargetAnchorVector(t, g)) return false;
  const v = new Set(t?.target_vector ?? []);
  if (g === 'lower_stability') return v.has('trunk_control') || v.has('lower_mobility');
  if (g === 'lower_mobility') return v.has('lower_stability') || v.has('trunk_control');
  if (g === 'upper_mobility') return v.has('trunk_control');
  if (g === 'trunk_control') return v.has('lower_stability') || v.has('upper_mobility');
  if (g === 'deconditioned') return v.has('trunk_control') || v.has('lower_stability');
  if (g === 'balanced_reset') {
    return (
      v.has('trunk_control') || v.has('upper_mobility') || v.has('lower_stability') || v.has('lower_mobility') || v.has('deconditioned')
    );
  }
  return false;
}

function classifyItemAgainstAnchor(t, anchor) {
  if (!t) return { direct: false, support: false, offAxis: true };
  const a = isTargetAnchorVector(t, anchor);
  const s = isTargetSupportForGoldPath(t, anchor);
  if (a || s) return { direct: a, support: s, offAxis: false };
  const v = new Set(t.target_vector ?? []);
  if (v.size === 0) return { direct: false, support: false, offAxis: true };
  if (anchor === 'lower_stability' && v.has('upper_mobility') && !v.has('trunk_control')) return { direct: false, support: false, offAxis: true };
  if (anchor === 'lower_mobility' && v.has('upper_mobility') && !v.has('lower_mobility')) return { direct: false, support: false, offAxis: true };
  if (anchor === 'upper_mobility' && v.has('lower_stability') && !v.has('upper_mobility')) return { direct: false, support: false, offAxis: true };
  if (anchor === 'trunk_control' && (v.size === 1 && v.has('lower_stability'))) return { direct: false, support: false, offAxis: true };
  return { direct: false, support: false, offAxis: false };
}

function mainRowsFromPlan(plan, byId) {
  return getMainItems(plan)
    .map((id) => byId.get(id))
    .filter(Boolean);
}

function isUpperDominantMain(mainRows) {
  if (mainRows.length < 2) return false;
  return mainRows.every((t) => {
    const v = new Set(t.target_vector ?? []);
    return v.has('upper_mobility') && !v.has('lower_stability') && !v.has('trunk_control') && !v.has('lower_mobility');
  });
}

function isLowerDominantMain(mainRows) {
  if (mainRows.length < 2) return false;
  return mainRows.every((t) => {
    const v = new Set(t.target_vector ?? []);
    return v.has('lower_stability') && !v.has('upper_mobility');
  });
}

function isUpperDominantLowerMobCase(mainRows) {
  if (mainRows.length < 2) return false;
  return mainRows.every((t) => hasVector(t, 'upper_mobility') && !hasVector(t, 'lower_mobility'));
}

function hasHighRiskUnilateralLike(t) {
  if (!t) return false;
  const single = (t.focus_tags ?? []).some((x) => SINGLE_LEG_FOCUS.has(x));
  return single && (t.difficulty === 'high' || (t.progression_level ?? 1) >= 3);
}

function hasHighRiskUnilateralDominance(mainRows) {
  const bad = mainRows.filter((t) => hasHighRiskUnilateralLike(t));
  return bad.length >= 2;
}

function mainHasLowerFamily(mains) {
  return mains.some((t) => hasVector(t, 'lower_stability') || hasVector(t, 'lower_mobility') || hasVector(t, 'trunk_control'));
}

function mainHasLowerStabilityDirect(mains) {
  return mains.some((t) => hasVector(t, 'lower_stability'));
}

function mainHasTrunk(mains) {
  return mains.some((t) => hasVector(t, 'trunk_control'));
}

function mainHasUpper(mains) {
  return mains.some((t) => hasVector(t, 'upper_mobility'));
}

function planHasVectorAnywhere(plan, byId, vec) {
  for (const { templateId } of getAllItems(plan)) {
    if (hasVector(byId.get(templateId), vec)) return true;
  }
  return false;
}

function planHasLowerMobilityAnywhere(plan, byId) {
  return planHasVectorAnywhere(plan, byId, 'lower_mobility');
}

function planHasHipAnkleCalfLowerReset(plan, byId) {
  for (const { templateId } of getAllItems(plan)) {
    const t = byId.get(templateId);
    if (!t) continue;
    if (hasVector(t, 'lower_mobility') || (t.focus_tags ?? []).some((f) => LOWER_RESET_TAGS.has(f))) return true;
  }
  return false;
}

function planHasTrunkOrResetOrNeutral(plan, byId) {
  for (const { templateId } of getAllItems(plan)) {
    const t = byId.get(templateId);
    if (!t) continue;
    if (hasVector(t, 'trunk_control') || hasVector(t, 'deconditioned') || (t.focus_tags ?? []).some((f) => RESET_FOCUS_TAGS.has(f)))
      return true;
  }
  return false;
}

function planHasUpperThoracicReset(plan, byId) {
  for (const { templateId } of getAllItems(plan)) {
    const t = byId.get(templateId);
    if (!t) continue;
    if (hasVector(t, 'upper_mobility') || (t.focus_tags ?? []).some((f) => f === 'thoracic_mobility' || f === 'shoulder_mobility' || f === 'full_body_reset'))
      return true;
  }
  return false;
}

function phaseHasLowerFamilyTrunk(phaseRows, byId) {
  for (const { plan } of phaseRows) {
    const m = mainRowsFromPlan(plan, byId);
    for (const t of m) {
      if (hasVector(t, 'lower_stability') || hasVector(t, 'lower_mobility') || hasVector(t, 'trunk_control')) return true;
    }
  }
  return false;
}

function phaseHasLowerStabilityDirectAnywhere(phaseRows, byId) {
  for (const { plan } of phaseRows) {
    if (mainHasLowerStabilityDirect(mainRowsFromPlan(plan, byId))) return true;
  }
  return false;
}

function phaseHasTrunkMainOrAccessory(phaseRows, byId) {
  for (const { plan } of phaseRows) {
    for (const seg of plan.segments ?? []) {
      if (seg.title !== 'Main' && seg.title !== 'Accessory') continue;
      for (const it of seg.items ?? []) {
        const t = byId.get(it.templateId);
        if (t && hasVector(t, 'trunk_control')) return true;
      }
    }
  }
  return false;
}

function phaseHasTrunkAnywhere(phaseRows, byId) {
  for (const { plan } of phaseRows) {
    for (const { templateId } of getAllItems(plan)) {
      if (hasVector(byId.get(templateId), 'trunk_control')) return true;
    }
  }
  return false;
}

function phaseUpperDomSessionCount(phaseRows, byId) {
  let c = 0;
  for (const { plan } of phaseRows) {
    if (isUpperDominantMain(mainRowsFromPlan(plan, byId))) c += 1;
  }
  return c;
}

function phaseLowerDomSessionCount(phaseRows, byId) {
  let c = 0;
  for (const { plan } of phaseRows) {
    if (isLowerDominantMain(mainRowsFromPlan(plan, byId))) c += 1;
  }
  return c;
}

function sessionMetrics(plan, byId, anchor) {
  const mains = mainRowsFromPlan(plan, byId);
  let direct = 0;
  let support = 0;
  let offAxis = 0;
  for (const t of mains) {
    const c = classifyItemAgainstAnchor(t, anchor);
    if (c.direct) direct += 1;
    else if (c.support) support += 1;
    else if (c.offAxis) offAxis += 1;
  }
  const main_upper = mains.filter((t) => hasVector(t, 'upper_mobility')).length;
  const main_lower = mains.filter((t) => hasVector(t, 'lower_stability') || hasVector(t, 'lower_mobility')).length;
  const main_trunk = mains.filter((t) => hasVector(t, 'trunk_control')).length;
  const has_neutral = getAllItems(plan).some(({ templateId }) => {
    const t = byId.get(templateId);
    return t && (t.focus_tags ?? []).some((f) => RESET_FOCUS_TAGS.has(f) || f === 'full_body_reset');
  });
  const has_high = mains.some((t) => t?.difficulty === 'high');
  return {
    main_template_ids: mains.map((t) => t.id),
    main_target_vectors: mains.map((t) => t.target_vector),
    direct_anchor_count: direct,
    support_count: support,
    off_axis_main_count: offAxis,
    main_upper_count: main_upper,
    main_lower_count: main_lower,
    main_trunk_count: main_trunk,
    has_neutral_reset: has_neutral,
    has_high_difficulty: has_high,
    has_high_risk_unilateral_like: hasHighRiskUnilateralDominance(mains),
  };
}

function runChecks(primary, freq, totalSessions, phaseLengths, sessionRows, byId) {
  const fails = [];
  const warns = [];
  const addFail = (r) => fails.push(r);
  const addWarn = (r) => warns.push(r);
  const byPhase = { 1: [], 2: [], 3: [], 4: [] };
  for (const row of sessionRows) {
    byPhase[row.phase]?.push(row);
  }

  for (const row of sessionRows) {
    const m = row.metrics;
    if (m.has_high_risk_unilateral_like && (row.phase === 1 || row.phase === 2) && primary === 'DECONDITIONED') {
      addFail({
        rule_id: 'DECON_HIGH_RISK_EARLY_DOMINANCE',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: row.phase,
        session_number: row.session_number,
        reason: 'high-risk unilateral-like dominance early/mid',
        main_template_ids: m.main_template_ids,
        main_target_vectors: m.main_target_vectors,
      });
    }
  }

  if (primary === 'LOWER_INSTABILITY') {
    for (const row of byPhase[1] ?? []) {
      const mains = mainRowsFromPlan(row.plan, byId);
      if (mains.length && !mainHasLowerFamily(mains)) {
        addFail({
          rule_id: 'LOWER_INSTABILITY_PHASE1_NO_LOWER_SUPPORT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 1,
          session_number: row.session_number,
          reason: 'Main has no lower_stability/lower_mobility/trunk',
          main_template_ids: row.metrics.main_template_ids,
          main_target_vectors: row.metrics.main_target_vectors,
        });
      }
      if (isUpperDominantMain(mains)) {
        addFail({
          rule_id: 'LOWER_INSTABILITY_PHASE1_UPPER_DOMINANT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 1,
          session_number: row.session_number,
          reason: 'Main upper_mobility-dominant',
          main_template_ids: row.metrics.main_template_ids,
          main_target_vectors: row.metrics.main_target_vectors,
        });
      }
    }
    {
      const rows2 = byPhase[2] ?? [];
      if (rows2.length && !phaseHasLowerStabilityDirectAnywhere(rows2, byId)) {
        addFail({
          rule_id: 'LOWER_INSTABILITY_PHASE2_NO_DIRECT_LOWER_STAB',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 2,
          session_number: null,
          reason: 'Phase 2 has zero lower_stability direct in any Main',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
    if (phaseUpperDomSessionCount(byPhase[2] ?? [], byId) >= 2) {
      addFail({
        rule_id: 'LOWER_INSTABILITY_PHASE2_UPPER_DOMINANCE_REPEAT',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: 2,
        session_number: null,
        reason: 'upper_mobility-dominant Main in 2+ sessions',
        main_template_ids: null,
        main_target_vectors: null,
      });
    }
    if (byPhase[3]?.length && !phaseHasLowerFamilyTrunk(byPhase[3], byId)) {
      addFail({
        rule_id: 'LOWER_INSTABILITY_PHASE3_NO_LOWER_TRUNK',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: 3,
        session_number: null,
        reason: 'phase has no lower family/trunk in any Main',
        main_template_ids: null,
        main_target_vectors: null,
      });
    }
    if (phaseUpperDomSessionCount(byPhase[3] ?? [], byId) >= 2) {
      addFail({
        rule_id: 'LOWER_INSTABILITY_PHASE3_UPPER_DOMINANCE',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: 3,
        session_number: null,
        reason: 'upper_mobility-dominant Main 2+ sessions in phase 3',
        main_template_ids: null,
        main_target_vectors: null,
      });
    }
    if (byPhase[4]?.length) {
      let any = false;
      for (const { plan } of byPhase[4]) {
        for (const { templateId } of getAllItems(plan)) {
          const t = byId.get(templateId);
          if (!t) continue;
          if (
            hasVector(t, 'lower_mobility') ||
            hasVector(t, 'lower_stability') ||
            hasVector(t, 'trunk_control') ||
            (t.focus_tags ?? []).some((f) => RESET_FOCUS_TAGS.has(f))
          ) {
            any = true;
            break;
          }
        }
        if (any) break;
      }
      if (!any) {
        addFail({
          rule_id: 'LOWER_INSTABILITY_PHASE4_NO_FAMILY_RESET',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 4,
          session_number: null,
          reason: 'phase has no lower/trunk/reset support',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
  }

  if (primary === 'LOWER_MOBILITY_RESTRICTION') {
    for (const ph of [1, 2, 3, 4]) {
      const rows = byPhase[ph] ?? [];
      if (!rows.length) continue;
      let hasLm = false;
      for (const { plan } of rows) {
        if (planHasLowerMobilityAnywhere(plan, byId)) {
          hasLm = true;
          break;
        }
      }
      if (!hasLm) {
        addFail({
          rule_id: 'LOWER_MOBILITY_PHASE_LOWER_MOBILITY_ABSENT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: ph,
          session_number: null,
          reason: `lower_mobility absent from entire phase ${ph}`,
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
    for (const row of byPhase[1] ?? []) {
      const mains = mainRowsFromPlan(row.plan, byId);
      if (isUpperDominantLowerMobCase(mains) || isUpperDominantMain(mains)) {
        addFail({
          rule_id: 'LOWER_MOBILITY_PHASE1_UPPER_DOMINANT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 1,
          session_number: row.session_number,
          reason: 'Main upper-dominant',
          main_template_ids: row.metrics.main_template_ids,
          main_target_vectors: row.metrics.main_target_vectors,
        });
      }
    }
    if (phaseUpperDomSessionCount(byPhase[2] ?? [], byId) >= 2) {
      addFail({
        rule_id: 'LOWER_MOBILITY_PHASE2_UPPER_DOM_REPEAT',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: 2,
        session_number: null,
        reason: 'upper-dominant Main 2+ in phase 2',
        main_template_ids: null,
        main_target_vectors: null,
      });
    }
    if (byPhase[3]?.length) {
      let ok = false;
      for (const { plan } of byPhase[3]) {
        if (mainHasLowerFamily(mainRowsFromPlan(plan, byId)) || planHasLowerMobilityAnywhere(plan, byId)) ok = true;
      }
      if (!ok) {
        addFail({
          rule_id: 'LOWER_MOBILITY_PHASE3_NO_LOWER_SUPPORT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 3,
          session_number: null,
          reason: 'no lower support in plan',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
    if (byPhase[4]?.length) {
      let hasReset = false;
      for (const { plan } of byPhase[4]) {
        if (planHasHipAnkleCalfLowerReset(plan, byId)) {
          hasReset = true;
          break;
        }
      }
      if (!hasReset) {
        addFail({
          rule_id: 'LOWER_MOBILITY_PHASE4_NO_HIP_ANKLE',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 4,
          session_number: null,
          reason: 'no hip/ankle/calf/lower_mobility in phase 4',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
  }

  if (primary === 'UPPER_IMMOBILITY') {
    for (const ph of [1, 2, 3, 4]) {
      const rows = byPhase[ph] ?? [];
      if (!rows.length) continue;
      let hasUp = false;
      for (const { plan } of rows) {
        if (planHasVectorAnywhere(plan, byId, 'upper_mobility')) {
          hasUp = true;
          break;
        }
      }
      if (!hasUp) {
        addFail({
          rule_id: 'UPPER_IMMOBILITY_PHASE_UPPER_ABSENT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: ph,
          session_number: null,
          reason: 'upper_mobility absent from entire phase',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
    for (const row of byPhase[1] ?? []) {
      if (isLowerDominantMain(mainRowsFromPlan(row.plan, byId))) {
        addFail({
          rule_id: 'UPPER_IMMOBILITY_PHASE1_LOWER_DOMINANT',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 1,
          session_number: row.session_number,
          reason: 'Main lower_stability-dominant',
          main_template_ids: row.metrics.main_template_ids,
          main_target_vectors: row.metrics.main_target_vectors,
        });
      }
    }
    if (phaseLowerDomSessionCount(byPhase[2] ?? [], byId) >= 2) {
      addFail({
        rule_id: 'UPPER_IMMOBILITY_PHASE2_LOWER_DOM_REPEAT',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: 2,
        session_number: null,
        reason: 'lower_stability-dominant Main 2+ in phase 2',
        main_template_ids: null,
        main_target_vectors: null,
      });
    }
    if (byPhase[3]?.length) {
      let tOrU = false;
      for (const { plan } of byPhase[3]) {
        const m = mainRowsFromPlan(plan, byId);
        if (m.some((t) => hasVector(t, 'upper_mobility') || hasVector(t, 'trunk_control'))) tOrU = true;
      }
      if (!tOrU) {
        addFail({
          rule_id: 'UPPER_IMMOBILITY_PHASE3_NO_UPPER_TRUNK',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 3,
          session_number: null,
          reason: 'no upper/trunk in Main in phase 3',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
    if (byPhase[4]?.length) {
      let pr = false;
      for (const { plan } of byPhase[4]) {
        if (planHasUpperThoracicReset(plan, byId)) pr = true;
      }
      if (!pr) {
        addFail({
          rule_id: 'UPPER_IMMOBILITY_PHASE4_NO_RESET',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 4,
          session_number: null,
          reason: 'no upper/thoracic/reset in phase 4',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
  }

  if (primary === 'CORE_CONTROL_DEFICIT') {
    for (const row of byPhase[1] ?? []) {
      const mains = mainRowsFromPlan(row.plan, byId);
      if (mains.length && !mains.some((t) => hasVector(t, 'trunk_control'))) {
        addFail({
          rule_id: 'CORE_PHASE_TRUNK_ABSENT_P1',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 1,
          session_number: row.session_number,
          reason: 'no trunk_control in Main',
          main_template_ids: row.metrics.main_template_ids,
          main_target_vectors: row.metrics.main_target_vectors,
        });
      }
    }
    for (const ph of [2]) {
      const rows = byPhase[ph] ?? [];
      if (rows.length && !phaseHasTrunkMainOrAccessory(rows, byId)) {
        addFail({
          rule_id: 'CORE_PHASE_TRUNK_MAIN_OR_ACCESSORY',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: ph,
          session_number: null,
          reason: 'no trunk in Main/Accessory in phase 2',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
    if (byPhase[3]?.length && !phaseHasTrunkAnywhere(byPhase[3], byId)) {
      addFail({
        rule_id: 'CORE_PHASE_TRUNK_ABSENT_P3',
        primary,
        target_frequency: freq,
        total_sessions: totalSessions,
        phase: 3,
        session_number: null,
        reason: 'trunk_control disappeared for whole phase 3',
        main_template_ids: null,
        main_target_vectors: null,
      });
    }
    if (byPhase[4]?.length) {
      let t = false;
      for (const { plan } of byPhase[4]) {
        if (phaseHasTrunkAnywhere([{ plan }], byId) || planHasTrunkOrResetOrNeutral(plan, byId)) t = true;
      }
      if (!t) {
        addFail({
          rule_id: 'CORE_PHASE4_TRUNK_OR_RESET',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 4,
          session_number: null,
          reason: 'no trunk or neutral reset in phase 4',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
  }

  if (primary === 'DECONDITIONED') {
    for (const row of byPhase[1] ?? []) {
      const mains = mainRowsFromPlan(row.plan, byId);
      if (mains.length >= 2 && mains.filter((t) => t?.difficulty === 'high').length === mains.length) {
        addFail({
          rule_id: 'DECON_HIGH_DIFF_PHASE1',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: 1,
          session_number: row.session_number,
          reason: 'all Main items high difficulty in phase 1',
          main_template_ids: row.metrics.main_template_ids,
          main_target_vectors: row.metrics.main_target_vectors,
        });
      }
    }
    if (sessionRows.length) {
      let anySupport = false;
      for (const { plan } of sessionRows) {
        if (planHasTrunkOrResetOrNeutral(plan, byId)) {
          anySupport = true;
          break;
        }
      }
      if (!anySupport) {
        addFail({
          rule_id: 'DECON_NO_TRUNK_RESET_RAIL',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: null,
          session_number: null,
          reason: 'no trunk/reset support across full rail',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
    }
  }

  if (primary === 'STABLE') {
    if (sessionRows.length >= 8) {
      const mainsAll = sessionRows.map((r) => mainRowsFromPlan(r.plan, byId));
      const onlyUpper = mainsAll.filter((m) => m.length && m.every((t) => hasVector(t, 'upper_mobility') && t.target_vector.length === 1));
      if (onlyUpper.length > sessionRows.length * 0.7) {
        addFail({
          rule_id: 'STABLE_SINGLE_AXIS_RAIL_COLLAPSE',
          primary,
          target_frequency: freq,
          total_sessions: totalSessions,
          phase: null,
          session_number: null,
          reason: 'upper-only mains dominate the rail',
          main_template_ids: null,
          main_target_vectors: null,
        });
      }
      const seenT = { upper: false, lower: false, trunk: false };
      for (const m of mainsAll) {
        for (const t of m) {
          if (hasVector(t, 'upper_mobility')) seenT.upper = true;
          if (hasVector(t, 'lower_stability') || hasVector(t, 'lower_mobility')) seenT.lower = true;
          if (hasVector(t, 'trunk_control')) seenT.trunk = true;
        }
      }
      if (!(seenT.upper && seenT.lower && seenT.trunk)) {
        addWarn({
          rule_id: 'STABLE_BALANCE_WARN',
          primary,
          target_frequency: freq,
          reason: 'incomplete tri-axis exposure over rail (warn only)',
          seenT,
        });
      }
    }
  }
  return { fails, warns };
}

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

async function materializeRail({ buildSessionPlanJson, computePhase, resolvePhaseLengths, buildTheme, templates, fixture, targetFrequency, templatePoolSource, templateCount }) {
  const totalSessions = FREQUENCY_TO_TOTAL[targetFrequency];
  const policyOptions = buildPolicyOptions(fixture);
  const phaseLengthsArr = resolvePhaseLengths(totalSessions, policyOptions);
  const sessionRows = [];
  const recordsForWindow = [];
  for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber++) {
    const phase = computePhase(totalSessions, sessionNumber, { phaseLengths: phaseLengthsArr, policyOptions });
    const theme = buildTheme(
      sessionNumber,
      totalSessions,
      { result_type: fixture.resultType, focus: fixture.focus },
      { phaseLengths: phaseLengthsArr, policyOptions }
    );
    const usedTemplateIds = computeUsedTemplateIdsForNextSession(recordsForWindow, sessionNumber);
    const plan = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber,
      totalSessions,
      phase,
      theme,
      timeBudget: 'normal',
      conditionMood: 'ok',
      focus: fixture.focus,
      avoid: fixture.avoid,
      painFlags: [],
      usedTemplateIds,
      resultType: fixture.resultType,
      confidence: fixture.confidence,
      scoringVersion: fixture.scoringVersion,
      deep_level: fixture.deep_level,
      red_flags: fixture.red_flags,
      safety_mode: fixture.safety_mode,
      primary_type: fixture.primary_type,
      secondary_type: fixture.secondary_type,
      priority_vector: fixture.priority_vector,
      pain_mode: fixture.pain_mode,
      baseline_session_anchor: fixture.baseline_session_anchor,
    });
    const usedIds = plan.meta?.used_template_ids ?? [];
    recordsForWindow.push({ session_number: sessionNumber, used_template_ids: usedIds });
    sessionRows.push({ sessionNumber, totalSessions, phase, plan, targetFrequency, templatePoolSource, templateCount });
  }
  return { sessionRows, totalSessions, phaseLengths: phaseLengthsArr };
}

async function main() {
  const { buildSessionPlanJson } = await import('../src/lib/session/plan-generator.ts');
  const { computePhase, resolvePhaseLengths } = await import('../src/lib/session/phase.ts');
  const { buildTheme } = await import('../src/app/api/session/create/_lib/helpers.ts');

  const { templates, source, template_count: tc } = loadFixture48();
  if (source !== TEMPLATE_SOURCE_EXPECT || tc !== TEMPLATE_COUNT_EXPECT) {
    console.error('[full-rail-continuity] FAIL template pool', source, tc);
    process.exit(1);
  }
  const byId = new Map(templates.map((t) => [t.id, t]));

  let totalSessionsChecked = 0;
  const allFailures = [];
  const allWarnings = [];
  for (const primary of PRIMARY_ORDER) {
    const fixture = buildBaselineFixture(primary);
    for (const freq of VALID_FREQUENCIES) {
      const { sessionRows, totalSessions, phaseLengths } = await materializeRail({
        buildSessionPlanJson,
        computePhase,
        resolvePhaseLengths,
        buildTheme,
        templates,
        fixture,
        targetFrequency: freq,
        templatePoolSource: source,
        templateCount: tc,
      });
      const enriched = sessionRows.map((r) => {
        const metrics = sessionMetrics(r.plan, byId, PRIMARY_TO_BASELINE_ANCHOR[primary]);
        return {
          ...r,
          session_number: r.sessionNumber,
          metrics,
        };
      });
      totalSessionsChecked += enriched.length;
      const { fails, warns } = runChecks(primary, freq, totalSessions, phaseLengths, enriched, byId);
      allFailures.push(...fails);
      allWarnings.push(...warns);
    }
  }

  if (allFailures.length) {
    for (const f of allFailures) {
      console.error('\n[full-rail-continuity] FAIL', JSON.stringify(f, null, 2));
    }
    process.exit(1);
  }

  const warnN = allWarnings.length;
  if (warnN) {
    for (const w of allWarnings) {
      console.warn('[full-rail-continuity] WARN', JSON.stringify(w, null, 0));
    }
  }
  console.log(
    `[full-rail-continuity] PASS 6 types × 4 frequencies, template_count=48, sessions_checked=${totalSessionsChecked}, hard_failures=0, warnings=${warnN}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
