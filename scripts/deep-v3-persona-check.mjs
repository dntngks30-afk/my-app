/**
 * PR-ALG-07: Deep v3 persona check
 * Run: npx tsx scripts/deep-v3-persona-check.mjs
 * Validates fixture answers -> deep_v3 derived
 * Expects primary_type, pain_mode, priority_vector
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const personasPath = join(projectRoot, 'src/lib/deep-test/scenarios/personas.json');
const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));

async function run() {
  const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
  const { calculateDeepV3 } = dv;

  let passed = 0;
  let failed = 0;

  for (const p of personas) {
    try {
      const v3 = calculateDeepV3(p.input);
      const exp = p.expected_analysis || {};

      if (exp.primary_type && v3.primary_type !== exp.primary_type) {
        throw new Error(`primary_type: expected ${exp.primary_type}, got ${v3.primary_type}`);
      }
      if (exp.pain_mode && v3.pain_mode !== exp.pain_mode) {
        throw new Error(`pain_mode: expected ${exp.pain_mode}, got ${v3.pain_mode}`);
      }
      if (exp.priority_vector_contains && Array.isArray(exp.priority_vector_contains)) {
        const pv = v3.priority_vector || {};
        const topAxes = Object.entries(pv)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([k]) => k);
        for (const axis of exp.priority_vector_contains) {
          if (!topAxes.includes(axis)) {
            throw new Error(
              `priority_vector_contains: expected ${axis} in top, got [${topAxes.join(', ')}]`
            );
          }
        }
      }

      passed++;
      if (process.env.DEBUG) {
        console.log(`  ${p.id}: ${v3.primary_type} / ${v3.pain_mode} ok`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
