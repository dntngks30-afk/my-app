/**
 * PR-LEGACY-DISPLAY-BACKFILL-03 — Idempotent display contract backfill for session_plans.plan_json.meta
 *
 * Uses computeSessionDisplayMetaPatches (resolveSessionDisplayContract family). Does not change generation/scoring/UI.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Load env: npx dotenv-cli -e .env.local -- npm run ops:session-display-backfill -- ...
 *
 * Usage:
 *   npx tsx scripts/session-display-backfill-03.mjs --dry-run
 *   npx tsx scripts/session-display-backfill-03.mjs --dry-run --user-id=<uuid> --limit=20
 *   npx tsx scripts/session-display-backfill-03.mjs --apply --user-id=<uuid> --limit=100
 *   npx tsx scripts/session-display-backfill-03.mjs --apply --allow-all-users --from-session=1 --to-session=20
 *
 * Flags:
 *   --dry-run | --apply     default: --dry-run (no writes). Use --apply to persist.
 *   --user-id=<uuid>        filter to one user (recommended)
 *   --allow-all-users        required if --user-id omitted (full table scan; dangerous)
 *   --limit=<n>             max rows to patch per run (default 200)
 *   --max-scan=<n>          max session_plans rows read (default 20000)
 *   --from-session=<n>      session_number >=
 *   --to-session=<n>        session_number <=
 *   --offset=<n>            pagination start (ordered by session_number asc, then id)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apply: false,
    dryRun: true,
    userId: null,
    allowAllUsers: false,
    limit: 200,
    maxScan: 20000,
    fromSession: null,
    toSession: null,
    offset: 0,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') {
      opts.apply = true;
      opts.dryRun = false;
    } else if (a === '--dry-run') {
      opts.dryRun = true;
      opts.apply = false;
    } else if (a === '--allow-all-users') {
      opts.allowAllUsers = true;
    } else if (a.startsWith('--user-id=')) {
      opts.userId = a.slice('--user-id='.length).trim() || null;
    } else if (a.startsWith('--limit=')) {
      opts.limit = Math.max(1, parseInt(a.slice('--limit='.length), 10) || 200);
    } else if (a.startsWith('--max-scan=')) {
      opts.maxScan = Math.max(1, parseInt(a.slice('--max-scan='.length), 10) || 20000);
    } else if (a.startsWith('--from-session=')) {
      opts.fromSession = Math.max(1, parseInt(a.slice('--from-session='.length), 10) || 1);
    } else if (a.startsWith('--to-session=')) {
      opts.toSession = Math.max(1, parseInt(a.slice('--to-session='.length), 10) || 1);
    } else if (a.startsWith('--offset=')) {
      opts.offset = Math.max(0, parseInt(a.slice('--offset='.length), 10) || 0);
    }
  }
  return opts;
}

async function run() {
  const opts = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.\n');
    process.exit(1);
  }

  if (!opts.userId && !opts.allowAllUsers) {
    console.error(
      'Refusing to scan all users: pass --user-id=<uuid> or explicitly add --allow-all-users (dangerous).\n'
    );
    process.exit(1);
  }

  const {
    computeSessionDisplayMetaPatches,
    needsSessionDisplayBackfill,
    applyDisplayPatchesToPlanJson,
  } = await import('../src/lib/session/session-display-backfill-merge.ts');

  console.log('\n=== session-display-backfill-03 (PR-LEGACY-DISPLAY-BACKFILL-03) ===\n');
  console.log(`mode: ${opts.apply ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`);
  console.log(`limit (max patches): ${opts.limit}, max-scan: ${opts.maxScan}, offset: ${opts.offset}`);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);

  const pageSize = 200;
  let examined = 0;
  let skippedNoMeta = 0;
  let skippedComplete = 0;
  let skippedNoPatch = 0;
  let patched = 0;
  let errors = 0;
  const samples = [];

  let start = opts.offset;

  while (examined < opts.maxScan && patched < opts.limit) {
    let q = supabase
      .from('session_plans')
      .select('id, user_id, session_number, plan_json')
      .order('session_number', { ascending: true })
      .order('id', { ascending: true });

    if (opts.userId) q = q.eq('user_id', opts.userId);
    if (opts.fromSession != null) q = q.gte('session_number', opts.fromSession);
    if (opts.toSession != null) q = q.lte('session_number', opts.toSession);

    const end = start + pageSize - 1;
    const { data: rows, error } = await q.range(start, end);

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }

    if (!rows?.length) break;

    for (const row of rows) {
      if (examined >= opts.maxScan || patched >= opts.limit) break;
      examined++;

      const pj = row.plan_json;
      if (!pj || typeof pj !== 'object' || Array.isArray(pj)) {
        skippedNoMeta++;
        continue;
      }
      const meta = /** @type {Record<string, unknown>} */ (pj).meta;
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
        skippedNoMeta++;
        continue;
      }

      if (!needsSessionDisplayBackfill(meta)) {
        skippedComplete++;
        continue;
      }

      const patches = computeSessionDisplayMetaPatches(
        /** @type {Record<string, unknown>} */ (meta),
        row.session_number
      );
      if (Object.keys(patches).length === 0) {
        skippedNoPatch++;
        continue;
      }

      const nextPlanJson = applyDisplayPatchesToPlanJson(pj, patches);

      if (opts.apply) {
        const { error: upErr } = await supabase.from('session_plans').update({ plan_json: nextPlanJson }).eq('id', row.id);
        if (upErr) {
          console.error(`[fail] id=${row.id} session=${row.session_number} user=${row.user_id}: ${upErr.message}`);
          errors++;
        } else {
          patched++;
          if (samples.length < 5) {
            samples.push({
              id: row.id,
              user_id: row.user_id,
              session_number: row.session_number,
              patches,
            });
          }
        }
      } else {
        patched++;
        if (samples.length < 5) {
          samples.push({
            id: row.id,
            user_id: row.user_id,
            session_number: row.session_number,
            patches,
          });
        }
      }
    }

    if (rows.length < pageSize) break;
    start += pageSize;
  }

  console.log('\n--- summary ---');
  console.log(`examined: ${examined}`);
  console.log(`skipped (no meta object): ${skippedNoMeta}`);
  console.log(`skipped (all 5 display fields already set): ${skippedComplete}`);
  console.log(`skipped (resolver produced no new keys): ${skippedNoPatch}`);
  console.log(`${opts.apply ? 'updated' : 'would update (dry-run)'}: ${patched}`);
  console.log(`errors: ${errors}`);

  if (samples.length) {
    console.log('\n--- sample patch diffs (up to 5) ---');
    for (const s of samples) {
      console.log(JSON.stringify(s, null, 2));
    }
  }

  if (!opts.apply && patched > 0) {
    console.log('\nRe-run with --apply to persist (same filters). Second run should show 0 would-update rows if idempotent.\n');
  }

  process.exit(errors > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
