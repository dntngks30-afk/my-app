/**
 * PR-SQUAT-PASS-OWNER-REALIGN-01 smoke:
 * owner contradiction invariant must fail-close.
 *
 * Run:
 *   npx tsx scripts/camera-squat-owner-contradiction-invariant-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { enforceSquatOwnerContradictionInvariant } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
  console.error(`  FAIL: ${name}${detail}`);
  process.exitCode = 1;
}

function owner(overrides = {}) {
  return {
    completionOwnerPassed: true,
    completionOwnerReason: 'standard_cycle',
    completionOwnerBlockedReason: null,
    ...overrides,
  };
}

function state(overrides = {}) {
  return {
    cycleComplete: true,
    ...overrides,
  };
}

console.log('\nA. owner passed + not_confirmed reason => blocked');
{
  const r = enforceSquatOwnerContradictionInvariant({
    ownerTruth: owner({ completionOwnerReason: 'not_confirmed' }),
    squatCompletionState: state(),
  });
  ok('A1: owner pass is revoked', r.completionOwnerPassed === false, r);
}

console.log('\nB. owner passed + blocked reason => blocked');
{
  const r = enforceSquatOwnerContradictionInvariant({
    ownerTruth: owner({ completionOwnerBlockedReason: 'descent_span_too_short' }),
    squatCompletionState: state(),
  });
  ok('B1: owner pass is revoked', r.completionOwnerPassed === false, r);
}

console.log('\nC. cycleComplete=false + owner passed => blocked');
{
  const r = enforceSquatOwnerContradictionInvariant({
    ownerTruth: owner(),
    squatCompletionState: state({ cycleComplete: false }),
  });
  ok('C1: owner pass is revoked', r.completionOwnerPassed === false, r);
}

console.log('\nD. valid owner stays valid');
{
  const r = enforceSquatOwnerContradictionInvariant({
    ownerTruth: owner(),
    squatCompletionState: state(),
  });
  ok('D1: owner pass remains true', r.completionOwnerPassed === true, r);
}

console.log(`\nowner contradiction invariant smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

