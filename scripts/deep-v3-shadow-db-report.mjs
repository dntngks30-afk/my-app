/**
 * PR-ALG-14: Real DB pain_mode active vs legacy analysis
 * Run: npx tsx scripts/deep-v3-shadow-db-report.mjs [--days 30] [--limit 500] [--sample 20]
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Read-only. Aggregates shadow_compare from deep_test_attempts.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 30, limit: 500, sample: 20, candidate: 'pain_mode_legacy' };
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
    } else if (args[i] === '--candidate' && args[i + 1]) {
      opts.candidate = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function run() {
  const opts = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log('\n=== PR-ALG-14 Shadow DB Report (SKIP: no Supabase env) ===\n');
    console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run against real DB.');
    console.log('Or run SQL manually: sql/deep_v3_pain_mode_shadow_analysis.sql\n');
    const sqlPath = join(__dirname, '..', 'sql', 'deep_v3_pain_mode_shadow_analysis.sql');
    try {
      const sql = readFileSync(sqlPath, 'utf-8');
      console.log('--- SQL preview (first 500 chars) ---\n');
      console.log(sql.slice(0, 500) + '...\n');
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
    .select('id, user_id, finalized_at, scores')
    .eq('status', 'final')
    .gte('finalized_at', sinceIso)
    .order('finalized_at', { ascending: false })
    .limit(opts.limit * 2);

  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  const withShadow = (rows || [])
    .filter((r) => r.scores?.shadow_compare?.candidate_name === opts.candidate)
    .slice(0, opts.limit);

  const total = withShadow.length;
  const painModeChanged = withShadow.filter((r) => {
    const flags = r.scores?.shadow_compare?.diff_flags || [];
    return Array.isArray(flags) && flags.includes('pain_mode_changed');
  });
  const changedCount = painModeChanged.length;
  const changedRate = total > 0 ? (changedCount / total) * 100 : 0;

  const directionCount = {};
  for (const r of painModeChanged) {
    const sc = r.scores?.shadow_compare || {};
    const key = `${sc.active_pain_mode || '?'} -> ${sc.shadow_pain_mode || '?'}`;
    directionCount[key] = (directionCount[key] || 0) + 1;
  }

  const protectedToCaution = painModeChanged.filter(
    (r) =>
      r.scores?.shadow_compare?.active_pain_mode === 'protected' &&
      r.scores?.shadow_compare?.shadow_pain_mode === 'caution'
  ).length;

  console.log('\n=== PR-ALG-14 Real DB Pain Mode Shadow Report ===\n');
  console.log(`Period: last ${opts.days} days | Limit: ${opts.limit} | Candidate: ${opts.candidate}`);
  console.log(`Data: ${total} rows with shadow_compare\n`);

  console.log('1. 전체 분포');
  console.log(`   total_compared: ${total}`);
  console.log(`   pain_mode_changed: ${changedCount} (${changedRate.toFixed(1)}%)\n`);

  console.log('2. Direction 분포');
  const dirs = Object.entries(directionCount).sort((a, b) => b[1] - a[1]);
  if (dirs.length === 0) {
    console.log('   (없음)');
  } else {
    for (const [dir, cnt] of dirs) {
      console.log(`   ${dir}: ${cnt}건`);
    }
  }
  console.log('');

  console.log('3. 안정성 체크 (protected -> caution)');
  console.log(`   protected_to_caution: ${protectedToCaution}건\n`);

  console.log('4. Sample rows (최근 변화 건)');
  const samples = painModeChanged.slice(0, opts.sample);
  for (const r of samples) {
    const sc = r.scores?.shadow_compare || {};
    console.log(
      `   ${r.id} | ${sc.active_pain_mode} -> ${sc.shadow_pain_mode} | ${(sc.diff_flags || []).join(', ')}`
    );
  }
  if (samples.length === 0) {
    console.log('   (없음)');
  }

  let recommendation = 'keep_active';
  if (protectedToCaution > 0) {
    recommendation = 'recalibrate';
  } else if (changedRate > 30) {
    recommendation = 'monitor_more';
  } else if (changedRate <= 15 && total >= 10) {
    recommendation = 'keep_active';
  }

  console.log('\n5. 권고');
  console.log(`   ${recommendation}\n`);
  console.log('=== End Report ===\n');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
