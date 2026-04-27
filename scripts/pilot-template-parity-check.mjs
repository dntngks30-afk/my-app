/**
 * PR-PILOT-TEMPLATE-SESSION-GATE-01: production exercise_templates vs fixture-48 parity (read-only).
 * Uses validate-session-template-fixture.mjs with a temp JSON built from DB rows (custom path supported via argv[2] there).
 */

import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const GOLDEN_PATH = join(root, 'scripts', 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');
const VALIDATE_SCRIPT = join(root, 'scripts', 'validate-session-template-fixture.mjs');

const ENV_URL = 'NEXT_PUBLIC_SUPABASE_URL';
const ENV_SR = 'SUPABASE_SERVICE_ROLE_KEY';

const M48_IDS = Array.from({ length: 48 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`);

function printHeader(title) {
  console.log(title);
}

function setStatus(status, blockers, warnings, manualNotes) {
  printHeader('MOVE RE PILOT TEMPLATE PARITY CHECK');
  console.log(`STATUS: ${status}`);
  console.log(`PILOT_STATUS: ${status}`);
  console.log('');
  console.log('BLOCKERS:');
  if (blockers.length === 0) console.log('(none)');
  else for (const b of blockers) console.log(`- ${b}`);
  console.log('');
  console.log('WARNINGS:');
  if (warnings.length === 0) console.log('(none)');
  else for (const w of warnings) console.log(`- ${w}`);
  console.log('');
  console.log('MANUAL_REQUIRED:');
  if (manualNotes.length === 0) console.log('(none)');
  else for (const m of manualNotes) console.log(`- ${m}`);
}

function loadGolden() {
  if (!existsSync(GOLDEN_PATH)) {
    throw new Error(`Golden fixture not found: ${GOLDEN_PATH}`);
  }
  const data = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
  const templates = Array.isArray(data) ? data : data.templates;
  if (!Array.isArray(templates)) {
    throw new Error('Golden fixture: expected array or { templates: [] }');
  }
  const byId = new Map();
  for (const t of templates) {
    if (t?.id) byId.set(t.id, t);
  }
  return byId;
}

function mapRowToTemplate(row) {
  const avoid = row.avoid_if_pain_mode;
  const tv = row.target_vector;
  return {
    id: row.id,
    name: row.name,
    duration_sec: row.duration_sec,
    media_ref: row.media_ref ?? null,
    phase: row.phase ?? null,
    target_vector: Array.isArray(tv) ? tv : [],
    difficulty: row.difficulty ?? null,
    avoid_if_pain_mode: Array.isArray(avoid) ? avoid : [],
    progression_level: row.progression_level ?? null,
  };
}

function runValidateOnFile(filePath) {
  const r = spawnSync(process.execPath, [VALIDATE_SCRIPT, filePath], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function main() {
  const blockers = [];
  const warnings = [];
  const manual = [];

  const url = process.env[ENV_URL];
  const sr = process.env[ENV_SR];

  if (!url || !sr) {
    const missing = [];
    if (!url) missing.push(ENV_URL);
    if (!sr) missing.push(ENV_SR);
    manual.push(`Missing env keys (names only): ${missing.join(', ')}`);
    manual.push(
      'Automated parity requires production Supabase read access via service role.',
      'Manual replacement: verify exercise_templates in production has M01–M48 with session-composer fields per migrations (phase, target_vector, difficulty, progression_level, avoid_if_pain_mode).',
      'Then set the env keys locally or in CI and re-run: npm run test:pilot-template-parity'
    );
    setStatus('MANUAL_REQUIRED', blockers, warnings, manual);
    process.exit(0);
  }

  let goldenById;
  try {
    goldenById = loadGolden();
  } catch (e) {
    blockers.push(e.message || String(e));
    setStatus('FAIL', blockers, warnings, manual);
    process.exit(1);
  }

  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch (e) {
    blockers.push(`Supabase client import failed: ${e.message || e}`);
    setStatus('FAIL', blockers, warnings, manual);
    process.exit(1);
  }

  const supabase = createClient(url, sr, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from('exercise_templates')
    .select('id,name,duration_sec,media_ref,phase,target_vector,difficulty,avoid_if_pain_mode,progression_level')
    .in('id', M48_IDS);

  if (error) {
    blockers.push(`exercise_templates query failed: ${error.message || JSON.stringify(error)}`);
    setStatus('FAIL', blockers, warnings, manual);
    process.exit(1);
  }

  if (!Array.isArray(rows)) {
    blockers.push('exercise_templates returned non-array data');
    setStatus('FAIL', blockers, warnings, manual);
    process.exit(1);
  }

  if (rows.length < 48) {
    blockers.push(`Expected 48 rows for M01–M48, got ${rows.length}`);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of M48_IDS) {
    if (!byId.has(id)) {
      blockers.push(`Missing template id ${id}`);
    }
  }

  const templates = M48_IDS.filter((id) => byId.has(id)).map((id) => mapRowToTemplate(byId.get(id)));

  for (const id of M48_IDS) {
    const g = goldenById.get(id);
    const row = byId.get(id);
    if (!g || !row) continue;
    const t = mapRowToTemplate(row);
    if (t.name !== g.name) {
      warnings.push(`${id}: name mismatch (golden vs DB)`);
    }
    if (t.duration_sec !== g.duration_sec) {
      warnings.push(`${id}: duration_sec mismatch (golden=${g.duration_sec}, db=${t.duration_sec})`);
    }
    if (String(g.media_ref ?? '') !== String(t.media_ref ?? '')) {
      warnings.push(`${id}: media_ref differs from golden (non-blocking)`);
    }
  }

  const wrap = {
    version: 'session_plan_template_fixture_v1',
    template_count: templates.length,
    templates,
  };

  let tmpDir;
  let tmpFile;
  try {
    tmpDir = mkdtempSync(join(tmpdir(), 'pilot-template-parity-'));
    tmpFile = join(tmpDir, 'from-db.json');
    writeFileSync(tmpFile, JSON.stringify(wrap, null, 2), 'utf8');
  } catch (e) {
    blockers.push(`Temp fixture write failed: ${e.message || e}`);
    setStatus('FAIL', blockers, warnings, manual);
    process.exit(1);
  }

  const v = runValidateOnFile(tmpFile);
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  if (v.code !== 0) {
    blockers.push('validate-session-template-fixture.mjs failed on DB-derived JSON');
    if (v.stderr) blockers.push(`validate stderr (trimmed): ${v.stderr.trim().slice(0, 2000)}`);
    if (v.stdout) blockers.push(`validate stdout (trimmed): ${v.stdout.trim().slice(0, 2000)}`);
  }

  if (blockers.length > 0) {
    setStatus('FAIL', blockers, warnings, manual);
    process.exit(1);
  }

  setStatus('PASS', blockers, warnings, manual);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  printHeader('MOVE RE PILOT TEMPLATE PARITY CHECK');
  console.log('STATUS: FAIL');
  console.log('PILOT_STATUS: FAIL');
  console.log('');
  console.log('BLOCKERS:');
  console.log(`- Unhandled error: ${e.message || e}`);
  process.exit(1);
});
