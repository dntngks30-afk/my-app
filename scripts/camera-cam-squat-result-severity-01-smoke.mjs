/**
 * PR-CAM-SQUAT-RESULT-SEVERITY-01: squat result severity 규칙 스모크
 *
 * 실행: npx tsx scripts/camera-cam-squat-result-severity-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildSquatResultSeveritySummary } = await import('../src/lib/camera/squat-result-severity.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
    process.exitCode = 1;
  }
}

console.log('PR-CAM-SQUAT-RESULT-SEVERITY-01 smoke\n');

// A. low-quality success (latest JSON shape)
const a = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'low',
  qualityOnlyWarnings: ['capture_quality_low'],
  qualityTier: 'low',
  limitations: ['asymmetry_elevated', 'shallow_time_in_depth'],
});
ok('A: low-quality pass', a.passSeverity === 'low_quality_pass');
ok('A: interpretation limited', a.resultInterpretation === 'movement_completed_but_quality_limited');

// B. clean success (internal tier uses medium|high, not "mid")
const b = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'high',
  limitations: [],
});
ok('B: clean pass (high tier)', b.passSeverity === 'clean_pass');
ok('B: movement_completed_clean', b.resultInterpretation === 'movement_completed_clean');

const b2 = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'medium',
  limitations: [],
});
ok('B2: clean pass (medium tier)', b2.passSeverity === 'clean_pass');

// C. warning pass — limitations only, no low-quality triggers
const c = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'high',
  limitations: ['asymmetry_elevated'],
});
ok('C: warning_pass', c.passSeverity === 'warning_pass');
ok('C: movement_completed_with_warnings', c.resultInterpretation === 'movement_completed_with_warnings');

// D. failed
const d = buildSquatResultSeveritySummary({
  completionTruthPassed: false,
  captureQuality: 'ok',
  qualityOnlyWarnings: [],
  qualityTier: 'high',
  limitations: [],
});
ok('D: failed', d.passSeverity === 'failed');
ok('D: movement_not_completed', d.resultInterpretation === 'movement_not_completed');

// E. quality warnings alone → low_quality (even without capture low)
const e = buildSquatResultSeveritySummary({
  completionTruthPassed: true,
  captureQuality: 'ok',
  qualityOnlyWarnings: ['capture_quality_low'],
  qualityTier: 'high',
  limitations: [],
});
ok('E: warnings length >=1 → low_quality_pass', e.passSeverity === 'low_quality_pass');

// Engine files must not be in this PR — spot-check import path only touches allowed modules
const traceMod = await import('../src/lib/camera/camera-trace.ts');
ok('trace exports buildAttemptSnapshot', typeof traceMod.buildAttemptSnapshot === 'function');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
