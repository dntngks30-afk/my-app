/**
 * PR-TEMPLATE-48-METADATA-ALIGN-01: validate session plan template fixture JSON.
 * Usage: node scripts/validate-session-template-fixture.mjs <path-to-fixture.json>
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ALLOWED_PHASE = new Set(['prep', 'main', 'accessory', 'cooldown']);
const ALLOWED_DIFF = new Set(['low', 'medium', 'high']);
/** Align with plan-generator GOLD_PATH_VECTORS + asymmetry (session meta column comment) + balanced_reset used in code */
const ALLOWED_VECTORS = new Set([
  'lower_stability',
  'lower_mobility',
  'upper_mobility',
  'trunk_control',
  'asymmetry',
  'deconditioned',
  'balanced_reset',
]);

function main() {
  const arg = process.argv[2] || join(root, 'scripts', 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');
  const path = arg.startsWith('/') || /^[A-Za-z]:/.test(arg) ? arg : resolve(root, arg);
  if (!existsSync(path)) {
    console.error('Fixture not found:', path);
    process.exit(2);
  }
  const raw = readFileSync(path, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON', e);
    process.exit(2);
  }

  const templates = Array.isArray(data) ? data : data.templates;
  if (!Array.isArray(templates)) {
    console.error('Expected top-level array or { templates: [] }');
    process.exit(1);
  }

  const errors = [];

  if (templates.length !== 48) {
    errors.push(`Expected exactly 48 rows, got ${templates.length}`);
  }

  const ids = new Set(templates.map((t) => t.id).filter(Boolean));
  for (let i = 1; i <= 48; i++) {
    const id = `M${String(i).padStart(2, '0')}`;
    if (!ids.has(id)) {
      errors.push(`Missing id ${id}`);
    }
  }
  if (ids.size !== 48) {
    errors.push(`Expected 48 unique ids, got ${ids.size}`);
  }

  for (const t of templates) {
    if (!t || typeof t.id !== 'string') continue;
    const m = parseInt(t.id.replace('M', ''), 10);
    if (m >= 29 && m <= 48) {
      if (t.phase == null || t.phase === '') {
        errors.push(`${t.id}: M29-48 require non-null phase`);
      }
      if (!Array.isArray(t.target_vector) || t.target_vector.length === 0) {
        errors.push(`${t.id}: M29-48 require non-empty target_vector`);
      }
      if (t.difficulty == null || t.difficulty === '') {
        errors.push(`${t.id}: M29-48 require non-null difficulty`);
      }
      if (t.progression_level == null) {
        errors.push(`${t.id}: M29-48 require non-null progression_level`);
      }
    }
    if (!Array.isArray(t.avoid_if_pain_mode)) {
      errors.push(`${t.id}: avoid_if_pain_mode must be an array`);
    }
    if (t.phase != null && t.phase !== '' && !ALLOWED_PHASE.has(t.phase)) {
      errors.push(`${t.id}: invalid phase ${t.phase}`);
    }
    if (t.difficulty != null && t.difficulty !== '' && !ALLOWED_DIFF.has(t.difficulty)) {
      errors.push(`${t.id}: invalid difficulty ${t.difficulty}`);
    }
    if (Array.isArray(t.target_vector)) {
      for (const v of t.target_vector) {
        if (typeof v === 'string' && !ALLOWED_VECTORS.has(v)) {
          errors.push(`${t.id}: unknown target_vector axis: ${v}`);
        }
      }
    }
  }

  if (errors.length) {
    for (const e of errors) {
      console.error('FAIL:', e);
    }
    process.exit(1);
  }
  console.log('OK: fixture valid —', path, 'rows=', templates.length);
}

main();
