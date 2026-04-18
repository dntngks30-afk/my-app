/**
 * PR-D: Plan and optionally delete legacy Mux assets (never keep-set).
 * Default dry-run. Env: MUX_TOKEN_ID, MUX_TOKEN_SECRET. No DB / no attach.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MUX_API = 'https://api.mux.com/video/v1';
const EXPECTED_IDS = Array.from({ length: 48 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`);
const DEFAULT_ALLOWLIST = path.join(
  REPO_ROOT,
  'ops',
  'template-media',
  'template-refresh-2026-04.legacy-delete-allowlist.json',
);

function parseArgs(argv) {
  const out = {
    manifest: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.json'),
    ledger: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.mux-upload-result.json'),
    attachVerify: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.attach-verify.json'),
    allowlist: null,
    planOutput: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.legacy-delete-plan.json'),
    resultOutput: path.join(REPO_ROOT, 'ops', 'template-media', 'template-refresh-2026-04.legacy-delete-result.json'),
    apply: false,
    assetIds: null,
    limit: null,
  };
  let explicitDry = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') out.manifest = path.resolve(argv[++i] || '');
    else if (a === '--ledger') out.ledger = path.resolve(argv[++i] || '');
    else if (a === '--attach-verify') out.attachVerify = path.resolve(argv[++i] || '');
    else if (a === '--allowlist') out.allowlist = path.resolve(argv[++i] || '');
    else if (a === '--plan-output') out.planOutput = path.resolve(argv[++i] || '');
    else if (a === '--result-output') out.resultOutput = path.resolve(argv[++i] || '');
    else if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') explicitDry = true;
    else if (a === '--asset-ids') {
      const raw = argv[++i] || '';
      out.assetIds = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--limit') {
      const v = parseInt(argv[++i] || '', 10);
      out.limit = Number.isFinite(v) ? Math.max(0, v) : null;
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/template-media/delete-legacy-template-assets.mjs [options]

Default: dry-run (no Mux DELETE). Use --apply to delete.

  --manifest <path>
  --ledger <path>
  --attach-verify <path>
  --allowlist <path>     optional; also reads default allowlist path if file exists and this omitted
  --plan-output <path>
  --result-output <path>
  --asset-ids id1,id2    subset of candidates to delete (apply only)
  --limit <n>            first n candidates after --asset-ids filter
  --dry-run              explicit (default when no --apply)
  --apply                perform DELETE on selected candidates
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

function atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.legacy-del-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
  fs.renameSync(tmp, filePath);
}

function ledgerRows(ledger) {
  if (Array.isArray(ledger)) return ledger;
  if (ledger && Array.isArray(ledger.rows)) return ledger.rows;
  throw new Error('Ledger must be array or { rows: [] }');
}

function byTemplateId(rows, label) {
  const m = new Map();
  for (const r of rows) {
    const id = r?.template_id;
    if (!id || typeof id !== 'string') throw new Error(`${label}: missing template_id`);
    if (m.has(id)) throw new Error(`${label}: duplicate ${id}`);
    m.set(id, r);
  }
  return m;
}

function validateLedgerFull(lBy) {
  for (const id of EXPECTED_IDS) {
    if (!lBy.has(id)) throw new Error(`ledger: missing ${id}`);
    const L = lBy.get(id);
    if (String(L.status || '').toLowerCase() === 'failed') throw new Error(`ledger ${id}: failed`);
    const aid = L.mux_asset_id;
    const pid = L.mux_playback_id;
    if (!aid || typeof aid !== 'string' || !aid.trim()) throw new Error(`ledger ${id}: mux_asset_id missing`);
    if (!pid || typeof pid !== 'string' || !pid.trim()) throw new Error(`ledger ${id}: mux_playback_id missing`);
  }
  if (lBy.size !== 48) throw new Error(`ledger: expected 48 rows, got ${lBy.size}`);
}

function validateManifestFull(manifestArr) {
  const mBy = byTemplateId(manifestArr, 'manifest');
  for (const id of EXPECTED_IDS) {
    if (!mBy.has(id)) throw new Error(`manifest: missing ${id}`);
  }
  if (mBy.size !== 48) throw new Error(`manifest: expected 48 rows`);
  return mBy;
}

function verifyRows(attach) {
  const rows = attach?.rows;
  if (!Array.isArray(rows)) throw new Error('attach-verify: missing rows array');
  return rows;
}

function playbackFromAfterRef(ref) {
  if (ref == null) return null;
  if (typeof ref === 'string') {
    try {
      return JSON.parse(ref)?.playback_id ?? null;
    } catch {
      return null;
    }
  }
  const id = ref.playback_id ?? ref.playbackId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function validateAttachVerify(attach, lBy) {
  const rows = verifyRows(attach);
  const vBy = new Map();
  for (const r of rows) {
    const id = r?.template_id;
    if (!id) throw new Error('attach-verify: row missing template_id');
    if (vBy.has(id)) throw new Error(`attach-verify: duplicate ${id}`);
    vBy.set(id, r);
  }
  for (const id of EXPECTED_IDS) {
    if (!vBy.has(id)) throw new Error(`attach-verify: missing ${id}`);
    const v = vBy.get(id);
    const st = String(v.status || '').toLowerCase();
    if (st !== 'updated' && st !== 'unchanged') {
      throw new Error(`attach-verify ${id}: status must be updated or unchanged, got ${v.status}`);
    }
    const pb = playbackFromAfterRef(v.after_media_ref);
    if (!pb) throw new Error(`attach-verify ${id}: after_media_ref.playback_id missing`);
    const expected = String(lBy.get(id).mux_playback_id).trim();
    if (pb !== expected) {
      throw new Error(`attach-verify ${id}: playback ${pb} !== ledger ${expected}`);
    }
  }
  if (vBy.size !== 48) throw new Error(`attach-verify: expected 48 rows, got ${vBy.size}`);
}

function buildKeepSets(lBy, attach) {
  const keepAssetIds = new Set();
  const keepPlaybackIds = new Set();
  for (const id of EXPECTED_IDS) {
    keepAssetIds.add(String(lBy.get(id).mux_asset_id).trim());
    keepPlaybackIds.add(String(lBy.get(id).mux_playback_id).trim());
  }
  for (const r of verifyRows(attach)) {
    const pb = playbackFromAfterRef(r.after_media_ref);
    if (pb) keepPlaybackIds.add(pb);
  }
  return { keepAssetIds, keepPlaybackIds };
}

function loadAllowlist(opts) {
  const pathToUse = opts.allowlist ?? (fs.existsSync(DEFAULT_ALLOWLIST) ? DEFAULT_ALLOWLIST : null);
  if (!pathToUse) return { ids: new Set(), path: null, warnings: [] };
  if (!fs.existsSync(pathToUse)) {
    if (opts.allowlist) throw new Error(`allowlist not found: ${pathToUse}`);
    return { ids: new Set(), path: null, warnings: [] };
  }
  let j;
  try {
    j = readJson(pathToUse);
  } catch (e) {
    throw new Error(`allowlist JSON invalid: ${e.message}`);
  }
  const raw = j?.asset_ids;
  if (!Array.isArray(raw)) throw new Error('allowlist: asset_ids must be an array');
  const ids = new Set();
  const warnings = [];
  for (const x of raw) {
    if (typeof x !== 'string' || !x.trim()) {
      warnings.push('allowlist: skipped non-string entry');
      continue;
    }
    ids.add(x.trim());
  }
  return { ids, path: pathToUse, warnings };
}

function muxAuthHeader() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error('MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set');
  return `Basic ${Buffer.from(`${id}:${secret}`, 'utf8').toString('base64')}`;
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
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { _raw: text };
    }
  }
  if (!res.ok) {
    const msg = json?.error?.messages?.join('; ') || json?.error?.message || text || res.statusText;
    throw new Error(`Mux ${method} ${url} -> ${res.status}: ${msg}`);
  }
  return json ?? {};
}

function extractPlaybackIds(asset) {
  const list = asset?.playback_ids ?? [];
  return list
    .map((p) => (typeof p === 'string' ? p : p?.id))
    .filter((x) => typeof x === 'string' && x.trim());
}

function parsePassthroughTemplate(p) {
  if (p == null) return null;
  const s = String(p).trim().toUpperCase();
  return EXPECTED_IDS.includes(s) ? s : null;
}

function mergeUniqueById(existing, batch) {
  const seen = new Set(existing.map((a) => a.id));
  const add = [];
  for (const a of batch) {
    if (a?.id && !seen.has(a.id)) {
      seen.add(a.id);
      add.push(a);
    }
  }
  return add;
}

async function listAllAssets() {
  const all = [];
  let cursor = null;
  const limit = 100;
  for (let iterations = 0; iterations < 5000; iterations++) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const json = await muxFetch('GET', `/assets?${params.toString()}`);
    const batch = json?.data ?? [];
    all.push(...batch);
    const next =
      json?.meta?.next_cursor ?? json?.meta?.nextCursor ?? json?.next_cursor ?? json?.pagination?.next_cursor;
    if (!batch.length) break;
    if (batch.length < limit) break;
    if (next) {
      cursor = next;
      continue;
    }
    break;
  }
  if (all.length > 0 && all.length % limit === 0) {
    let offsetTry = all.length;
    for (let step = 0; step < 5000; step++) {
      let json;
      try {
        json = await muxFetch('GET', `/assets?limit=${limit}&offset=${offsetTry}`);
      } catch {
        break;
      }
      const batch = json?.data ?? [];
      const add = mergeUniqueById(all, batch);
      if (!add.length) break;
      all.push(...add);
      if (batch.length < limit) break;
      offsetTry = all.length;
    }
  }
  return all;
}

function classifyAsset(asset, keepAssetIds, keepPlaybackIds, allowlistIds) {
  const assetId = asset?.id;
  const passthrough = asset?.passthrough ?? null;
  const playbackIds = extractPlaybackIds(asset);
  const inKeepAsset = keepAssetIds.has(assetId);
  const inKeepPlayback = playbackIds.some((pid) => keepPlaybackIds.has(pid));
  const matchedTemplateId = parsePassthroughTemplate(passthrough);
  const allowlistMatched = allowlistIds.has(assetId);

  if (inKeepAsset || inKeepPlayback) {
    return {
      asset_id: assetId,
      status: 'kept',
      reason: inKeepAsset ? 'asset_id in keep-set' : 'playback_id intersects keep-set',
      passthrough,
      playback_ids: playbackIds,
      in_keep_asset_set: inKeepAsset,
      in_keep_playback_set: inKeepPlayback,
      matched_template_id: matchedTemplateId,
      allowlist_matched: allowlistMatched,
    };
  }

  if (matchedTemplateId || allowlistMatched) {
    const reason = allowlistMatched
      ? matchedTemplateId
        ? `template passthrough ${matchedTemplateId} + allowlist`
        : 'allowlist only'
      : `template passthrough ${matchedTemplateId}`;
    return {
      asset_id: assetId,
      status: 'candidate',
      reason,
      passthrough,
      playback_ids: playbackIds,
      in_keep_asset_set: false,
      in_keep_playback_set: false,
      matched_template_id: matchedTemplateId,
      allowlist_matched: allowlistMatched,
    };
  }

  return {
    asset_id: assetId,
    status: 'excluded',
    reason: 'not in keep-set; no M01-M48 passthrough; not allowlisted',
    passthrough,
    playback_ids: playbackIds,
    in_keep_asset_set: false,
    in_keep_playback_set: false,
    matched_template_id: null,
    allowlist_matched: false,
  };
}

function assertNoKeepInCandidates(planRows, keepAssetIds, keepPlaybackIds) {
  for (const r of planRows) {
    if (r.status !== 'candidate') continue;
    if (keepAssetIds.has(r.asset_id)) throw new Error(`safety: candidate ${r.asset_id} is in keep asset set`);
    if (r.playback_ids?.some((p) => keepPlaybackIds.has(p))) {
      throw new Error(`safety: candidate ${r.asset_id} overlaps keep playback`);
    }
  }
}

function selectDeleteTargets(planRows, opts) {
  let candidates = planRows.filter((r) => r.status === 'candidate');
  candidates.sort((a, b) => a.asset_id.localeCompare(b.asset_id));
  if (opts.assetIds?.length) {
    const want = new Set(opts.assetIds);
    candidates = candidates.filter((c) => want.has(c.asset_id));
  }
  if (opts.limit != null) {
    candidates = candidates.slice(0, opts.limit);
  }
  return candidates;
}

async function muxDeleteAsset(assetId) {
  const url = `${MUX_API}/assets/${encodeURIComponent(assetId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: muxAuthHeader() },
  });
  const text = await res.text();
  if (res.status === 204 || res.status === 200) {
    return { ok: true, notFound: false };
  }
  if (res.status === 404) {
    return { ok: true, notFound: true };
  }
  let msg = text;
  try {
    const j = JSON.parse(text);
    msg = j?.error?.messages?.join('; ') || j?.error?.message || text;
  } catch {
    /* ignore */
  }
  return { ok: false, notFound: false, error: `${res.status}: ${msg}` };
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const opts = parseArgs(process.argv);
  const runMode = opts.apply ? 'apply' : 'dry-run';

  const manifestArr = readJson(opts.manifest);
  validateManifestFull(manifestArr);
  const ledgerArr = ledgerRows(readJson(opts.ledger));
  const lBy = byTemplateId(ledgerArr, 'ledger');
  validateLedgerFull(lBy);
  const attach = readJson(opts.attachVerify);
  validateAttachVerify(attach, lBy);

  const allow = loadAllowlist(opts);
  for (const w of allow.warnings) console.warn(w);

  const { keepAssetIds, keepPlaybackIds } = buildKeepSets(lBy, attach);

  for (const aid of allow.ids) {
    if (keepAssetIds.has(aid)) {
      console.warn(`allowlist: ${aid} is in keep-set; will not delete`);
    }
  }

  let assets;
  try {
    muxAuthHeader();
    assets = await listAllAssets();
  } catch (e) {
    console.error('Mux list failed:', e.message || e);
    process.exit(1);
  }

  const planRows = assets.map((a) => classifyAsset(a, keepAssetIds, keepPlaybackIds, allow.ids));
  try {
    assertNoKeepInCandidates(planRows, keepAssetIds, keepPlaybackIds);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }

  const planDoc = {
    plan_version: 1,
    run_mode: runMode,
    generated_at: nowIso(),
    manifest_path: path.relative(REPO_ROOT, opts.manifest),
    ledger_path: path.relative(REPO_ROOT, opts.ledger),
    attach_verify_path: path.relative(REPO_ROOT, opts.attachVerify),
    allowlist_path: allow.path ? path.relative(REPO_ROOT, allow.path) : null,
    mux_assets_listed: assets.length,
    keep_asset_count: keepAssetIds.size,
    keep_playback_count: keepPlaybackIds.size,
    summary: {
      candidate: planRows.filter((r) => r.status === 'candidate').length,
      kept: planRows.filter((r) => r.status === 'kept').length,
      excluded: planRows.filter((r) => r.status === 'excluded').length,
    },
    rows: planRows,
  };
  atomicWriteJson(opts.planOutput, planDoc);
  console.log(
    `Plan written: ${opts.planOutput} (listed=${assets.length} candidate=${planDoc.summary.candidate} kept=${planDoc.summary.kept} excluded=${planDoc.summary.excluded})`,
  );

  const resultRows = [];
  const counts = { deleted: 0, failed: 0, skipped: 0 };

  if (!opts.apply) {
    atomicWriteJson(opts.resultOutput, {
      result_version: 1,
      run_mode: 'dry-run',
      generated_at: nowIso(),
      note: 'No deletes performed (dry-run).',
      rows: [],
      summary: counts,
    });
    console.log(`Dry-run: no deletes. Empty result stub: ${opts.resultOutput}`);
    return;
  }

  const targets = selectDeleteTargets(planRows, opts);
  const targetSet = new Set(targets.map((t) => t.asset_id));

  if (opts.assetIds?.length) {
    for (const aid of opts.assetIds) {
      if (targetSet.has(aid)) continue;
      const pr = planRows.find((p) => p.asset_id === aid);
      if (!pr) {
        resultRows.push({
          asset_id: aid,
          status: 'skipped',
          reason: 'not found in Mux asset list',
          deleted_at: null,
          error_message: null,
        });
        counts.skipped++;
      } else if (pr.status !== 'candidate') {
        resultRows.push({
          asset_id: aid,
          status: 'skipped',
          reason: `plan status is ${pr.status}, not candidate`,
          deleted_at: null,
          error_message: null,
        });
        counts.skipped++;
      }
    }
  }

  for (const t of targets) {
    const del = await muxDeleteAsset(t.asset_id);
    if (del.ok) {
      resultRows.push({
        asset_id: t.asset_id,
        status: del.notFound ? 'skipped' : 'deleted',
        reason: del.notFound ? 'already deleted (404)' : 'mux delete succeeded',
        deleted_at: nowIso(),
        error_message: null,
      });
      if (del.notFound) counts.skipped++;
      else counts.deleted++;
    } else {
      resultRows.push({
        asset_id: t.asset_id,
        status: 'failed',
        reason: 'mux delete failed',
        deleted_at: null,
        error_message: del.error || 'unknown',
      });
      counts.failed++;
    }
  }

  atomicWriteJson(opts.resultOutput, {
    result_version: 1,
    run_mode: 'apply',
    generated_at: nowIso(),
    plan_output: path.relative(REPO_ROOT, opts.planOutput),
    targets_requested: targets.length,
    rows: resultRows,
    summary: counts,
  });

  console.log(`Apply done: deleted=${counts.deleted} failed=${counts.failed} skipped=${counts.skipped}`);
  console.log(`Result: ${opts.resultOutput}`);
  if (counts.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
