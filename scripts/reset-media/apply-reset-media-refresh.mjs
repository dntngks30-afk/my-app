/**
 * PR-RESET-DATA-02: Attach reset-tab Mux ledger playback_ids to exercise_templates.media_ref (R01–R10 template_id only).
 * Default: dry-run. Use --apply for DB writes. Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run **after** ledger human review (Mux upload result). Do not bypass template-media (M01–M48) pipeline.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const EXPECTED_RESET_IDS = [
  'R01_STERNOCLEIDOMASTOID_STRETCH',
  'R02_QUADRICEPS_STRETCH',
  'R03_HAMSTRING_STRETCH',
  'R04_SEATED_PIRIFORMIS_STRETCH',
  'R05_GLUTEUS_MAXIMUS_STRETCH',
  'R06_SUPINE_PIRIFORMIS_STRETCH',
  'R07_CAT_COW_SPINE_STRETCH',
  'R08_FOAM_ROLLER_LAT_STRETCH',
  'R09_LONGITUDINAL_FOAM_ROLLER_CHEST_OPENER',
  'R10_LEVATOR_SCAPULAE_UPPER_TRAP_STRETCH',
];

function manifestDisplayName(m) {
  return String(m.final_name_ko ?? m.name_ko ?? '').trim();
}

function parseArgs(argv) {
  const out = {
    manifest: path.join(REPO_ROOT, 'ops', 'reset-media', 'reset-stretches-2026-04.json'),
    ledger: path.join(REPO_ROOT, 'ops', 'reset-media', 'reset-stretches-2026-04.mux-upload-result.json'),
    verifyOutput: path.join(REPO_ROOT, 'ops', 'reset-media', 'reset-stretches-2026-04.attach-verify.json'),
    ids: null,
    limit: null,
    apply: false,
    force: false,
  };
  let explicitDry = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') out.manifest = path.resolve(argv[++i] || '');
    else if (a === '--ledger') out.ledger = path.resolve(argv[++i] || '');
    else if (a === '--verify-output') out.verifyOutput = path.resolve(argv[++i] || '');
    else if (a === '--ids') {
      const raw = argv[++i] || '';
      out.ids = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--limit') {
      const v = parseInt(argv[++i] || '', 10);
      out.limit = Number.isFinite(v) ? Math.max(0, v) : null;
    } else if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') explicitDry = true;
    else if (a === '--force') out.force = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/reset-media/apply-reset-media-refresh.mjs [options]

Defaults: dry-run (no DB write). Use --apply to write reset stretch template rows already present in exercise_templates.

  --manifest <path>       reset manifest JSON (R01–R10)
  --ledger <path>        mux-reset-upload-result JSON
  --verify-output <path> attach verify report (atomic write)
  --ids R01_...,R02_...  subset (canonical order), full template_id
  --limit <n>
  --dry-run / --apply
  --force
`);
      process.exit(0);
    }
  }
  if (explicitDry && out.apply) {
    console.error('Use either --apply or --dry-run, not both.');
    process.exit(1);
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ledgerRows(ledger) {
  if (Array.isArray(ledger)) return ledger;
  if (ledger && Array.isArray(ledger.rows)) return ledger.rows;
  throw new Error('Ledger must be a JSON array or { rows: [] }');
}

function manifestRows(manifest) {
  if (!Array.isArray(manifest)) throw new Error('Manifest must be a JSON array');
  return manifest;
}

function byTemplateId(rows, label) {
  const m = new Map();
  for (const r of rows) {
    const id = r?.template_id;
    if (!id || typeof id !== 'string') throw new Error(`${label}: row missing template_id`);
    if (m.has(id)) throw new Error(`${label}: duplicate template_id ${id}`);
    m.set(id, r);
  }
  return m;
}

function validateManifestAndLedger(manifestArr, ledgerArr) {
  const mBy = byTemplateId(manifestArr, 'manifest');
  const lBy = byTemplateId(ledgerArr, 'ledger');
  for (const id of EXPECTED_RESET_IDS) {
    if (!mBy.has(id)) throw new Error(`manifest: missing ${id}`);
    if (!lBy.has(id)) throw new Error(`ledger: missing ${id}`);
  }
  if (mBy.size !== 10) throw new Error(`manifest: expected 10 rows, got ${mBy.size}`);
  if (lBy.size !== 10) throw new Error(`ledger: expected 10 rows, got ${lBy.size}`);

  const playbackSeen = new Map();
  for (const id of EXPECTED_RESET_IDS) {
    const L = lBy.get(id);
    const M = mBy.get(id);
    const st = String(L.status || '').toLowerCase();
    if (st === 'failed') throw new Error(`ledger ${id}: status is failed`);
    const pid = L.mux_playback_id;
    if (!pid || typeof pid !== 'string' || !pid.trim()) {
      throw new Error(`ledger ${id}: mux_playback_id missing`);
    }
    if (playbackSeen.has(pid)) {
      throw new Error(`duplicate mux_playback_id ${pid} on ${playbackSeen.get(pid)} and ${id}`);
    }
    playbackSeen.set(pid, id);

    const snap = String(L.manifest_name_snapshot ?? '').trim();
    const fn = manifestDisplayName(M);
    if (snap !== fn) {
      throw new Error(
        `name mismatch ${id}: manifest name=${JSON.stringify(fn)} vs ledger manifest_name_snapshot=${JSON.stringify(snap)}`,
      );
    }
  }
}

function orderedWorkIds(opts) {
  let ids = [...EXPECTED_RESET_IDS];
  if (opts.ids?.length) {
    const set = new Set(opts.ids);
    const unknown = opts.ids.filter((id) => !EXPECTED_RESET_IDS.includes(id));
    if (unknown.length) throw new Error(`Unknown --ids: ${unknown.join(', ')}`);
    ids = EXPECTED_RESET_IDS.filter((id) => set.has(id));
  }
  if (opts.limit != null) {
    ids = ids.slice(0, opts.limit);
  }
  return ids;
}

function normalizeMediaRef(raw) {
  if (raw == null) return null;
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return { _invalid: true, raw };
    }
  }
  if (typeof o !== 'object' || !o) return null;
  const provider = o.provider;
  const playback_id = o.playback_id ?? o.playbackId;
  if (provider !== 'mux' || !playback_id || typeof playback_id !== 'string') {
    return { _invalid: true, parsed: o };
  }
  return { provider: 'mux', playback_id };
}

function mediaRefMatchesExpected(norm, expectedPlaybackId) {
  if (!norm || norm._invalid) return false;
  return norm.provider === 'mux' && norm.playback_id === expectedPlaybackId;
}

function expectedMediaRef(playbackId) {
  return { provider: 'mux', playback_id: playbackId };
}

function atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.attach-reset-verify-${process.pid}-${Date.now()}.tmp`);
  const data = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(tmp, data, 'utf8');
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
  fs.renameSync(tmp, filePath);
}

async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

async function fetchTemplateRow(supabase, templateId) {
  const { data, error } = await supabase
    .from('exercise_templates')
    .select('id, name, media_ref')
    .eq('id', templateId)
    .maybeSingle();
  if (error) throw new Error(`${templateId}: select failed: ${error.message}`);
  return data;
}

async function updateMediaRef(supabase, templateId, mediaRef) {
  const { data, error } = await supabase
    .from('exercise_templates')
    .update({ media_ref: mediaRef })
    .eq('id', templateId)
    .select('id, media_ref')
    .maybeSingle();
  if (error) throw new Error(`${templateId}: update failed: ${error.message}`);
  return data;
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const opts = parseArgs(process.argv);
  const runMode = opts.apply ? 'apply' : 'dry-run';

  const manifestArr = manifestRows(readJson(opts.manifest));
  const ledgerWhole = readJson(opts.ledger);
  const ledgerArr = ledgerRows(ledgerWhole);

  try {
    validateManifestAndLedger(manifestArr, ledgerArr);
  } catch (e) {
    console.error('Input validation failed:', e.message || e);
    process.exit(1);
  }

  const mBy = byTemplateId(manifestArr, 'manifest');
  const lBy = byTemplateId(ledgerArr, 'ledger');
  let workIds;
  try {
    workIds = orderedWorkIds(opts);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }

  if (!workIds.length) {
    console.error('No template_ids in work set (check --ids / --limit)');
    process.exit(1);
  }

  let supabase;
  try {
    supabase = await getSupabase();
  } catch (e) {
    console.error('DB:', e.message || e);
    process.exit(1);
  }

  const counts = { updated: 0, unchanged: 0, failed: 0, skipped: 0 };
  const verifyRows = [];

  for (const templateId of workIds) {
    const manifestRow = mBy.get(templateId);
    const ledgerRow = lBy.get(templateId);
    const expectedPlaybackId = ledgerRow.mux_playback_id.trim();
    const expectedRef = expectedMediaRef(expectedPlaybackId);
    const verifiedAt = nowIso();

    let before = null;
    let after = null;
    let status = 'failed';
    let errMsg = null;
    let dbName = null;

    try {
      const dbRow = await fetchTemplateRow(supabase, templateId);
      if (!dbRow) {
        throw new Error('exercise_templates row not found — apply migration 20260429140000_* or insert R-rows first');
      }
      dbName = dbRow.name ?? null;
      before = dbRow.media_ref ?? null;
      const normBefore = normalizeMediaRef(before);
      const already = mediaRefMatchesExpected(normBefore, expectedPlaybackId);

      if (runMode === 'dry-run') {
        if (already) {
          after = normBefore && !normBefore._invalid ? { ...normBefore } : before;
          status = 'unchanged';
          counts.unchanged++;
        } else {
          after = { ...expectedRef };
          status = 'skipped';
          counts.skipped++;
        }
      } else if (already && !opts.force) {
        after = normBefore && !normBefore._invalid ? { ...normBefore } : before;
        status = 'unchanged';
        counts.unchanged++;
      } else {
        const updated = await updateMediaRef(supabase, templateId, expectedRef);
        if (!updated) throw new Error('update returned no row');
        const again = await fetchTemplateRow(supabase, templateId);
        after = again?.media_ref ?? null;
        const normAfter = normalizeMediaRef(after);
        if (!mediaRefMatchesExpected(normAfter, expectedPlaybackId)) {
          throw new Error(`verify mismatch after update: got ${JSON.stringify(after)}`);
        }
        status = 'updated';
        counts.updated++;
      }
    } catch (e) {
      errMsg = e?.message || String(e);
      status = 'failed';
      counts.failed++;
      after = after ?? null;
      if (dbName == null) {
        try {
          const r = await fetchTemplateRow(supabase, templateId);
          dbName = r?.name ?? null;
        } catch {
          /* ignore */
        }
      }
    }

    verifyRows.push({
      template_id: templateId,
      expected_playback_id: expectedPlaybackId,
      before_media_ref: before,
      after_media_ref: after,
      status,
      error_message: errMsg,
      verified_at: verifiedAt,
      expected_name: manifestDisplayName(manifestRow),
      db_name: dbName,
      manifest_name_snapshot: ledgerRow.manifest_name_snapshot ?? manifestDisplayName(manifestRow),
    });
  }

  const report = {
    verify_version: 1,
    attach_kind: 'reset_tab_stretch_mux_v1',
    run_mode: runMode,
    force: opts.force,
    manifest_path: path.relative(REPO_ROOT, opts.manifest),
    ledger_path: path.relative(REPO_ROOT, opts.ledger),
    verify_output: path.relative(REPO_ROOT, opts.verifyOutput),
    updated_at: nowIso(),
    summary: {
      updated: counts.updated,
      unchanged: counts.unchanged,
      failed: counts.failed,
      skipped: counts.skipped,
      work_count: workIds.length,
    },
    rows: verifyRows,
  };

  atomicWriteJson(opts.verifyOutput, report);

  console.log(
    `Reset media_ref ${runMode}: updated=${counts.updated} unchanged=${counts.unchanged} failed=${counts.failed} skipped=${counts.skipped} (work=${workIds.length})`,
  );
  console.log(`Verify report: ${opts.verifyOutput}`);

  if (counts.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
