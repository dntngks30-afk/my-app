/**
 * PR-P1-3: Session snapshot builder smoke test
 * Run: npx tsx scripts/session-snapshot-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const mod = await import('../src/lib/session/session-snapshot.ts');
const {
  buildDeepSummarySnapshot,
  buildProfileSnapshot,
  buildGenerationTrace,
  PLAN_VERSION,
  CREATED_BY,
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

// Legacy summary (no explainability)
const legacySummary = {
  result_type: 'LOWER-LIMB',
  confidence: 0.72,
  effective_confidence: 0.72,
  focus: ['glute_medius', 'hip_mobility'],
  avoid: ['knee_load'],
  scoring_version: 'deep_v2',
  safety_mode: 'none',
};
const legacySnapshot = buildDeepSummarySnapshot(legacySummary);
ok('legacy snapshot has result_type', legacySnapshot.result_type === 'LOWER-LIMB');
ok('legacy snapshot has effective_confidence', legacySnapshot.effective_confidence === 0.72);
ok('legacy snapshot has focus', Array.isArray(legacySnapshot.focus) && legacySnapshot.focus.length === 2);
ok('legacy snapshot no crash', typeof legacySnapshot === 'object');

// New-style summary (with explainability)
const newSummary = {
  ...legacySummary,
  primaryFocus: 'LOWER-LIMB',
  secondaryFocus: 'LUMBO-PELVIS',
  confidence_breakdown: { final_confidence: 0.85 },
  rationale: { summary: 'test' },
};
const newSnapshot = buildDeepSummarySnapshot(newSummary);
ok('new snapshot has confidence_breakdown', newSnapshot.confidence_breakdown?.final_confidence === 0.85);
ok('new snapshot has rationale', newSnapshot.rationale?.summary === 'test');

// Profile snapshot
const profileSnap = buildProfileSnapshot({ target_frequency: 4 }, 16);
ok('profile snapshot total_sessions', profileSnap.total_sessions === 16);
ok('profile snapshot target_frequency', profileSnap.target_frequency === 4);
ok('profile snapshot null profile', buildProfileSnapshot(null, 16).total_sessions === 16);

// Generation trace
const trace = buildGenerationTrace({
  sessionNumber: 1,
  totalSessions: 16,
  phase: 1,
  theme: 'Phase 1 · glute_medius 안정화',
  confidenceSource: 'effective_confidence',
  scoringVersion: 'deep_v2',
  safetyMode: 'none',
  primaryFocus: 'LOWER-LIMB',
});
ok('trace has session_number', trace.session_number === 1);
ok('trace has confidence_source', trace.confidence_source === 'effective_confidence');
ok('trace has created_by', trace.created_by === CREATED_BY);
ok('trace has summary_source', trace.summary_source === 'deep_summary_snapshot');

ok('PLAN_VERSION constant', PLAN_VERSION === 'session_plan_v1');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
