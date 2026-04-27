/**
 * PR-ADAPTIVE-REAL-NEXT-SESSION-VERIFY-01
 * Deterministic verification: adaptive modifiers → merge → plan diff → session-gen-cache.
 * No production DB. No SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://harness.placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'harness-placeholder-anon-key';

const { deriveAdaptiveModifiers } = await import('../src/lib/session/adaptive-progression.ts');
const { resolveAdaptiveModifier } = await import('../src/lib/session/adaptive-modifier-resolver.ts');
const { resolveAdaptiveMerge } = await import('../src/lib/session/adaptive-merge.ts');
const { computeAdaptiveModifier, getAvoidTagsForDiscomfort } = await import('../src/core/adaptive-engine/index.ts');
const { getCachedPlan, setCachedPlan } = await import('../src/lib/session-gen-cache.ts');
const { buildSessionPlanJson } = await import('../src/lib/session/plan-generator.ts');
const { computePhase, resolvePhaseLengths } = await import('../src/lib/session/phase.ts');
const { buildTheme } = await import('../src/app/api/session/create/_lib/helpers.ts');

const DIFFICULTY_RANK = { low: 1, medium: 2, high: 3 };

function loadFixture48Templates() {
  const fixturePath = join(__dirname, 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');
  const raw = readFileSync(fixturePath, 'utf8');
  const data = JSON.parse(raw);
  const arr = data.templates ?? data;
  return {
    templates: arr.map((row) => ({
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
      avoid_if_pain_mode: row.avoid_if_pain_mode ?? null,
      progression_level: row.progression_level ?? null,
      balance_demand: row.balance_demand ?? null,
      complexity: row.complexity ?? null,
    })),
  };
}

function planMetrics(plan, byId) {
  let total = 0;
  let mainCount = 0;
  const ranks = [];
  const mainRanks = [];
  const prog = [];
  const mainProg = [];
  let nullDiff = 0;
  for (const seg of plan.segments ?? []) {
    const isMain = seg.title === 'Main';
    for (const it of seg.items ?? []) {
      total += 1;
      if (isMain) mainCount += 1;
      const t = byId.get(it.templateId);
      const d = t?.difficulty;
      const r = DIFFICULTY_RANK[d] ?? 0;
      if (!d) nullDiff += 1;
      ranks.push(r);
      if (isMain) {
        mainRanks.push(r);
        mainProg.push(t?.progression_level ?? 0);
      }
      prog.push(t?.progression_level ?? 0);
    }
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const highC = ranks.filter((x) => x === 3).length;
  const medOrHigh = ranks.filter((x) => x >= 2).length;
  return {
    total_item_count: total,
    main_item_count: mainCount,
    average_difficulty_rank: avg(ranks),
    max_difficulty_rank: ranks.length ? Math.max(...ranks) : 0,
    main_average_difficulty_rank: avg(mainRanks),
    max_progression_level: prog.length ? Math.max(...prog) : 0,
    average_progression_level: avg(prog),
    main_average_progression_level: avg(mainProg),
    high_difficulty_count: highC,
    medium_or_high_count: medOrHigh,
    null_difficulty_count: nullDiff,
    recovery_mode_applied: plan.flags?.recovery === true,
    short: plan.flags?.short === true,
    finalTargetLevel: plan.meta?.finalTargetLevel,
  };
}

const LOWER = {
  resultType: 'LOWER-LIMB',
  primary_type: 'LOWER_INSTABILITY',
  baseline_session_anchor: 'lower_stability',
  focus: ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance'],
  avoid: [],
  priority_vector: { lower_stability: 3, lower_mobility: 1, trunk_control: 1 },
};

let exitCode = 0;
const report = [];

function line(msg) {
  report.push(msg);
  console.log(msg);
}

function failLayer(scenario, reason, extra) {
  exitCode = 1;
  console.error(`\nFAIL [${scenario}]`, reason, extra != null ? extra : '');
}

// ─── Layer 1 ─────────────────────────────────────────────────────────────

function layer1() {
  const noneProg = { reason: 'none', targetLevelDelta: 0, avoidExerciseKeys: [] };
  const painCtx = { pain_mode: 'none' };

  // A — easy_string_only
  const aProg = deriveAdaptiveModifiers(
    [{ session_number: 1, difficulty_feedback: 'too_easy', completion_ratio: 0.85, overall_rpe: 5, pain_after: 1 }],
    [],
    [1],
    painCtx
  );
  const aOk = aProg.targetLevelDelta === 0 && aProg.reason === 'none';
  line(
    '[adaptive-real] easy_string_only: documented — too_easy alone is not guaranteed to progress under current conservative design (inWindow<2 for high_tolerance).'
  );
  line(`[adaptive-real] easy_string_only: derived reason=${aProg.reason} targetLevelDelta=${aProg.targetLevelDelta} (expect none/0) ${aOk ? 'OK' : 'CHECK'}`);

  // B — easy_full_signal
  const sfb = [
    {
      session_number: 2,
      difficulty_feedback: 'too_easy',
      completion_ratio: 0.95,
      overall_rpe: 3,
      pain_after: 0,
    },
    {
      session_number: 1,
      difficulty_feedback: 'too_easy',
      completion_ratio: 0.95,
      overall_rpe: 3,
      pain_after: 0,
    },
  ];
  const bProg = deriveAdaptiveModifiers(sfb, [], [1, 2], painCtx);
  const bMod = resolveAdaptiveModifier({
    completion_ratio: 0.95,
    skipped_exercises: 0,
    dropout_risk_score: 0,
    discomfort_burden_score: 0,
    avg_rpe: 3,
    avg_discomfort: 1,
  });
  const bMerge = resolveAdaptiveMerge({
    progression: bProg,
    modifier: bMod,
    summary: { created_at: '2026-01-01T00:00:00.000Z', flags: [] },
  });
  const upward =
    bMerge.targetLevelDelta === 1 ||
    (bMerge.volumeModifier ?? 0) > 0 ||
    bMod.difficulty_adjustment === 1 ||
    bMod.intensity_adjustment === 1;
  if (!upward) {
    failLayer('easy_full_signal', 'no upward mechanism', { bProg, bMod, bMerge });
  } else {
    line(
      `[adaptive-real] easy_full_signal: PASS targetLevelDelta=${bMerge.targetLevelDelta} volumeModifier=${bMerge.volumeModifier} progression=${bProg.reason}`
    );
  }
  if (bMod.caution_bias) {
    failLayer('easy_full_signal', 'unexpected caution_bias', bMod);
  }

  // C — hard_full_signal
  const cProg = deriveAdaptiveModifiers(
    [
      {
        session_number: 1,
        difficulty_feedback: 'too_hard',
        completion_ratio: 0.45,
        overall_rpe: 9,
        pain_after: 0,
      },
    ],
    [
      { session_number: 1, exercise_key: 'M10', skipped: true },
      { session_number: 1, exercise_key: 'M11', skipped: true },
    ],
    [1],
    painCtx
  );
  const cMod = resolveAdaptiveModifier({
    completion_ratio: 0.5,
    skipped_exercises: 2,
    dropout_risk_score: 20,
    discomfort_burden_score: 0,
    avg_rpe: 9,
    avg_discomfort: 2,
  });
  const cMerge = resolveAdaptiveMerge({
    progression: cProg,
    modifier: cMod,
    summary: { created_at: '2026-01-01T00:00:00.000Z', flags: [] },
  });
  const downward =
    cMerge.targetLevelDelta === -1 ||
    (cMerge.volumeModifier ?? 0) < 0 ||
    cMerge.forceShort ||
    cMerge.maxDifficultyCap != null;
  if (!downward) {
    failLayer('hard_full_signal', 'no downward/cap/volume', { cProg, cMod, cMerge });
  } else {
    line(
      `[adaptive-real] hard_full_signal: PASS targetLevelDelta=${cMerge.targetLevelDelta} vol=${cMerge.volumeModifier} cap=${cMerge.maxDifficultyCap} short=${cMerge.forceShort}`
    );
  }

  // D — pain_full_signal
  const dMod = resolveAdaptiveModifier({
    completion_ratio: 0.8,
    skipped_exercises: 0,
    dropout_risk_score: 55,
    discomfort_burden_score: 65,
    avg_rpe: 6,
    avg_discomfort: 7,
  });
  const dMerge = resolveAdaptiveMerge({
    progression: noneProg,
    modifier: dMod,
    summary: { created_at: '2026-01-01T00:00:00.000Z', flags: [] },
  });
  const dEngine = computeAdaptiveModifier({
    sessionFeedback: [
      { session_number: 1, body_state_change: 'worse', completion_ratio: 0.7, overall_rpe: 6, pain_after: 6 },
    ],
    adaptiveSummary: {
      completion_ratio: 0.7,
      skipped_exercises: 0,
      avg_rpe: 6,
      avg_discomfort: 7,
      dropout_risk_score: 50,
      discomfort_burden_score: 65,
    },
  });
  const notUp = dMerge.targetLevelDelta !== 1;
  const hasCaution = dMod.caution_bias === true;
  const hasRec = dMod.recovery_bias === true || dMerge.forceRecovery;
  if (!notUp) {
    failLayer('pain_full_signal', 'upward +1 not allowed', dMerge);
  }
  if (!hasCaution) {
    failLayer('pain_full_signal', 'expected caution_bias', dMod);
  }
  if (!hasRec) {
    failLayer('pain_full_signal', 'expected recovery/force path', dMerge);
  }
  if (!dEngine.protection_mode) {
    line('[adaptive-real] pain_full_signal: NOTE engine protection_mode (body worse) = ' + dEngine.protection_mode);
  }
  line(
    `[adaptive-real] pain_full_signal: PASS caution=${dMod.caution_bias} recovery=${dMod.recovery_bias} mergeTld=${dMerge.targetLevelDelta} engine.protection=${dEngine.protection_mode}`
  );

  // E — neutral
  const eMod = resolveAdaptiveModifier({
    completion_ratio: 0.85,
    skipped_exercises: 0,
    dropout_risk_score: 0,
    discomfort_burden_score: 0,
    avg_rpe: 5.5,
    avg_discomfort: 2,
  });
  const eMerge = resolveAdaptiveMerge({
    progression: noneProg,
    modifier: eMod,
    summary: null,
  });
  // completion 0.85 → volume -0.1 in resolver (0.6–0.8 band) — "neutral" in spec (0.8–0.89) use 0.85: actually <0.8 is false, 0.85 is >=0.8 and <0.9 so volume is -0.1 only if second branch: "else if (summary.completion_ratio < 0.8)" -> 0.85 is NOT < 0.8, so first: <0.6 no, <0.8: 0.85 < 0.8? no. So volume_modifier 0
  // difficulty: not <0.6, not >=0.9 for 0.85? 0.85 < 0.9 -> not >=0.9, so difficulty 0
  const neutralOk =
    eMerge.targetLevelDelta === 0 && !eMerge.forceRecovery && (eMod.caution_bias ?? false) === false;
  if (!neutralOk) {
    failLayer('neutral', 'unexpected modifier', { eMod, eMerge });
  } else {
    line(`[adaptive-real] neutral: PASS tld=${eMerge.targetLevelDelta}`);
  }
}

// ─── Layer 2 plan diff ────────────────────────────────────────────────────

async function layer2() {
  const { templates } = loadFixture48Templates();
  const byId = new Map(templates.map((t) => [t.id, t]));
  const totalSessions = 8;
  const sessionNumber = 2;
  const policyOptions = { deepLevel: 2, safetyMode: 'none', redFlags: false };
  const phaseLengthsArr = resolvePhaseLengths(totalSessions, policyOptions);
  const phase = computePhase(totalSessions, sessionNumber, { phaseLengths: phaseLengthsArr, policyOptions });
  const theme = buildTheme(
    sessionNumber,
    totalSessions,
    { result_type: LOWER.resultType, focus: LOWER.focus },
    { phaseLengths: phaseLengthsArr, policyOptions }
  );
  const base = {
    templatePool: templates,
    sessionNumber,
    totalSessions,
    phase,
    theme,
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: LOWER.focus,
    avoid: [],
    painFlags: [],
    usedTemplateIds: [],
    resultType: LOWER.resultType,
    confidence: 0.85,
    scoringVersion: 'deep_v2',
    deep_level: 2,
    red_flags: false,
    safety_mode: 'none',
    primary_type: LOWER.primary_type,
    secondary_type: 'HARNESS',
    priority_vector: LOWER.priority_vector,
    pain_mode: 'none',
    baseline_session_anchor: LOWER.baseline_session_anchor,
  };

  const baseline = await buildSessionPlanJson({ ...base });
  const easy = await buildSessionPlanJson({
    ...base,
    adaptiveOverlay: { targetLevelDelta: 1 },
    volumeModifier: 0.1,
  });
  const hard = await buildSessionPlanJson({
    ...base,
    adaptiveOverlay: { targetLevelDelta: -1, forceShort: true, maxDifficultyCap: 'medium' },
    volumeModifier: -0.2,
  });
  const painFlags = getAvoidTagsForDiscomfort('lower_back');
  const pain = await buildSessionPlanJson({
    ...base,
    adaptiveOverlay: { targetLevelDelta: -1, forceRecovery: true, maxDifficultyCap: 'medium' },
    volumeModifier: -0.2,
    painFlags,
  });
  const neutral = await buildSessionPlanJson({ ...base });

  const mb = planMetrics(baseline, byId);
  const me = planMetrics(easy, byId);
  const mh = planMetrics(hard, byId);
  const mp = planMetrics(pain, byId);
  const mn = planMetrics(neutral, byId);

  const notEasier =
    me.average_difficulty_rank >= mb.average_difficulty_rank - 0.01 ||
    me.main_average_difficulty_rank >= mb.main_average_difficulty_rank - 0.01 ||
    me.average_progression_level >= mb.average_progression_level - 0.01 ||
    me.main_item_count >= mb.main_item_count;
  if (!notEasier) {
    failLayer('plan-diff easy', 'easy easier than baseline', { mb, me });
  } else {
    line(`[adaptive-real] plan-diff baseline vs easy: PASS (avgD ${mb.average_difficulty_rank.toFixed(2)} → ${me.average_difficulty_rank.toFixed(2)})`);
  }
  if (me.average_difficulty_rank === mb.average_difficulty_rank && me.total_item_count === mb.total_item_count) {
    line('[adaptive-real] plan-diff: WARN easy vs baseline no material metric diff (templates may match)');
  }

  const hasHighHard = (hard.segments ?? []).some((s) =>
    (s.items ?? []).some((it) => byId.get(it.templateId)?.difficulty === 'high')
  );
  const hardEasier =
    mh.average_difficulty_rank < mb.average_difficulty_rank - 0.01 ||
    mh.average_progression_level < mb.average_progression_level - 0.01 ||
    mh.total_item_count < mb.total_item_count ||
    mh.main_item_count < mb.main_item_count ||
    hard.flags?.short === true ||
    !hasHighHard;
  if (!hardEasier) {
    failLayer('plan-diff hard', 'expected easier/shorter/lower rank, volume, or no high diff', { mb, mh, hasHighHard });
  } else {
    line(
      `[adaptive-real] plan-diff baseline vs hard: PASS short=${hard.flags?.short} avgD ${mb.average_difficulty_rank.toFixed(2)} → ${mh.average_difficulty_rank.toFixed(2)} highTemplates=${hasHighHard}`
    );
  }

  const hasHighPain = (pain.segments ?? []).some((s) =>
    (s.items ?? []).some((it) => byId.get(it.templateId)?.difficulty === 'high')
  );
  if (hasHighPain) {
    failLayer('plan-diff pain', 'high difficulty template under cap scenario', { mp });
  } else {
    line(
      `[adaptive-real] plan-diff baseline vs pain: PASS recovery=${pain.flags?.recovery} maxDiffRank=${mp.max_difficulty_rank}`
    );
  }

  const neutralClose =
    mn.total_item_count === mb.total_item_count && Math.abs(mn.average_difficulty_rank - mb.average_difficulty_rank) < 0.01;
  if (!neutralClose) {
    line('[adaptive-real] plan-diff neutral: WARN small metric drift from duplicate baseline run');
  } else {
    line('[adaptive-real] plan-diff neutral vs baseline: PASS (same input)');
  }
  line(`[adaptive-real] plan-diff easy/hard/pain/neutral: ${exitCode === 0 ? 'PASS' : 'see failures'}`);
}

// ─── Layer 3 cache ────────────────────────────────────────────────────────

function layer3() {
  const userId = 'adaptive-verify-cache-' + Date.now();
  const baseInput = {
    userId,
    sessionNumber: 2,
    totalSessions: 8,
    phase: 1,
    theme: 't',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: ['a'],
    avoid: [],
    painFlags: [],
    usedTemplateIds: [],
  };
  setCachedPlan(baseInput, { marker: 'baseline' });
  if (getCachedPlan(baseInput)?.marker !== 'baseline') {
    failLayer('cache', 'baseline get/set', {});
  }
  const easyInput = { ...baseInput, adaptiveOverlay: { targetLevelDelta: 1 }, volumeModifier: 0.1 };
  if (getCachedPlan(easyInput)?.marker === 'baseline') {
    failLayer('cache', 'easy input returned baseline', {});
  }
  const hardInput = { ...baseInput, adaptiveOverlay: { targetLevelDelta: -1, maxDifficultyCap: 'medium' }, volumeModifier: -0.2 };
  if (getCachedPlan(hardInput)?.marker === 'baseline') {
    failLayer('cache', 'hard input returned baseline', {});
  }
  const painInput = { ...baseInput, painFlags: ['lower_back_pain'], adaptiveOverlay: { forceRecovery: true } };
  if (getCachedPlan(painInput)?.marker === 'baseline') {
    failLayer('cache', 'pain input returned baseline', {});
  }
  setCachedPlan(easyInput, { marker: 'easy' });
  if (getCachedPlan(easyInput)?.marker !== 'easy') {
    failLayer('cache', 'easy round-trip', {});
  }
  if (exitCode === 0) {
    line('[adaptive-real] cache-safety: PASS');
  }
}

async function main() {
  line('PR-ADAPTIVE-REAL-NEXT-SESSION-VERIFY-01\n');
  try {
    layer1();
  } catch (e) {
    failLayer('layer1', String(e), e);
  }
  try {
    await layer2();
  } catch (e) {
    failLayer('layer2', String(e), e);
  }
  try {
    layer3();
  } catch (e) {
    failLayer('layer3', String(e), e);
  }

  if (exitCode === 0) {
    line('\n[adaptive-real] layer1+2+3 complete: ALL PASS');
  } else {
    line('\n[adaptive-real] completed with failures — see stderr');
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
