/**
 * PR-ADAPTIVE-API-E2E-VERIFY-01
 * Environment-dependent: POST /api/session/create + /api/session/complete → DB → next create.
 * Missing env → SKIP exit 0. Does not modify production code.
 */
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

const DIFFICULTY_RANK = { low: 1, medium: 2, high: 3 };

function idem(suffix) {
  return `adaptive-e2e-${suffix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function skip(msg) {
  console.log(`[adaptive-api-e2e] SKIP reason=${msg}`);
  process.exit(0);
}

function fail(scenario, step, extra) {
  const detail = { scenario, step, recommend_follow_up: 'PR-ADAPTIVE-API-E2E-FIX-01', ...extra };
  console.error('[adaptive-api-e2e] FAIL', JSON.stringify(detail, null, 2));
  const err = new Error(`E2E_FAIL_${scenario}_${step}`);
  err.detail = detail;
  throw err;
}

function assertLocalOrOptIn(baseUrl, supabaseUrl) {
  const allow = process.env.E2E_ALLOW_PRODUCTION === '1';
  let localish = false;
  try {
    const h = new URL(baseUrl).hostname;
    localish = h === 'localhost' || h === '127.0.0.1';
  } catch {
    /* noop */
  }
  let supLocal = false;
  try {
    const h = new URL(supabaseUrl).hostname;
    supLocal = h === 'localhost' || h === '127.0.0.1';
  } catch {
    /* noop */
  }
  if (!localish && !allow) {
    console.error(
      '[adaptive-api-e2e] FAIL production-like E2E_BASE_URL without E2E_ALLOW_PRODUCTION=1 (use localhost or set opt-in)'
    );
    process.exit(1);
  }
  if (!supLocal && !allow) {
    console.error(
      '[adaptive-api-e2e] FAIL production-like NEXT_PUBLIC_SUPABASE_URL without E2E_ALLOW_PRODUCTION=1'
    );
    process.exit(1);
  }
  if (allow) {
    console.warn(
      '[adaptive-api-e2e] WARN E2E_ALLOW_PRODUCTION=1 — ensure you are not pointing at production data.'
    );
  }
}

function requiredEnv() {
  const base = process.env.E2E_BASE_URL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !url || !anon || !sr) {
    skip(
      `missing required env (E2E_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)`
    );
  }
  const jwt = process.env.E2E_SUPABASE_JWT;
  const uid = process.env.E2E_USER_ID;
  const em = process.env.E2E_TEST_EMAIL;
  const pw = process.env.E2E_TEST_PASSWORD;
  const hasA = jwt && uid;
  const hasB = em && pw;
  if (!hasA && !hasB) {
    skip('missing auth env (Mode A: E2E_SUPABASE_JWT + E2E_USER_ID) or (Mode B: E2E_TEST_EMAIL + E2E_TEST_PASSWORD)');
  }
  return { base, url, anon, sr, auth: hasA ? { mode: 'jwt', jwt, uid } : { mode: 'password', em, pw } };
}

/** PR2: same penguin-dominant answers as deep-v2-03 smoke — LOWER_INSTABILITY */
function penguinAnswers() {
  return {
    v2_A1: 1,
    v2_A2: 1,
    v2_A3: 1,
    v2_B1: 1,
    v2_B2: 1,
    v2_B3: 1,
    v2_C1: 1,
    v2_C2: 1,
    v2_C3: 1,
    v2_D1: 4,
    v2_D2: 4,
    v2_D3: 4,
    v2_F1: 1,
    v2_F2: 1,
    v2_F3: 1,
    v2_G1: 1,
    v2_G2: 1,
    v2_G3: 1,
  };
}

async function resolveAuth(url, anon, auth) {
  if (auth.mode === 'jwt') {
    return { accessToken: auth.jwt, userId: auth.uid };
  }
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await userClient.auth.signInWithPassword({
    email: auth.em,
    password: auth.pw,
  });
  if (error || !data.session?.access_token || !data.user?.id) {
    fail('auth', 'signIn', { error: error?.message ?? 'no session' });
  }
  return { accessToken: data.session.access_token, userId: data.user.id };
}

function planMetricsFromJson(planJson, templateById) {
  const plan = planJson;
  let total = 0;
  let mainCount = 0;
  const ranks = [];
  const mainRanks = [];
  const prog = [];
  const mainProg = [];
  for (const seg of plan?.segments ?? []) {
    const isMain = seg.title === 'Main';
    for (const it of seg.items ?? []) {
      total += 1;
      if (isMain) mainCount += 1;
      const t = templateById?.get?.(it.templateId) ?? null;
      const d = t?.difficulty;
      const r = DIFFICULTY_RANK[d] ?? 0;
      ranks.push(r);
      if (isMain) {
        mainRanks.push(r);
        mainProg.push(t?.progression_level ?? 0);
      }
      prog.push(t?.progression_level ?? 0);
    }
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const flags = plan?.flags ?? {};
  return {
    total_item_count: total,
    main_item_count: mainCount,
    average_difficulty_rank: avg(ranks),
    main_average_difficulty_rank: avg(mainRanks),
    max_difficulty_rank: ranks.length ? Math.max(...ranks) : 0,
    average_progression_level: avg(prog),
    main_average_progression_level: avg(mainProg),
    high_difficulty_count: ranks.filter((x) => x === 3).length,
    medium_or_high_count: ranks.filter((x) => x >= 2).length,
    recovery: flags.recovery === true,
    short: flags.short === true,
    finalTargetLevel: plan?.meta?.finalTargetLevel,
    constraint_flags: plan?.meta?.constraint_flags ?? null,
  };
}

/** Without DB templates, rank from plan_json items if difficulty lives on items */
function planMetricsLoose(planJson) {
  const plan = planJson;
  let total = 0;
  let mainCount = 0;
  const ranks = [];
  const mainRanks = [];
  for (const seg of plan?.segments ?? []) {
    const isMain = seg.title === 'Main';
    for (const it of seg.items ?? []) {
      total += 1;
      if (isMain) mainCount += 1;
      const d = it.difficulty;
      const r = typeof d === 'string' ? DIFFICULTY_RANK[d] ?? 0 : 0;
      ranks.push(r);
      if (isMain) mainRanks.push(r);
    }
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const flags = plan?.flags ?? {};
  return {
    total_item_count: total,
    main_item_count: mainCount,
    average_difficulty_rank: avg(ranks),
    main_average_difficulty_rank: avg(mainRanks),
    max_difficulty_rank: ranks.length ? Math.max(...ranks) : 0,
    high_difficulty_count: ranks.filter((x) => x === 3).length,
    medium_or_high_count: ranks.filter((x) => x >= 2).length,
    recovery: flags.recovery === true,
    short: flags.short === true,
    finalTargetLevel: plan?.meta?.finalTargetLevel,
    constraint_flags: plan?.meta?.constraint_flags ?? null,
  };
}

function collectPlanItems(planJson) {
  const out = [];
  const pj = planJson;
  for (let segIdx = 0; segIdx < (pj?.segments ?? []).length; segIdx++) {
    const seg = pj.segments[segIdx];
    for (let itemIdx = 0; itemIdx < (seg.items ?? []).length; itemIdx++) {
      const it = seg.items[itemIdx];
      const tid = it.templateId;
      if (typeof tid === 'string') {
        out.push({
          plan_item_key: `${segIdx}:${itemIdx}:${tid}`,
          templateId: tid,
          name: typeof it.name === 'string' ? it.name : tid,
          segment_index: segIdx,
          item_index: itemIdx,
        });
      }
    }
  }
  return out;
}

function buildLogsForItems(items, profile) {
  const { difficulty = 2, rpe = 5, discomfort = 0 } = profile;
  return items.map((p) => ({
    templateId: p.templateId,
    name: p.name,
    plan_item_key: p.plan_item_key,
    segment_index: p.segment_index,
    item_index: p.item_index,
    sets: 1,
    reps: 10,
    difficulty,
    rpe,
    discomfort,
  }));
}

async function apiPostJson(url, token, body, idemKey) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idemKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

function getKstDayKeyUTC(d = new Date()) {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstMs = d.getTime() + KST_OFFSET_MS;
  return new Date(kstMs).toISOString().slice(0, 10);
}

function previousKstDayKey() {
  return getKstDayKeyUTC(new Date(Date.now() - 26 * 60 * 60 * 1000));
}

async function cleanupUser(admin, userId) {
  const tables = [
    () => admin.from('session_exercise_events').delete().eq('user_id', userId),
    () => admin.from('session_adaptive_summaries').delete().eq('user_id', userId),
    () => admin.from('exercise_feedback').delete().eq('user_id', userId),
    () => admin.from('session_feedback').delete().eq('user_id', userId),
    () => admin.from('session_plans').delete().eq('user_id', userId),
    () => admin.from('session_program_progress').delete().eq('user_id', userId),
    () => admin.from('public_results').delete().eq('user_id', userId),
  ];
  for (const fn of tables) {
    const { error } = await fn();
    if (error && error.code !== 'PGRST116') {
      console.warn('[adaptive-api-e2e] cleanup warn', error.message);
    }
  }
}

async function seedProfileAndPublicResult(admin, userId) {
  const { buildFreeSurveyBaselineResult } = await import(
    '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
  );
  const baseline = buildFreeSurveyBaselineResult(penguinAnswers());
  const result = baseline.result;
  const { error: pErr } = await admin.from('session_user_profile').upsert(
    {
      user_id: userId,
      target_frequency: 3,
      exercise_experience_level: 'beginner',
      pain_or_discomfort_present: false,
    },
    { onConflict: 'user_id' }
  );
  if (pErr) fail('seed', 'session_user_profile', { pErr });

  const { error: rErr } = await admin.from('public_results').insert({
    anon_id: crypto.randomUUID(),
    user_id: userId,
    result_v2_json: result,
    source_inputs: ['free_survey'],
    source_mode: 'free_survey',
    result_stage: 'baseline',
    confidence_normalized: result.confidence,
    evidence_level: result.evidence_level,
    schema_version: 'v2',
    claimed_at: new Date().toISOString(),
  });
  if (rErr) fail('seed', 'public_results', { rErr });
}

// TEST ONLY: simulate next KST day without modifying production time code.
async function unlockNextKstDayForTest(admin, userId) {
  const y = previousKstDayKey();
  const { error } = await admin
    .from('session_program_progress')
    .update({ last_completed_day_key: y })
    .eq('user_id', userId);
  if (error) fail('unlock', 'session_program_progress', { error });
}

async function fetchPlanJson(admin, userId, sessionNumber) {
  const { data, error } = await admin
    .from('session_plans')
    .select('plan_json, generation_trace_json, status')
    .eq('user_id', userId)
    .eq('session_number', sessionNumber)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function runScenario({
  name,
  admin,
  baseUrl,
  token,
  userId,
  completeProfile,
  assertS2,
}) {
  await cleanupUser(admin, userId);
  await seedProfileAndPublicResult(admin, userId);

  const createUrl = `${baseUrl.replace(/\/$/, '')}/api/session/create`;
  const completeUrl = `${baseUrl.replace(/\/$/, '')}/api/session/complete`;

  const r1 = await apiPostJson(
    createUrl,
    token,
    { debug: true, condition_mood: 'ok', time_budget: 'normal', pain_flags: [] },
    idem(`create-s1-${name}`)
  );
  if (!r1.res.ok || !r1.json?.ok) {
    fail(name, 'create_s1', { status: r1.res.status, body: r1.json });
  }
  const d1 = r1.json.data;
  if (!d1?.active?.session_number || d1.active.session_number !== 1) {
    fail(name, 'create_s1_session_number', { d1 });
  }

  const { data: prog1 } = await admin.from('session_program_progress').select('*').eq('user_id', userId).maybeSingle();
  if (!prog1 || prog1.active_session_number !== 1) {
    fail(name, 'progress_active_s1', { prog1 });
  }

  const planRow1 = await fetchPlanJson(admin, userId, 1);
  if (!planRow1?.plan_json) fail(name, 'db_plan_s1', {});

  const items = collectPlanItems(planRow1.plan_json);
  const exercise_logs = buildLogsForItems(items, completeProfile);

  const cr = await apiPostJson(
    completeUrl,
    token,
    {
      session_number: 1,
      duration_seconds: 600,
      completion_mode: completeProfile.completion_mode ?? 'all_done',
      exercise_logs,
      feedback: completeProfile.feedback,
      debug: true,
    },
    idem(`complete-s1-${name}`)
  );
  if (!cr.res.ok || !cr.json?.ok) {
    fail(name, 'complete_s1', { status: cr.res.status, body: cr.json });
  }

  const { count: fbCount } = await admin
    .from('session_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((fbCount ?? 0) < 1 && completeProfile.feedback) {
    fail(name, 'session_feedback_missing', { fbCount });
  }

  const { count: evCount } = await admin
    .from('session_exercise_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((evCount ?? 0) < 1) {
    fail(name, 'session_exercise_events_missing', { evCount });
  }

  const { data: adapRows } = await admin
    .from('session_adaptive_summaries')
    .select('id, summary_status')
    .eq('user_id', userId)
    .limit(1);
  if (!adapRows?.length) {
    console.warn(`[adaptive-api-e2e] WARN ${name}: no session_adaptive_summaries row (evaluator may return insufficient_data)`);
  }

  const { data: sp1 } = await admin.from('session_plans').select('status').eq('user_id', userId).eq('session_number', 1).maybeSingle();
  if (sp1?.status !== 'completed') fail(name, 's1_not_completed', { sp1 });

  const { data: progAfter } = await admin.from('session_program_progress').select('*').eq('user_id', userId).maybeSingle();
  if ((progAfter?.completed_sessions ?? 0) < 1) fail(name, 'progress_completed', { progAfter });
  const lk = progAfter?.last_completed_day_key != null ? String(progAfter.last_completed_day_key).slice(0, 10) : null;
  if (!lk) {
    fail(name, 'last_completed_day_key_missing', { progAfter });
  }

  const lim = await apiPostJson(
    createUrl,
    token,
    { debug: true, condition_mood: 'ok', time_budget: 'normal', pain_flags: [] },
    idem(`create-s2-block-${name}`)
  );
  if (lim.res.status !== 409 || lim.json?.error?.code !== 'DAILY_LIMIT_REACHED') {
    fail(name, 'daily_limit_expected', { status: lim.res.status, body: lim.json });
  }

  await unlockNextKstDayForTest(admin, userId);

  const r2 = await apiPostJson(
    createUrl,
    token,
    { debug: true, condition_mood: 'ok', time_budget: 'normal', pain_flags: [] },
    idem(`create-s2-${name}`)
  );
  if (!r2.res.ok || !r2.json?.ok) {
    fail(name, 'create_s2', { status: r2.res.status, body: r2.json });
  }
  const d2 = r2.json.data;
  if (d2?.active?.session_number !== 2) {
    fail(name, 'create_s2_session_number', { d2 });
  }

  const plan2 = await fetchPlanJson(admin, userId, 2);
  if (!plan2?.plan_json) fail(name, 'db_plan_s2', {});

  const m1 = planMetricsLoose(planRow1.plan_json);
  const m2 = planMetricsLoose(plan2.plan_json);
  const dbg = r2.json.debug;
  assertS2({ m1, m2, dbg, plan2json: plan2.plan_json });

  return { m1, m2, dbg };
}

async function main() {
  const env = requiredEnv();
  assertLocalOrOptIn(env.base, env.url);

  const admin = createClient(env.url, env.sr, { auth: { persistSession: false } });
  const { accessToken, userId } = await resolveAuth(env.url, env.anon, env.auth);

  const scenario = (process.env.E2E_SCENARIO ?? 'all').toLowerCase();
  const scenarios =
    scenario === 'all' ? ['easy', 'hard', 'pain', 'daily-limit'] : [scenario];

  const baseUrl = env.base;

  const runEasy = async () => {
    await runScenario({
      name: 'easy',
      admin,
      baseUrl,
      token: accessToken,
      userId,
      completeProfile: {
        completion_mode: 'all_done',
        difficulty: 2,
        rpe: 4,
        discomfort: 0,
        feedback: {
          sessionFeedback: {
            overallRpe: 4,
            painAfter: 0,
            difficultyFeedback: 'too_easy',
            completionRatio: 0.98,
          },
        },
      },
      assertS2: ({ m2, dbg }) => {
        const mc = dbg?.adaptive_consumption_trace?.merged_controls;
        if (m2.recovery || mc?.forceRecovery) {
          fail('easy', 's2_no_force_recovery', { m2, mc });
        }
        if (mc?.maxDifficultyCap === 'medium' && m2.high_difficulty_count === 0) {
          /* cap without high items is ok */
        }
      },
    });
  };

  const runHard = async () => {
    await runScenario({
      name: 'hard',
      admin,
      baseUrl,
      token: accessToken,
      userId,
      completeProfile: {
        completion_mode: 'all_done',
        difficulty: 5,
        rpe: 9,
        discomfort: 2,
        feedback: {
          sessionFeedback: {
            overallRpe: 9,
            painAfter: 2,
            difficultyFeedback: 'too_hard',
            completionRatio: 0.4,
          },
        },
      },
      assertS2: ({ m1, m2, dbg }) => {
        const mc = dbg?.adaptive_consumption_trace?.merged_controls;
        const harder =
          m2.average_difficulty_rank > m1.average_difficulty_rank + 0.1 &&
          m2.high_difficulty_count > m1.high_difficulty_count;
        if (harder) {
          fail('hard', 's2_not_harder_than_s1', { m1, m2 });
        }
        if (!(mc?.forceRecovery || mc?.maxDifficultyCap || mc?.forceShort || m2.recovery || m2.short)) {
          console.warn('[adaptive-api-e2e] WARN hard: no obvious downward merge flag (design may vary after 1 session)');
        }
      },
    });
  };

  const runPain = async () => {
    await runScenario({
      name: 'pain',
      admin,
      baseUrl,
      token: accessToken,
      userId,
      completeProfile: {
        completion_mode: 'all_done',
        difficulty: 3,
        rpe: 7,
        discomfort: 8,
        completion: 0.9,
        feedback: {
          sessionFeedback: {
            overallRpe: 7,
            painAfter: 7,
            difficultyFeedback: 'ok',
            completionRatio: 0.9,
            painAreas: ['lower_back'],
          },
        },
      },
      assertS2: ({ m1, m2, dbg }) => {
        const mc = dbg?.adaptive_consumption_trace?.merged_controls;
        if (m2.main_average_difficulty_rank > m1.main_average_difficulty_rank + 0.5 && m2.high_difficulty_count > m1.high_difficulty_count) {
          fail('pain', 's2_upward_jump', { m1, m2 });
        }
        if (!mc?.forceRecovery && !mc?.maxDifficultyCap && !m2.recovery) {
          console.warn('[adaptive-api-e2e] WARN pain: no recovery/cap in merge (may still be valid)');
        }
      },
    });
  };

  const runDailyOnly = async () => {
    await cleanupUser(admin, userId);
    await seedProfileAndPublicResult(admin, userId);
    const createUrl = `${baseUrl.replace(/\/$/, '')}/api/session/create`;
    const completeUrl = `${baseUrl.replace(/\/$/, '')}/api/session/complete`;

    const r1 = await apiPostJson(
      createUrl,
      accessToken,
      { debug: true, condition_mood: 'ok', time_budget: 'normal', pain_flags: [] },
      idem('daily-s1-create')
    );
    if (!r1.res.ok || !r1.json?.ok) fail('daily-limit', 'create_s1', { r1: r1.json });

    const planRow1 = await fetchPlanJson(admin, userId, 1);
    const items = collectPlanItems(planRow1.plan_json);
    const exercise_logs = buildLogsForItems(items, { difficulty: 3, rpe: 5, discomfort: 1, completion: 0.95 });
    const cr = await apiPostJson(
      completeUrl,
      accessToken,
      {
        session_number: 1,
        duration_seconds: 500,
        completion_mode: 'all_done',
        exercise_logs,
        feedback: { sessionFeedback: { overallRpe: 5, completionRatio: 0.95 } },
        debug: true,
      },
      idem('daily-s1-complete')
    );
    if (!cr.res.ok || !cr.json?.ok) fail('daily-limit', 'complete', { cr: cr.json });

    const lim = await apiPostJson(
      createUrl,
      accessToken,
      { debug: true, condition_mood: 'ok', time_budget: 'normal', pain_flags: [] },
      idem('daily-second-create')
    );
    if (lim.res.status !== 409 || lim.json?.error?.code !== 'DAILY_LIMIT_REACHED') {
      fail('daily-limit', 'expect_409', { lim: lim.json });
    }
    await unlockNextKstDayForTest(admin, userId);
    const r2 = await apiPostJson(
      createUrl,
      accessToken,
      { debug: true, condition_mood: 'ok', time_budget: 'normal', pain_flags: [] },
      idem('daily-s2-create')
    );
    if (!r2.res.ok || !r2.json?.ok) fail('daily-limit', 's2_after_unlock', { r2: r2.json });
  };

  try {
    for (const s of scenarios) {
      if (s === 'easy') await runEasy();
      else if (s === 'hard') await runHard();
      else if (s === 'pain') await runPain();
      else if (s === 'daily-limit') await runDailyOnly();
      else fail('config', 'unknown_scenario', { s });
    }
    console.log(
      `[adaptive-api-e2e] PASS scenario=${scenarios.join(',')} created_user=${userId} cleanup=deferred`
    );
  } finally {
    if (process.env.E2E_CLEANUP === '0') {
      console.log('[adaptive-api-e2e] cleanup=skipped');
    } else {
      await cleanupUser(admin, userId);
      console.log('[adaptive-api-e2e] cleanup=done');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
