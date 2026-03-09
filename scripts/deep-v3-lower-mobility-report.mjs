/**
 * PR-ALG-15: lower_mobility / stable-deconditioned baseline analysis
 * Run: npx tsx scripts/deep-v3-lower-mobility-report.mjs [--days 30] [--limit 500] [--sample 20] [--mode lower_mobility|gate]
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Read-only. Aggregates derived from deep_test_attempts.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 30, limit: 500, sample: 20, mode: 'all' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      opts.days = parseInt(args[i + 1], 10) || 30;
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = parseInt(args[i + 1], 10) || 500;
      i++;
    } else if (args[i] === '--sample' && args[i + 1]) {
      opts.sample = parseInt(args[i + 1], 10) || 20;
      i++;
    } else if (args[i] === '--mode' && args[i + 1]) {
      opts.mode = args[i + 1];
      i++;
    }
  }
  return opts;
}

function toNum(v) {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}

async function run() {
  const opts = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log('\n=== PR-ALG-15 Lower Mobility/Gate Report (SKIP: no Supabase env) ===\n');
    console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run against real DB.');
    console.log('Or run SQL manually: sql/deep_v3_lower_mobility_gate_analysis.sql\n');
    const sqlPath = join(__dirname, '..', 'sql', 'deep_v3_lower_mobility_gate_analysis.sql');
    try {
      const sql = readFileSync(sqlPath, 'utf-8');
      console.log('--- SQL preview (first 600 chars) ---\n');
      console.log(sql.slice(0, 600) + '...\n');
    } catch {
      /* ignore */
    }
    process.exit(0);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);

  const since = new Date();
  since.setDate(since.getDate() - opts.days);
  const sinceIso = since.toISOString();

  const { data: rows, error } = await supabase
    .from('deep_test_attempts')
    .select('id, finalized_at, scores')
    .eq('status', 'final')
    .eq('scoring_version', 'deep_v3')
    .gte('finalized_at', sinceIso)
    .order('finalized_at', { ascending: false })
    .limit(opts.limit);

  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  const list = (rows || []).filter((r) => r.scores?.derived);
  const total = list.length;

  const primaryCount = {};
  const secondaryCount = {};
  let lowerMobilityNonzero = 0;
  let lmPlusLs = 0;
  let lmPlusTc = 0;
  const lowerMobilityTop = [];
  const stableSamples = [];
  const decondSamples = [];

  for (const r of list) {
    const d = r.scores?.derived || {};
    const pt = d.primary_type || 'unknown';
    const st = d.secondary_type || null;
    primaryCount[pt] = (primaryCount[pt] || 0) + 1;
    if (st) secondaryCount[st] = (secondaryCount[st] || 0) + 1;

    const pv = d.priority_vector || {};
    const lm = toNum(pv.lower_mobility);
    const ls = toNum(pv.lower_stability);
    const tc = toNum(pv.trunk_control);

    if (lm > 0.01) {
      lowerMobilityNonzero++;
      lowerMobilityTop.push({ id: r.id, lm, primary_type: pt, secondary_type: st, pv });
    }
    if (lm > 0.01 && ls > 0.01) lmPlusLs++;
    if (lm > 0.01 && tc > 0.01) lmPlusTc++;

    if (pt === 'STABLE') stableSamples.push({ id: r.id, pv, finalized_at: r.finalized_at });
    if (pt === 'DECONDITIONED') decondSamples.push({ id: r.id, pv, finalized_at: r.finalized_at });
  }

  const stableCount = primaryCount['STABLE'] || 0;
  const decondCount = primaryCount['DECONDITIONED'] || 0;
  const lmPrimaryCount = primaryCount['LOWER_MOBILITY_RESTRICTION'] || 0;
  const lmSecondaryCount = secondaryCount['LOWER_MOBILITY_RESTRICTION'] || 0;
  const stableRate = total > 0 ? (stableCount / total) * 100 : 0;
  const decondRate = total > 0 ? (decondCount / total) * 100 : 0;
  const lmNonzeroRate = total > 0 ? (lowerMobilityNonzero / total) * 100 : 0;
  const lmPrimaryRate = total > 0 ? (lmPrimaryCount / total) * 100 : 0;

  console.log('\n=== PR-ALG-15 Lower Mobility / Gate Baseline Report ===\n');
  console.log(`Period: last ${opts.days} days | Limit: ${opts.limit} | Mode: ${opts.mode}`);
  console.log(`Data: ${total} deep_v3 final rows\n`);

  console.log('1. Gate 분포');
  console.log(`   total_final: ${total}`);
  console.log(`   STABLE: ${stableCount} (${stableRate.toFixed(1)}%)`);
  console.log(`   DECONDITIONED: ${decondCount} (${decondRate.toFixed(1)}%)`);
  console.log(`   primary_type 분포: ${Object.entries(primaryCount).map(([k, v]) => `${k}=${v}`).join(', ')}\n`);

  console.log('2. lower_mobility baseline');
  console.log(`   lower_mobility non-zero: ${lowerMobilityNonzero} (${lmNonzeroRate.toFixed(1)}%)`);
  console.log(`   LOWER_MOBILITY_RESTRICTION primary: ${lmPrimaryCount} (${lmPrimaryRate.toFixed(1)}%)`);
  console.log(`   LOWER_MOBILITY_RESTRICTION secondary: ${lmSecondaryCount}`);
  console.log(`   lower_mobility + lower_stability overlap: ${lmPlusLs}`);
  console.log(`   lower_mobility + trunk_control overlap: ${lmPlusTc}\n`);

  if (opts.mode === 'lower_mobility' || opts.mode === 'all') {
    console.log('3. Sample: lower_mobility top cases');
    const sorted = lowerMobilityTop.sort((a, b) => b.lm - a.lm).slice(0, opts.sample);
    for (const s of sorted) {
      console.log(`   ${s.id} | primary=${s.primary_type} secondary=${s.secondary_type} | lm=${s.lm.toFixed(3)}`);
    }
    if (sorted.length === 0) console.log('   (없음)');
    console.log('');
  }

  if (opts.mode === 'gate' || opts.mode === 'all') {
    console.log('4. Sample: STABLE cases');
    for (const s of stableSamples.slice(0, opts.sample)) {
      console.log(`   ${s.id} | ${s.finalized_at}`);
    }
    if (stableSamples.length === 0) console.log('   (없음)');
    console.log('');

    console.log('5. Sample: DECONDITIONED cases');
    for (const s of decondSamples.slice(0, opts.sample)) {
      console.log(`   ${s.id} | ${s.finalized_at}`);
    }
    if (decondSamples.length === 0) console.log('   (없음)');
    console.log('');
  }

  let recommendation = 'keep_current';
  if (total < 10) {
    recommendation = 'collect_more_data';
  } else if (lmNonzeroRate < 1 && total >= 50) {
    recommendation = 'need_shadow_candidate';
  } else if (stableRate > 80 || decondRate > 50) {
    recommendation = 'recalibrate_gate';
  }

  console.log('6. 권고');
  console.log(`   ${recommendation}\n`);
  console.log('=== End Report ===\n');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
