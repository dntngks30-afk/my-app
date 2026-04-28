/**
 * PR-RESET-DATA-01A — Reset stretch manifest (JSON SSOT) vs CSV mirror parity + catalog parity.
 * Run: npx tsx scripts/reset-media/validate-reset-media-manifest.mjs [--check-files]
 * No DB / Mux / network.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** @type {string[]} */
const RESET_TEMPLATE_IDS = [
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


/** @param {string} line */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** @param {string} text */
function parseCsvTable(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('CSV: empty');
  const header = parseCsvLine(lines[0]);
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const o = {};
    header.forEach((k, idx) => {
      o[k.trim()] = cells[idx] ?? '';
    });
    rows.push(o);
  }
  return { header, rows };
}

/** @param {unknown} a */
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEq(v, b[i]));
  }
  return false;
}

/**
 * @param {Record<string, unknown>} csvRow
 * @returns {Record<string, unknown>}
 */
function normalizeCsvManifestRow(csvRow) {
  const target = JSON.parse(String(csvRow.target_body_parts ?? '[]'));
  const primary = JSON.parse(String(csvRow.primary_regions ?? '[]'));
  return {
    template_id: csvRow.template_id,
    stretch_key: csvRow.stretch_key,
    asset_slug: csvRow.asset_slug,
    name_ko: csvRow.name_ko,
    name_en: csvRow.name_en,
    local_video_path: csvRow.local_video_path,
    duration_sec: Number(csvRow.duration_sec),
    target_body_parts: target,
    primary_regions: primary,
    is_active: String(csvRow.is_active).toLowerCase() === 'true',
    scoring_version: csvRow.scoring_version,
  };
}

/**
 * @param {Record<string, unknown>} jrow
 * @param {Record<string, unknown>} nrow
 */
function assertRowParity(jrow, nrow) {
  const keys = Object.keys(jrow);
  for (const k of keys) {
    const a = jrow[k];
    const b = nrow[k];
    if (Array.isArray(a) && Array.isArray(b)) {
      if (!deepEq(a, b)) throw new Error(`Parity mismatch on ${k}: JSON vs CSV`);
    } else if (a !== b) {
      throw new Error(`Parity mismatch on ${k}: JSON vs CSV`);
    }
  }
}

/** @param {string} id */
function validateTemplateIdShape(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error(`Invalid template_id`);
  if (/^M\d{2}(?:_|$|$)/i.test(id)) throw new Error(`M-prefixed template_id forbidden: ${id}`);
  // R01..R10_... (R09 and R10 patterns per plan)
  if (!/^R(0[1-9]|10)_[A-Z0-9_]+$/.test(id)) {
    throw new Error(`template_id must match R01_..R10_ UPPER snake: ${id}`);
  }
}

/**
 * @param {readonly { stretch_key: string; name_ko: string; name_en: string; asset_slug: string; duration_sec: number }[]} catalog
 * @param {Record<string, unknown>[]} jsonRows
 */
function validateAgainstCatalog(catalog, jsonRows) {
  const ck = new Set(catalog.map((c) => c.stretch_key));
  const mj = new Set(jsonRows.map((r) => r.stretch_key));
  for (const k of ck) if (!mj.has(k)) throw new Error(`stretch_key missing in manifest: ${k}`);
  for (const k of mj) if (!ck.has(k)) throw new Error(`stretch_key in manifest missing from RESET_STRETCH_CATALOG: ${k}`);
  const byStretch = Object.fromEntries(catalog.map((c) => [c.stretch_key, c]));
  for (const r of jsonRows) {
    const sk = /** @type {string} */ (r.stretch_key);
    const c = byStretch[sk];
    if (!c) throw new Error(`No catalog entry: ${sk}`);
    if (r.name_ko !== c.name_ko) throw new Error(`${sk}: name_ko mismatch catalog`);
    if (r.name_en !== c.name_en) throw new Error(`${sk}: name_en mismatch catalog`);
    if (r.asset_slug !== c.asset_slug) throw new Error(`${sk}: asset_slug mismatch catalog`);
    if (r.duration_sec !== c.duration_sec) throw new Error(`${sk}: duration_sec mismatch catalog`);
  }
}

/**
 * @param {Record<string, unknown>[]} jsonRows
 */
