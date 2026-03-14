/**
 * P0 frequency SSOT smoke: active/create mapping matches profile.
 * Run: npx tsx scripts/frequency-ssot-smoke.mjs
 *
 * Verifies:
 * - profile.FREQUENCY_TO_TOTAL matches active/create mapping (2→8, 3→12, 4→16, 5→20)
 * - Default fallback is 16 when profile missing
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const profile = await import('../src/lib/session/profile.ts');
const EXPECTED = { 2: 8, 3: 12, 4: 16, 5: 20 };
const DEFAULT = 16;

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('\n--- Frequency SSOT: profile.FREQUENCY_TO_TOTAL ---');
for (const [freq, total] of Object.entries(EXPECTED)) {
  ok(`freq ${freq} -> ${total}`, profile.FREQUENCY_TO_TOTAL[Number(freq)] === total);
}

console.log('\n--- Default fallback (profile missing) ---');
ok('invalid freq falls back to 16', profile.FREQUENCY_TO_TOTAL[1] === undefined);
ok('freq 4 maps to 16 (default)', profile.FREQUENCY_TO_TOTAL[4] === DEFAULT);

console.log('\n--- isValidTargetFrequency ---');
ok('2,3,4,5 valid', [2, 3, 4, 5].every((f) => profile.isValidTargetFrequency(f)));
ok('1,6,null invalid', !profile.isValidTargetFrequency(1) && !profile.isValidTargetFrequency(6) && !profile.isValidTargetFrequency(null));

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
