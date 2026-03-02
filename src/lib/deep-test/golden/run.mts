/**
 * Deep v2 Golden Test Runner (PR3)
 * node selftest: 40 fixtures → calculateDeepV2 + extendDeepV2 → result_type 검증
 * 실패 시 exit 1
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dv from '../scoring/deep_v2';
import type { DeepAnswerValue } from '../types';

const { calculateDeepV2, extendDeepV2 } = dv;

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, 'fixtures.json');

interface Fixture {
  id: string;
  answers: Record<string, DeepAnswerValue>;
  expected: { result_type: string };
}

const fixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

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
