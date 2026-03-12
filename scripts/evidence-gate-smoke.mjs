/**
 * PR-DATA-01: Evidence gate smoke test
 * Run: npx tsx scripts/evidence-gate-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateEvidenceGate } = await import('../src/lib/session/evidence-gate.ts');

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

console.log('Evidence gate smoke test\n');

// Plan: 5 items total, 2 in Main
const planWithMain = {
  segments: [
    { title: 'Prep', items: [{ templateId: 'p1', name: 'Prep 1' }] },
    { title: 'Main', items: [{ templateId: 'm1', name: 'Main 1' }, { templateId: 'm2', name: 'Main 2' }] },
    { title: 'Cooldown', items: [{ templateId: 'c1', name: 'Cool 1' }, { templateId: 'c2', name: 'Cool 2' }] },
  ],
};

// AT1: < 60% coverage → rejected
const logs2of5 = [
  { templateId: 'p1', name: 'Prep 1', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
  { templateId: 'm1', name: 'Main 1', sets: 1, reps: 8, difficulty: null, rpe: null, discomfort: null },
];
const r1 = evaluateEvidenceGate(planWithMain, logs2of5, null);
ok('AT1: <60% coverage rejected', !r1.allowed);
ok('AT1: NOT_ENOUGH_COMPLETION_COVERAGE or MAIN ok', r1.code === 'NOT_ENOUGH_COMPLETION_COVERAGE' || r1.code === 'MAIN_SEGMENT_REQUIRED' || r1.code === 'INSUFFICIENT_EXECUTION_EVIDENCE');
ok('AT1: has message', typeof r1.message === 'string' && r1.message.length > 0);

// AT2: 60%+ but no MAIN → rejected
const logsNoMain = [
  { templateId: 'p1', name: 'Prep 1', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
  { templateId: 'c1', name: 'Cool 1', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
  { templateId: 'c2', name: 'Cool 2', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
];
const r2 = evaluateEvidenceGate(planWithMain, logsNoMain, null);
ok('AT2: no MAIN rejected', !r2.allowed);
ok('AT2: MAIN_SEGMENT_REQUIRED', r2.code === 'MAIN_SEGMENT_REQUIRED');
ok('AT4: rejection has code', typeof r2.code === 'string');
ok('AT4: rejection has message', typeof r2.message === 'string');

// AT3: enough items + evidence → allowed
const logsFull = [
  { templateId: 'p1', name: 'Prep 1', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
  { templateId: 'm1', name: 'Main 1', sets: 2, reps: 8, difficulty: null, rpe: 7, discomfort: null },
  { templateId: 'm2', name: 'Main 2', sets: 2, reps: 10, difficulty: null, rpe: null, discomfort: 2 },
  { templateId: 'c1', name: 'Cool 1', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
  { templateId: 'c2', name: 'Cool 2', sets: 1, reps: 10, difficulty: null, rpe: null, discomfort: null },
];
const r3 = evaluateEvidenceGate(planWithMain, logsFull, { sessionFeedback: { overallRpe: 7 } });
ok('AT3: sufficient evidence allowed', r3.allowed === true);

// AT5: empty plan → rejected
const r4 = evaluateEvidenceGate({ segments: [] }, [], null);
ok('empty plan rejected', !r4.allowed);
ok('empty plan INSUFFICIENT_EXECUTION_EVIDENCE', r4.code === 'INSUFFICIENT_EXECUTION_EVIDENCE');

// Plan with no Main segment (e.g. all Prep)
const planNoMain = {
  segments: [
    { title: 'Prep', items: [{ templateId: 'p1', name: 'P1' }, { templateId: 'p2', name: 'P2' }] },
  ],
};
const r5 = evaluateEvidenceGate(planNoMain, [
  { templateId: 'p1', name: 'P1', sets: 1, reps: 5, difficulty: null, rpe: null, discomfort: null },
  { templateId: 'p2', name: 'P2', sets: 1, reps: 5, difficulty: null, rpe: null, discomfort: null },
], { sessionFeedback: { overallRpe: 5 } });
ok('plan with no Main: 100% coverage allowed', r5.allowed === true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
