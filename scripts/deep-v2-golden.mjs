/**
 * Deep v2 Golden Test Runner (PR3)
 * Run: node --experimental-strip-types scripts/deep-v2-golden.mjs
 * Or: npx tsx scripts/deep-v2-golden.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve from project root - use tsx to run .ts
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

// Relative import from scripts/ - tsx resolves .ts
const deepV2Module = '../src/lib/deep-test/scoring/deep_v2.ts';
const fixturesPath = join(projectRoot, 'src/lib/deep-test/golden/fixtures.json');

const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

async function run() {
  const dv = await import(deepV2Module);
  const calculateDeepV2 = dv.calculateDeepV2;
  const extendDeepV2 = dv.extendDeepV2;

  if (typeof calculateDeepV2 !== 'function' || typeof extendDeepV2 !== 'function') {
    console.error('Missing exports:', Object.keys(dv));
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const fx of fixtures) {
    try {
      const v2 = calculateDeepV2(fx.answers);
      const extended = extendDeepV2(v2);
      const actual = extended.result_type;
      const expected = fx.expected.result_type;

      if (actual === expected) {
        passed++;
        console.log(`  ✓ ${fx.id}: ${actual}`);
      } else {
        failed++;
        console.error(`  ✗ ${fx.id}: expected ${expected}, got ${actual}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${fx.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
