/**
 * target_frequency → total_sessions 매핑 및 applyTargetFrequency 계약 검증
 * Run: npx tsx scripts/target-frequency-smoke.mjs
 *
 * DB 없이 lib/session/profile의 상수·타입만 검증.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const mod = await import('../src/lib/session/profile.ts');
const { FREQUENCY_TO_TOTAL, isValidTargetFrequency, VALID_FREQUENCIES } = mod;

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

// A. frequency 5 -> total_sessions 20
ok('frequency 5 -> 20', FREQUENCY_TO_TOTAL[5] === 20);

// B. frequency 2 -> total_sessions 8
ok('frequency 2 -> 8', FREQUENCY_TO_TOTAL[2] === 8);

// C. frequency 3 -> 12, 4 -> 16
ok('frequency 3 -> 12', FREQUENCY_TO_TOTAL[3] === 12);
ok('frequency 4 -> 16', FREQUENCY_TO_TOTAL[4] === 16);

// D. isValidTargetFrequency
ok('isValid 5', isValidTargetFrequency(5));
ok('isValid 2', isValidTargetFrequency(2));
ok('isValid rejects 1', !isValidTargetFrequency(1));
ok('isValid rejects 6', !isValidTargetFrequency(6));
ok('isValid rejects null', !isValidTargetFrequency(null));
ok('isValid rejects string', !isValidTargetFrequency('5'));

// E. VALID_FREQUENCIES
ok('VALID_FREQUENCIES length', VALID_FREQUENCIES.length === 4);
ok('VALID_FREQUENCIES includes 2,3,4,5', [2, 3, 4, 5].every((f) => VALID_FREQUENCIES.includes(f)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