function assertNoMuxFields(jsonRows) {
  const forbid = ['mux_asset_id', 'mux_playback_id', 'media_ref'];
  for (const r of jsonRows) {
    for (const f of forbid) if (Object.prototype.hasOwnProperty.call(r, f)) throw new Error(`Manifest must not contain field: ${f}`);
  }
}

async function loadCatalog() {
  const catalogPath = path.join(REPO_ROOT, 'src/lib/reset/reset-stretch-catalog.ts');
  const mod = await import(pathToFileURL(catalogPath).href);
  const cat = mod.RESET_STRETCH_CATALOG;
  if (!Array.isArray(cat)) throw new Error('RESET_STRETCH_CATALOG not ARRAY');
  return cat;
}

async function main() {
  const checkFiles = process.argv.includes('--check-files');

  const jsonPath = path.join(REPO_ROOT, 'ops/reset-media/reset-stretches-2026-04.json');
  const csvPath = path.join(REPO_ROOT, 'ops/reset-media/reset-stretches-2026-04.csv');

  /** @type {Record<string, unknown>[]} */
  const jsonRows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(jsonRows)) throw new Error('JSON SSOT must be a JSON array');

  if (jsonRows.length !== 10) throw new Error(`JSON rows expected 10, got ${jsonRows.length}`);

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const { rows: csvRowsRaw } = parseCsvTable(csvText);
  if (csvRowsRaw.length !== 10) throw new Error(`CSV rows expected 10, got ${csvRowsRaw.length}`);

  const uniq = (vals, label) => {
    const s = new Set(vals);
    if (s.size !== vals.length) throw new Error(`${label} not unique`);
  };

  uniq(
    jsonRows.map((r) => r.template_id),
    'template_id',
  );
  uniq(
    jsonRows.map((r) => r.stretch_key),
    'stretch_key',
  );
  uniq(
    jsonRows.map((r) => r.asset_slug),
    'asset_slug',
  );
  uniq(
    jsonRows.map((r) => r.local_video_path),
    'local_video_path',
  );

  /** @type {Record<string, unknown>} */
  const byId = {};
  for (const r of jsonRows) {
    byId[String(r.template_id)] = r;
  }
  if (Object.keys(byId).length !== 10) throw new Error('template_id collisions');

  for (const id of RESET_TEMPLATE_IDS) {
    if (!byId[id]) throw new Error(`Manifest missing canonical row ${id}`);
  }

  /** @type {Record<string, unknown>[]} */
  const csvObjs = csvRowsRaw.map((r) => normalizeCsvManifestRow(r));
  /** @type {Map<string, Record<string,unknown>> } */
  const csvByTpl = new Map(csvObjs.map((r) => [String(r.template_id), r]));

  for (const jrow of jsonRows) {
    const nid = csvByTpl.get(String(jrow.template_id));
    if (!nid) throw new Error(`CSV missing template_id ${jrow.template_id}`);
    assertRowParity(jrow, nid);
  }

  assertNoMuxFields(jsonRows);

  for (const r of jsonRows) {
    const tid = /** @type {string} */ (r.template_id);
    validateTemplateIdShape(tid);

    const p = /** @type {string} */ (r.local_video_path);
    if (!p.startsWith('videos/reset/')) throw new Error(`${tid}: local_video_path must start with videos/reset/`);
    if (!p.endsWith('.mp4')) throw new Error(`${tid}: local_video_path must end with .mp4`);
    const parts = /^R(0[1-9]|10)_/.exec(tid);
    if (!parts) throw new Error(`${tid}: R01–R10 prefix required`);
    if (!p.includes(tid)) throw new Error(`${tid}: local_video_path basename must embed template_id: ${p}`);

  }

  const catalog = await loadCatalog();
  validateAgainstCatalog(catalog, jsonRows);

  if (checkFiles) {
    for (const r of jsonRows) {
      const rel = /** @type {string} */ (r.local_video_path).replace(/^\//, '');
      const abs = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(abs)) throw new Error(`--check-files: missing ${abs}`);
      if (!rel.toLowerCase().endsWith('.mp4')) throw new Error(`--check-files: not .mp4: ${rel}`);
    }
  }

  console.log(`reset-media manifest OK: JSON=10 CSV=10 catalog parity${checkFiles ? ' + local files OK' : ''}`);
}

main().catch((e) => {
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
