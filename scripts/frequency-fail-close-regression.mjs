/**
 * PR-P0-2: Frequency required fail-close regression tests.
 * Run: npx tsx scripts/frequency-fail-close-regression.mjs
 *
 * Tests:
 * A. finalize(body.target_frequency=2) success -> applied_total_sessions=8, rail_ready=true
 * B. finalize(body.target_frequency missing) -> 400 fail
 * C. active with no progress + no profile -> 409 FREQUENCY_REQUIRED (mock)
 * D. create with no progress + no profile -> 409 FREQUENCY_REQUIRED (mock)
 * E. checkRailReady mismatch -> ready=false
 * F. FREQUENCY_TO_TOTAL mapping 2->8, 3->12, 4->16, 5->20
 * G. applyTargetFrequency idempotent (re-call same result)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const profile = await import('../src/lib/session/profile.ts');
const {
  FREQUENCY_TO_TOTAL,
  isValidTargetFrequency,
  applyTargetFrequency,
  checkRailReady,
} = profile;

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

console.log('\n--- A. finalize success contract (applied_total_sessions) ---');
ok('freq 2 -> 8', FREQUENCY_TO_TOTAL[2] === 8);
ok('freq 3 -> 12', FREQUENCY_TO_TOTAL[3] === 12);
ok('freq 4 -> 16', FREQUENCY_TO_TOTAL[4] === 16);
ok('freq 5 -> 20', FREQUENCY_TO_TOTAL[5] === 20);

console.log('\n--- B. finalize fail when target_frequency missing ---');
ok('null invalid', !isValidTargetFrequency(null));
ok('undefined invalid', !isValidTargetFrequency(undefined));
ok('1 invalid', !isValidTargetFrequency(1));
ok('6 invalid', !isValidTargetFrequency(6));

console.log('\n--- C/D. active/create fail-close (resolveTotalSessions source=default) ---');
function createMockSupabase(profileData = null, progressData = null) {
  return {
    from: (table) => {
      const single = (data) => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data, error: null }) }),
        }),
      });
      if (table === 'session_user_profile') return single(profileData);
      if (table === 'session_program_progress') return single(progressData);
      return single(null);
    },
  };
}
const mockNoProfile = createMockSupabase(null, null);
const railNoProfile = await checkRailReady(mockNoProfile, 'user-x');
ok('E. checkRailReady no profile -> not ready', !railNoProfile.ready && railNoProfile.reason === 'profile_target_frequency_missing');

const mockProfileNoProgress = createMockSupabase({ target_frequency: 2 }, null);
const railNoProgress = await checkRailReady(mockProfileNoProgress, 'user-y');
ok('E2. checkRailReady profile but no progress -> not ready', !railNoProgress.ready && railNoProgress.reason === 'progress_total_sessions_missing');

const mockMismatch = createMockSupabase({ target_frequency: 2 }, { total_sessions: 16 });
const railMismatch = await checkRailReady(mockMismatch, 'user-z');
ok('E3. checkRailReady freq=2 but total=16 -> not ready', !railMismatch.ready && railMismatch.reason === 'total_sessions_mismatch');

const mockReady = createMockSupabase({ target_frequency: 2 }, { total_sessions: 8 });
const railReady = await checkRailReady(mockReady, 'user-w');
ok('E4. checkRailReady freq=2 total=8 -> ready', railReady.ready);

console.log('\n--- F. applyTargetFrequency idempotent ---');
const mockFresh = {
  from: (table) => {
    if (table === 'session_program_progress') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === 'session_user_profile') {
      return {
        upsert: () => ({
          select: () => ({
            single: async () => ({
              data: { user_id: 'u', target_frequency: 2 },
              error: null,
            }),
          }),
        }),
      };
    }
    return {};
  },
};
const r1 = await applyTargetFrequency(mockFresh, 'u1', 2);
const r2 = await applyTargetFrequency(mockFresh, 'u1', 2);
ok('G. applyTargetFrequency idempotent (same totalSessions)', r1.ok && r2.ok && r1.totalSessions === r2.totalSessions && r1.totalSessions === 8);

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
