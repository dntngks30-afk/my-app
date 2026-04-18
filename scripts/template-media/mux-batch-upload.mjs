/**
 * PR-B: Batch upload template videos to Mux from PR-A manifest; emit upload ledger for PR-C.
 * No DB writes. No media_ref. Env: MUX_TOKEN_ID, MUX_TOKEN_SECRET
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MUX_API = 'https://api.mux.com/video/v1';

const EXPECTED_IDS = Array.from({ length: 48 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`);

function parseArgs(argv) {
  const out = {
    manifest: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.json'),
    output: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.mux-upload-result.json'),
    ids: null,
    limit: null,
    force: false,
    pollMs: 2000,
    timeoutMs: 30 * 60 * 1000,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') out.manifest = path.resolve(argv[++i] || '');
    else if (a === '--output') out.output = path.resolve(argv[++i] || '');
    else if (a === '--ids') {
      const raw = argv[++i] || '';
      out.ids = raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    } else if (a === '--limit') {
      const v = parseInt(argv[++i] || '', 10);
      out.limit = Number.isFinite(v) ? Math.max(0, v) : null;
    }
    else if (a === '--force') out.force = true;
    else if (a === '--poll-ms') out.pollMs = Math.max(200, parseInt(argv[++i] || '2000', 10) || 2000);
    else if (a === '--timeout-ms') out.timeoutMs = Math.max(1000, parseInt(argv[++i] || '0', 10) || out.timeoutMs);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/template-media/mux-batch-upload.mjs [options]
 --manifest <path>   default: ops/template-media/template-refresh-2026-04.json
  --output <path>     default: ops/template-media/template-refresh-2026-04.mux-upload-result.json
  --ids M01,M02       process only these ids (canonical M01..M48 order)
  --limit <n>         after --ids filter, take first n of ordered list (or first n of full list)
  --force             re-upload even if ledger row is ready with playback_id
  --poll-ms <ms>      default 2000
  --timeout-ms <ms>   per-row asset ready wait, default 1800000
`);
      process.exit(0);
    }
  }
  return out;
}

function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('Manifest must be a JSON array');
  return rows;
}

function validateManifestStructure(rows) {
  const byId = new Map();
  for (const r of rows) {
    const id = r?.template_id;
    if (!id || typeof id !== 'string') throw new Error('Every row must have template_id string');
    if (byId.has(id)) throw new Error(`Duplicate template_id: ${id}`);
    byId.set(id, r);
  }
  for (const id of EXPECTED_IDS) {
    if (!byId.has(id)) throw new Error(`Missing manifest row for ${id} (need M01–M48)`);
  }
  if (byId.size !== 48) throw new Error(`Expected exactly 48 rows, got ${byId.size}`);
  for (const id of EXPECTED_IDS) {
    const r = byId.get(id);
    if (!String(r.final_name_ko ?? '').trim()) throw new Error(`${id}: final_name_ko must be non-empty`);
    if (!String(r.local_video_path ?? '').trim()) throw new Error(`${id}: local_video_path must be non-empty`);
  }
  return byId;
}

function orderedWorkRows(byId, opts) {
  let list = EXPECTED_IDS.map((id) => byId.get(id));
  if (opts.ids?.length) {
    const set = new Set(opts.ids);
    const unknown = opts.ids.filter((id) => !byId.has(id));
    if (unknown.length) throw new Error(`Unknown template_id in --ids: ${unknown.join(', ')}`);
    list = list.filter((r) => set.has(r.template_id));
  }
  if (opts.limit != null) {
    list = list.slice(0, opts.limit);
  }
  return list;
}

function resolveLocalPath(row) {
  const rel = row.local_video_path.replace(/^\//, '');
  return path.isAbsolute(rel) ? rel : path.join(REPO_ROOT, rel);
}

function muxAuthHeader() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) {
    throw new Error('MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set');
  }
  const token = Buffer.from(`${id}:${secret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function muxFetch(method, urlPath, body) {
  const url = urlPath.startsWith('http') ? urlPath : `${MUX_API}${urlPath}`;
  const headers = { Authorization: muxAuthHeader() };
  if (body != null) headers['Content-Type'] = 'application/json';
  const init = { method, headers };
  if (body != null) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.messages?.join('; ') || json?.error?.message || text || res.statusText;
    throw new Error(`Mux ${method} ${url} -> ${res.status}: ${msg}`);
  }
  return json;
}

async function createDirectUpload(passthrough) {
  const payload = {
    cors_origin: '*',
    new_asset_settings: {
      playback_policies: ['public'],
      passthrough: String(passthrough).slice(0, 255),
    },
  };
  const json = await muxFetch('POST', '/uploads', payload);
  const d = json?.data;
  if (!d?.id || !d?.url) throw new Error('Mux create upload: missing data.id or data.url');
  return { uploadId: d.id, uploadUrl: d.url };
}

async function putFileToUploadUrl(uploadUrl, filePath) {
  const buf = fs.readFileSync(filePath);
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: buf,
    headers: { 'Content-Type': 'video/mp4' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT to Mux upload URL failed ${res.status}: ${t}`);
  }
}

async function getUpload(uploadId) {
  const json = await muxFetch('GET', `/uploads/${uploadId}`);
  return json?.data;
}

async function getAsset(assetId) {
  const json = await muxFetch('GET', `/assets/${assetId}`);
  return json?.data;
}

function pickPublicPlaybackId(asset) {
  const ids = asset?.playback_ids;
  if (!Array.isArray(ids) || !ids.length) return null;
  for (const p of ids) {
    if (typeof p === 'string') return p;
    if (p && typeof p === 'object' && p.policy === 'public' && p.id) return p.id;
  }
  const first = ids[0];
  if (first && typeof first === 'object' && first.id) return first.id;
  return null;
}

async function waitForUploadAssetId(uploadId, pollMs, deadline) {
  while (Date.now() < deadline) {
    const u = await getUpload(uploadId);
    if (u?.status === 'errored' || u?.status === 'timed_out') {
      throw new Error(`Mux upload ${uploadId} status: ${u.status}`);
    }
    if (u?.asset_id) return u.asset_id;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error('Timeout waiting for upload to create asset');
}

async function waitAssetReady(assetId, pollMs, deadline) {
  while (Date.now() < deadline) {
    const a = await getAsset(assetId);
    if (a?.status === 'ready') return a;
    if (a?.status === 'errored') {
      throw new Error(`Mux asset ${assetId} errored`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Timeout waiting for asset ${assetId} ready`);
}

function emptyLedgerRow(row, partial) {
  return {
    template_id: row.template_id,
    final_name_ko: row.final_name_ko,
    local_video_filename: row.local_video_filename ?? '',
    local_video_path: row.local_video_path,
    status: partial.status ?? 'failed',
    mux_asset_id: partial.mux_asset_id ?? null,
    mux_playback_id: partial.mux_playback_id ?? null,
    error_message: partial.error_message ?? null,
    uploaded_at: partial.uploaded_at ?? null,
    file_size_bytes: partial.file_size_bytes ?? null,
    mux_upload_id: partial.mux_upload_id ?? null,
    manifest_name_snapshot: row.final_name_ko,
  };
}

function isSkippableReady(entry, force) {
  if (force) return false;
  return !!(entry?.mux_playback_id && entry?.mux_asset_id);
}

function loadLedger(outputPath) {
  if (!fs.existsSync(outputPath)) return { ledger_version: 1, rows: [] };
  try {
    const j = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (Array.isArray(j)) return { ledger_version: 1, rows: j };
    if (j && Array.isArray(j.rows)) return { ledger_version: j.ledger_version ?? 1, rows: j.rows };
  } catch {
    return { ledger_version: 1, rows: [] };
  }
  return { ledger_version: 1, rows: [] };
}

function mergeLedgerRows(existingRows, updatesById) {
  const map = new Map();
  for (const r of existingRows) {
    if (r?.template_id) map.set(r.template_id, r);
  }
  for (const [id, row] of updatesById) {
    map.set(id, row);
  }
  return EXPECTED_IDS.map((id) => map.get(id)).filter(Boolean);
}

function persistLedger(opts, ledgerRows, updatesById) {
  const merged = mergeLedgerRows(ledgerRows, updatesById);
  atomicWriteJson(opts.output, {
    ledger_version: 1,
    manifest_path: path.relative(REPO_ROOT, opts.manifest),
    output_path: path.relative(REPO_ROOT, opts.output),
    updated_at: new Date().toISOString(),
    rows: merged,
  });
  return merged;
}

function atomicWriteJson(outputPath, obj) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.mux-upload-${process.pid}-${Date.now()}.tmp`);
  const data = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(tmp, data, 'utf8');
  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  } catch {
    /* ignore */
  }
  fs.renameSync(tmp, outputPath);
}

