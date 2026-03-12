/**
 * target_frequency → total_sessions regression tests
 * Run: npx tsx scripts/target-frequency-regression.mjs
 *
 * Locks contract:
 * - 2→8, 3→12, 4→16, 5→20
 * - Stale 16 prevention: freq 5 must resolve to 20
 * - Pre-save failure: server applyTargetFrequency is authoritative
 * - Existing progress safety: POLICY_LOCKED when total would drop below completed
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const mod = await import('../src/lib/session/profile.ts');
const {
  FREQUENCY_TO_TOTAL,
  isValidTargetFrequency,
  VALID_FREQUENCIES,
  wouldPolicyLock,
  applyTargetFrequency,
} = mod;

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

console.log('\n--- E. Mapping contract ---');
ok('E1: 2 -> 8', FREQUENCY_TO_TOTAL[2] === 8);
ok('E2: 3 -> 12', FREQUENCY_TO_TOTAL[3] === 12);
ok('E3: 4 -> 16', FREQUENCY_TO_TOTAL[4] === 16);
ok('E4: 5 -> 20', FREQUENCY_TO_TOTAL[5] === 20);

console.log('\n--- A/B. Stale 16 prevention (freq 5 must be 20) ---');
ok('A: freq 5 resolves to 20, not 16', FREQUENCY_TO_TOTAL[5] === 20 && FREQUENCY_TO_TOTAL[5] !== 16);
ok('B: freq 2 resolves to 8', FREQUENCY_TO_TOTAL[2] === 8);

console.log('\n--- D. Existing progress safety (wouldPolicyLock) ---');
ok('D1: completed 10, freq 2 (8) -> policy lock', wouldPolicyLock(10, 2));
ok('D2: completed 5, freq 5 (20) -> no lock', !wouldPolicyLock(5, 5));
ok('D3: completed 0, freq 5 -> no lock', !wouldPolicyLock(0, 5));
ok('D4: completed 8, freq 2 (8) -> no lock (exact)', !wouldPolicyLock(8, 2));
ok('D5: completed 9, freq 2 (8) -> policy lock', wouldPolicyLock(9, 2));

console.log('\n--- isValidTargetFrequency ---');
ok('isValid 2,3,4,5', [2, 3, 4, 5].every((f) => isValidTargetFrequency(f)));
ok('isValid rejects 1,6,null,string', !isValidTargetFrequency(1) && !isValidTargetFrequency(6) && !isValidTargetFrequency(null) && !isValidTargetFrequency('5'));

console.log('\n--- C. applyTargetFrequency (mock: server authoritative path) ---');

function createMockSupabase(opts = {}) {
  const {
    existingProgress = null,
    profileError = null,
    progressError = null,
  } = opts;
  return {
    from: (table) => {
      if (table === 'session_program_progress') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: existingProgress, error: null }),
            }),
          }),
          update: (data) => ({
            eq: () => Promise.resolve({ error: progressError }),
          }),
          insert: () => Promise.resolve({ error: progressError }),
        };
      }
      if (table === 'session_user_profile') {
        return {
          upsert: (data) => ({
            select: () => ({
              single: async () => ({
                data: { user_id: 'x', target_frequency: data.target_frequency },
                error: profileError,
              }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

// C1: Fresh user, freq 5 -> success, totalSessions 20 (pre-save failure path: server owns)
const mockFresh = createMockSupabase();
const result5 = await applyTargetFrequency(mockFresh, 'user-1', 5);
ok('C1: fresh user freq 5 -> ok, totalSessions 20', result5.ok && result5.totalSessions === 20);

// C2: Fresh user, freq 2 -> success, totalSessions 8
const mockFresh2 = createMockSupabase();
const result2 = await applyTargetFrequency(mockFresh2, 'user-2', 2);
ok('C2: fresh user freq 2 -> ok, totalSessions 8', result2.ok && result2.totalSessions === 8);

// C3: Existing progress with completed 10, freq 2 -> POLICY_LOCKED
const mockExisting = createMockSupabase({
  existingProgress: { completed_sessions: 10, active_session_number: null },
});
const resultLocked = await applyTargetFrequency(mockExisting, 'user-3', 2);
ok('C3: completed 10, freq 2 -> POLICY_LOCKED', !resultLocked.ok && resultLocked.code === 'POLICY_LOCKED');

// C4: Existing progress, freq 5 (20) -> success (increase allowed)
const mockExistingIncrease = createMockSupabase({
  existingProgress: { completed_sessions: 5, active_session_number: null },
});
const resultIncrease = await applyTargetFrequency(mockExistingIncrease, 'user-4', 5);
ok('C4: completed 5, freq 5 -> ok (increase allowed)', resultIncrease.ok && resultIncrease.totalSessions === 20);

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
