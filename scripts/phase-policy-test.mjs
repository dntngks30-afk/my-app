/**
 * PR-P1-4: Phase policy unit test
 * Run: npx tsx scripts/phase-policy-test.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const mod = await import('../src/lib/session/phase.ts');
const {
  normalizeTotalSessions,
  resolvePhaseLengths,
  computePhase,
  computePhaseFromLengths,
  isAdaptivePhasePolicy,
  resolvePhasePolicyReason,
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

// normalizeTotalSessions
ok('normalize 8', normalizeTotalSessions(8) === 8);
ok('normalize 12', normalizeTotalSessions(12) === 12);
ok('normalize 16', normalizeTotalSessions(16) === 16);
ok('normalize 20', normalizeTotalSessions(20) === 20);
ok('normalize 10 -> 12', normalizeTotalSessions(10) === 12);

// equal policy (no options)
const eq8 = resolvePhaseLengths(8, null);
ok('8 equal [2,2,2,2]', eq8[0] === 2 && eq8[1] === 2 && eq8[2] === 2 && eq8[3] === 2);
ok('8 equal sum', eq8.reduce((a, b) => a + b, 0) === 8);

const eq12 = resolvePhaseLengths(12, null);
ok('12 equal [3,3,3,3]', eq12[0] === 3 && eq12[1] === 3 && eq12[2] === 3 && eq12[3] === 3);

const eq16 = resolvePhaseLengths(16, null);
ok('16 equal [4,4,4,4]', eq16[0] === 4 && eq16[1] === 4 && eq16[2] === 4 && eq16[3] === 4);

// adaptive policy
const opt = { deepLevel: 1, safetyMode: null, redFlags: null };
const ad8 = resolvePhaseLengths(8, opt);
ok('8 adaptive [3,2,2,1]', ad8[0] === 3 && ad8[1] === 2 && ad8[2] === 2 && ad8[3] === 1);
ok('8 adaptive sum', ad8.reduce((a, b) => a + b, 0) === 8);

const ad12 = resolvePhaseLengths(12, opt);
ok('12 adaptive [4,3,3,2]', ad12[0] === 4 && ad12[1] === 3 && ad12[2] === 3 && ad12[3] === 2);

const ad16 = resolvePhaseLengths(16, opt);
ok('16 adaptive [5,4,4,3]', ad16[0] === 5 && ad16[1] === 4 && ad16[2] === 4 && ad16[3] === 3);

const ad20 = resolvePhaseLengths(20, opt);
ok('20 adaptive [6,5,5,4]', ad20[0] === 6 && ad20[1] === 5 && ad20[2] === 5 && ad20[3] === 4);

// isAdaptivePhasePolicy
ok('adaptive deepLevel 1', isAdaptivePhasePolicy({ deepLevel: 1 }));
ok('adaptive safety yellow', isAdaptivePhasePolicy({ safetyMode: 'yellow' }));
ok('adaptive safety red', isAdaptivePhasePolicy({ safetyMode: 'red' }));
ok('adaptive redFlags', isAdaptivePhasePolicy({ redFlags: true }));
ok('not adaptive level 2', !isAdaptivePhasePolicy({ deepLevel: 2 }));
ok('not adaptive safety none', !isAdaptivePhasePolicy({ safetyMode: 'none' }));

// resolvePhasePolicyReason
ok('reason red_flags', resolvePhasePolicyReason({ redFlags: true }) === 'red_flags');
ok('reason safety_mode', resolvePhasePolicyReason({ safetyMode: 'yellow' }) === 'safety_mode');
ok('reason deep_level_1', resolvePhasePolicyReason({ deepLevel: 1 }) === 'deep_level_1');
ok('reason default', resolvePhasePolicyReason(null) === 'default');

// computePhase boundaries - equal 8
ok('8 eq s1->p1', computePhase(8, 1, { policyOptions: null }) === 1);
ok('8 eq s2->p1', computePhase(8, 2, { policyOptions: null }) === 1);
ok('8 eq s3->p2', computePhase(8, 3, { policyOptions: null }) === 2);
ok('8 eq s5->p3', computePhase(8, 5, { policyOptions: null }) === 3);
ok('8 eq s7->p4', computePhase(8, 7, { policyOptions: null }) === 4);
ok('8 eq s8->p4', computePhase(8, 8, { policyOptions: null }) === 4);

// computePhase boundaries - adaptive 8 [3,2,2,1]
ok('8 ad s1->p1', computePhase(8, 1, { policyOptions: opt }) === 1);
ok('8 ad s2->p1', computePhase(8, 2, { policyOptions: opt }) === 1);
ok('8 ad s3->p1', computePhase(8, 3, { policyOptions: opt }) === 1);
ok('8 ad s4->p2', computePhase(8, 4, { policyOptions: opt }) === 2);
ok('8 ad s5->p2', computePhase(8, 5, { policyOptions: opt }) === 2);
ok('8 ad s6->p3', computePhase(8, 6, { policyOptions: opt }) === 3);
ok('8 ad s7->p3', computePhase(8, 7, { policyOptions: opt }) === 3);
ok('8 ad s8->p4', computePhase(8, 8, { policyOptions: opt }) === 4);

// computePhaseFromLengths
const lengths = [3, 2, 2, 1];
ok('fromLengths s1->p1', computePhaseFromLengths(lengths, 1) === 1);
ok('fromLengths s3->p1', computePhaseFromLengths(lengths, 3) === 1);
ok('fromLengths s4->p2', computePhaseFromLengths(lengths, 4) === 2);
ok('fromLengths s8->p4', computePhaseFromLengths(lengths, 8) === 4);

// each phase >= 1
ok('adaptive each phase >= 1', ad8.every((n) => n >= 1));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