async function processOneRow(row, opts, stats) {
  const localAbs = resolveLocalPath(row);
  if (!fs.existsSync(localAbs)) {
    stats.failed++;
    return emptyLedgerRow(row, {
      status: 'failed',
      error_message: `Local file missing: ${localAbs}`,
    });
  }

  let st;
  try {
    st = fs.statSync(localAbs);
  } catch (e) {
    stats.failed++;
    return emptyLedgerRow(row, {
      status: 'failed',
      error_message: `stat failed: ${e?.message || e}`,
    });
  }

  const deadline = Date.now() + opts.timeoutMs;
  try {
    const { uploadId, uploadUrl } = await createDirectUpload(row.template_id);
    await putFileToUploadUrl(uploadUrl, localAbs);
    const assetId = await waitForUploadAssetId(uploadId, opts.pollMs, deadline);
    const asset = await waitAssetReady(assetId, opts.pollMs, deadline);
    const playbackId = pickPublicPlaybackId(asset);
    if (!playbackId) {
      throw new Error('No public playback_id on asset');
    }
    stats.ready++;
    return emptyLedgerRow(row, {
      status: 'ready',
      mux_asset_id: assetId,
      mux_playback_id: playbackId,
      error_message: null,
      uploaded_at: new Date().toISOString(),
      file_size_bytes: st.size,
      mux_upload_id: uploadId,
      manifest_name_snapshot: row.final_name_ko,
    });
  } catch (e) {
    stats.failed++;
    return emptyLedgerRow(row, {
      status: 'failed',
      error_message: e?.message || String(e),
      file_size_bytes: st.size,
    });
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  let byId;
  try {
    const rows = loadManifest(opts.manifest);
    byId = validateManifestStructure(rows);
  } catch (e) {
    console.error('Manifest validation failed:', e.message || e);
    process.exit(1);
  }

  const work = orderedWorkRows(byId, opts);
  if (!work.length) {
    console.error('No rows to process (check --ids / --limit)');
    process.exit(1);
  }

  try {
    muxAuthHeader();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }

  const ledgerWrap = loadLedger(opts.output);
  const prevById = new Map(ledgerWrap.rows.map((r) => [r.template_id, r]));
  const updatesById = new Map();

  const stats = { ready: 0, failed: 0, skipped: 0 };

  for (const row of work) {
    const prev = prevById.get(row.template_id);
    if (isSkippableReady(prev, opts.force)) {
      stats.skipped++;
      updatesById.set(row.template_id, {
        ...prev,
        status: 'skipped',
        error_message: null,
      });
      ledgerWrap.rows = persistLedger(opts, ledgerWrap.rows, updatesById);
      continue;
    }

    const result = await processOneRow(row, opts, stats);
    updatesById.set(row.template_id, result);
    ledgerWrap.rows = persistLedger(opts, ledgerWrap.rows, updatesById);
  }

  console.log(
    `Mux batch upload done. ready=${stats.ready} failed=${stats.failed} skipped=${stats.skipped} (this run work items=${work.length})`,
  );
  if (stats.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
