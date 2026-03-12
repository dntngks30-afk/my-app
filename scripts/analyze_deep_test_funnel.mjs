/**
 * PR-DEEP-ANALYSIS-01: Deep Test Funnel Analysis
 * Run: npx tsx scripts/analyze_deep_test_funnel.mjs [--days 30] [--limit 1000] [--input events.json]
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for DB mode)
 * Or: --input path/to/events.json (offline mode)
 *
 * Output: Funnel KPIs, abandon distribution, section dwell, pain_mode, priority_vector
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const DEEP_EVENTS = [
  'deep_test_started',
  'deep_test_section_viewed',
  'deep_test_section_completed',
  'deep_test_abandoned',
  'deep_test_submitted',
  'deep_result_viewed',
  'deep_result_cta_clicked',
];

const SESSION_CREATE_EVENTS = ['session_create', 'session_create_idempotent'];

const RESULT_SESSION_WINDOW_MS = 30 * 60 * 1000; // 30 min

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 30, limit: 2000, input: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      opts.days = parseInt(args[i + 1], 10) || 30;
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = parseInt(args[i + 1], 10) || 2000;
      i++;
    } else if (args[i] === '--input' && args[i + 1]) {
      opts.input = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function fetchFromDb(supabase, sinceIso, limit) {
  const eventTypes = [...DEEP_EVENTS, ...SESSION_CREATE_EVENTS];
  const { data, error } = await supabase
    .from('session_events')
    .select('id, user_id, event_type, created_at, meta')
    .in('event_type', eventTypes)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

function loadFromFile(path) {
  const abs = join(process.cwd(), path);
  if (!existsSync(abs)) throw new Error(`File not found: ${path}`);
  const raw = readFileSync(abs, 'utf-8');
  const arr = JSON.parse(raw);
  return Array.isArray(arr) ? arr : arr.events || [];
}

function analyze(events) {
  const deep = events.filter((e) => DEEP_EVENTS.includes(e.event_type));
  const sessionCreates = events.filter((e) => SESSION_CREATE_EVENTS.includes(e.event_type));

  const byUser = new Map();
  for (const e of deep) {
    const uid = e.user_id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(e);
  }

  const started = new Set();
  const submitted = new Set();
  const resultViewed = new Set();
  const ctaClicked = new Map(); // uid -> { session_start, home, retest }
  const abandonBySection = {};
  const abandonByQuestion = {};
  const sectionDwell = {}; // section_id -> [ms]
  const painModeCount = { none: 0, caution: 0, protected: 0 };
  const priorityAxisCount = {};

  for (const [uid, evs] of byUser) {
    const sorted = evs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (const e of sorted) {
      const meta = e.meta || {};
      const ts = new Date(e.created_at).getTime();

      if (e.event_type === 'deep_test_started') {
        started.add(uid);
      } else if (e.event_type === 'deep_test_submitted') {
        submitted.add(uid);
      } else if (e.event_type === 'deep_test_abandoned') {
        const sec = meta.last_section || 'unknown';
        abandonBySection[sec] = (abandonBySection[sec] || 0) + 1;
        const qid = meta.last_question_id;
        if (typeof qid === 'string' && qid) {
          abandonByQuestion[qid] = (abandonByQuestion[qid] || 0) + 1;
        }
      } else if (e.event_type === 'deep_test_section_completed') {
        const sec = meta.section_id || 'unknown';
        const ms = meta.section_duration_ms;
        if (typeof ms === 'number' && ms > 0) {
          if (!sectionDwell[sec]) sectionDwell[sec] = [];
          sectionDwell[sec].push(ms);
        }
      } else if (e.event_type === 'deep_result_viewed') {
        resultViewed.add(uid);
        const pm = meta.pain_mode || 'none';
        if (['none', 'caution', 'protected'].includes(pm)) painModeCount[pm]++;
        const axes = meta.top_priority_axis;
        if (Array.isArray(axes)) {
          for (const ax of axes) {
            if (typeof ax === 'string') priorityAxisCount[ax] = (priorityAxisCount[ax] || 0) + 1;
          }
        }
      } else if (e.event_type === 'deep_result_cta_clicked') {
        if (!ctaClicked.has(uid)) ctaClicked.set(uid, { session_start: false, home: false, retest: false });
        const ct = meta.cta_type || '';
        if (ct === 'session_start') ctaClicked.get(uid).session_start = true;
        else if (ct === 'home') ctaClicked.get(uid).home = true;
        else if (ct === 'retest') ctaClicked.get(uid).retest = true;
      }
    }
  }

  const sessionsByUser = new Map();
  for (const e of sessionCreates) {
    const uid = e.user_id;
    const ts = new Date(e.created_at).getTime();
    if (!sessionsByUser.has(uid)) sessionsByUser.set(uid, []);
    sessionsByUser.get(uid).push(ts);
  }

  let sessionsAfterResult = 0;
  for (const uid of resultViewed) {
    const evs = byUser.get(uid) || [];
    const lastResult = evs
      .filter((e) => e.event_type === 'deep_result_viewed')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (!lastResult) continue;
    const resultTs = new Date(lastResult.created_at).getTime();
    const sessionTs = (sessionsByUser.get(uid) || []).filter((t) => t >= resultTs && t - resultTs <= RESULT_SESSION_WINDOW_MS);
    if (sessionTs.length > 0) sessionsAfterResult++;
  }

  const testsStarted = started.size;
  const testsSubmitted = submitted.size;
  const resultsViewed = resultViewed.size;
  const ctaSessionStart = [...ctaClicked.values()].filter((c) => c.session_start).length;
  const sessionConversion = sessionsAfterResult;

  const completionRate = testsStarted > 0 ? (testsSubmitted / testsStarted * 100).toFixed(1) : '-';
  const resultReachRate = testsSubmitted > 0 ? (resultsViewed / testsSubmitted * 100).toFixed(1) : '-';
  const sessionConversionRate = resultsViewed > 0 ? (sessionConversion / resultsViewed * 100).toFixed(1) : '-';
  const ctaClickRate = resultsViewed > 0 ? (ctaSessionStart / resultsViewed * 100).toFixed(1) : '-';

  const totalAbandon = Object.values(abandonBySection).reduce((a, b) => a + b, 0);
  const abandonPct = totalAbandon > 0
    ? Object.entries(abandonBySection)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `${k}: ${v} (${(v / totalAbandon * 100).toFixed(0)}%)`)
    : ['(none)'];

  const totalAbandonQ = Object.values(abandonByQuestion).reduce((a, b) => a + b, 0);
  const abandonByQuestionPct = totalAbandonQ > 0
    ? Object.entries(abandonByQuestion)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v} (${(v / totalAbandonQ * 100).toFixed(0)}%)`)
    : ['(none - last_question_id optional)'];

  const avgDwell = {};
  for (const [sec, arr] of Object.entries(sectionDwell)) {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    avgDwell[sec] = (avg / 1000).toFixed(1) + 's';
  }

  const totalPain = painModeCount.none + painModeCount.caution + painModeCount.protected;
  const painDist = totalPain > 0
    ? {
        none: (painModeCount.none / totalPain * 100).toFixed(1) + '%',
        caution: (painModeCount.caution / totalPain * 100).toFixed(1) + '%',
        protected: (painModeCount.protected / totalPain * 100).toFixed(1) + '%',
      }
    : { none: '-', caution: '-', protected: '-' };

  const totalAxis = Object.values(priorityAxisCount).reduce((a, b) => a + b, 0);
  const axisDist = totalAxis > 0
    ? Object.entries(priorityAxisCount)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `${k}: ${(v / totalAxis * 100).toFixed(0)}%`)
    : ['(none)'];

  const longestDwellSection = Object.entries(sectionDwell).length > 0
    ? Object.entries(sectionDwell)
        .map(([sec, arr]) => ({ sec, avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
        .sort((a, b) => b.avg - a.avg)[0]
    : null;

  return {
    testsStarted,
    testsSubmitted,
    resultsViewed,
    sessionsStarted: sessionConversion,
    completionRate,
    resultReachRate,
    sessionConversionRate,
    ctaClickRate,
    abandonBySection,
    abandonPct,
    abandonByQuestionPct,
    avgDwell,
    longestDwellSection,
    painDist,
    axisDist,
  };
}

function printReport(r) {
  console.log('\n=== Deep Test Funnel Report ===\n');
  console.log('Funnel counts:');
  console.log(`  tests_started:      ${r.testsStarted}`);
  console.log(`  tests_submitted:    ${r.testsSubmitted}`);
  console.log(`  results_viewed:     ${r.resultsViewed}`);
  console.log(`  sessions_started:   ${r.sessionsStarted} (within 30min of result)\n`);

  console.log('Conversion rates:');
  console.log(`  completion_rate:    ${r.completionRate}%`);
  console.log(`  result_reach_rate:  ${r.resultReachRate}%`);
  console.log(`  session_conversion: ${r.sessionConversionRate}%`);
  console.log(`  cta_click_rate:     ${r.ctaClickRate}%\n`);

  console.log('Abandon by section:');
  r.abandonPct.forEach((s) => console.log(`  ${s}`));
  if (r.abandonByQuestionPct) {
    console.log('Abandon by question (when last_question_id available):');
    r.abandonByQuestionPct.forEach((s) => console.log(`  ${s}`));
  }
  console.log('');

  if (r.longestDwellSection) {
    console.log('Longest dwell section:');
    console.log(`  ${r.longestDwellSection.sec}: avg ${(r.longestDwellSection.avg / 1000).toFixed(1)}s`);
    console.log('');
  }

  console.log('Average section dwell:');
  for (const [k, v] of Object.entries(r.avgDwell)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('');

  console.log('pain_mode distribution:');
  console.log(`  none: ${r.painDist.none}, caution: ${r.painDist.caution}, protected: ${r.painDist.protected}\n`);

  console.log('Top priority_axis distribution:');
  r.axisDist.forEach((s) => console.log(`  ${s}`));
  console.log('');
}

async function run() {
  const opts = parseArgs();
  let events = [];

  if (opts.input) {
    events = loadFromFile(opts.input);
    console.log(`Loaded ${events.length} events from ${opts.input}`);
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.log('\n=== Deep Test Funnel Analysis (SKIP: no Supabase env) ===\n');
      console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for DB mode.');
      console.log('Or use --input events.json for offline analysis.\n');
      console.log('Example export (SQL):');
      console.log('  SELECT event_type, user_id, created_at, meta FROM session_events');
      console.log('  WHERE event_type IN (\'deep_test_started\',\'deep_test_submitted\',\'deep_result_viewed\',...);\n');
      process.exit(0);
    }

    const since = new Date();
    since.setDate(since.getDate() - opts.days);
    const sinceIso = since.toISOString();

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    events = await fetchFromDb(supabase, sinceIso, opts.limit);
    console.log(`Fetched ${events.length} events (last ${opts.days} days)`);
  }

  if (events.length === 0) {
    console.log('\nNo events to analyze.\n');
    process.exit(0);
  }

  const report = analyze(events);
  printReport(report);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
