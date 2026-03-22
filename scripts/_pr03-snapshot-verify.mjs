/**
 * PR-BASELINE-RAW-AXIS-SNAPSHOT-03 — 스냅샷 저장 및 camera refine 소비 검증
 */

const PASS = (label) => console.log('  ✅ PASS ', label);
const FAIL = (label) => { console.error('  ❌ FAIL ', label); process.exitCode = 1; };

console.log('═'.repeat(60));
console.log('  PR-BASELINE-RAW-AXIS-SNAPSHOT-03 — Snapshot Verify');
console.log('═'.repeat(60));

const { buildFreeSurveyBaselineResult } = await import('../src/lib/deep-v2/builders/build-free-survey-baseline.ts');
const { buildCameraRefinedResult } = await import('../src/lib/deep-v2/builders/build-camera-refined-result.ts');

const fullAnswers = Object.fromEntries(
  Array.from({ length: 18 }, (_, i) => [`q${i + 1}`, 2])
);

// ─── 1. baseline snapshot 부착 확인 ──────────────────────────
console.log('\n[ 1. baseline 스냅샷 부착 ]');
const baseline = buildFreeSurveyBaselineResult(fullAnswers);
const snap = baseline.result._compat?.baseline_deep_evidence_snapshot;

if (!snap) {
  FAIL('snapshot이 _compat에 없음');
} else {
  PASS('baseline._compat.baseline_deep_evidence_snapshot 존재');
  snap.schema_version === 'free_survey_baseline_evidence_v1'
    ? PASS('schema_version = free_survey_baseline_evidence_v1')
    : FAIL(`schema_version 불일치: ${snap.schema_version}`);

  const axes = snap.axis_scores;
  const allNumbers = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned']
    .every(k => typeof axes[k] === 'number');
  allNumbers ? PASS('axis_scores: 6축 모두 number') : FAIL('axis_scores에 non-number 필드 존재');

  typeof snap.answered_count === 'number'
    ? PASS(`answered_count = ${snap.answered_count}`)
    : FAIL('answered_count 없음');
  Array.isArray(snap.missing_signals)
    ? PASS('missing_signals 배열 존재')
    : FAIL('missing_signals 없음');
  console.log('    axis_scores:', JSON.stringify(snap.axis_scores));
}

// ─── 2. snapshot-first path (camera refine) ──────────────────
console.log('\n[ 2. camera refine — snapshot-first 경로 ]');
// ─── camera mock (deep-v2-05 smoke 스크립트와 동일 형식) ─────
const mockCamera = {
  movementType: 'penguin',
  patternSummary: '하체 안정성 부족',
  avoidItems: [],
  resetAction: '',
  confidence: 0.7,
  captureQuality: 'ok',
  flags: ['knee_cave'],
  retryRecommended: false,
  fallbackMode: null,
  insufficientSignal: false,
  evaluatorResults: [
    {
      stepId: 'squat',
      insufficientSignal: false,
      metrics: [
        { name: 'depth', value: 0.5, trend: 'concern' },
        { name: 'knee_alignment_trend', value: 0.3, trend: 'concern' },
      ],
    },
  ],
  resultEvidenceLevel: 'partial_evidence',
  resultToneMode: 'guarded',
  debug: { perExercise: [] },
};

try {
  const refined = buildCameraRefinedResult(baseline.result, mockCamera);
  refined.result?.primary_type
    ? PASS(`refined.result.primary_type = ${refined.result.primary_type}`)
    : FAIL('refined.result.primary_type 없음');
  refined.refined_meta?.result_stage === 'refined'
    ? PASS('refined_meta.result_stage = refined')
    : FAIL(`result_stage = ${refined.refined_meta?.result_stage}`);
} catch (e) {
  FAIL(`camera refine 실패: ${e.message}`);
}

// ─── 3. proxy fallback (구형 payload — snapshot 없음) ─────────
console.log('\n[ 3. proxy fallback — 구형 payload ]');
const legacyBaseline = JSON.parse(JSON.stringify(baseline.result));
delete legacyBaseline._compat.baseline_deep_evidence_snapshot;

try {
  const refinedFallback = buildCameraRefinedResult(legacyBaseline, mockCamera);
  refinedFallback.result?.primary_type
    ? PASS(`fallback refined.result.primary_type = ${refinedFallback.result.primary_type}`)
    : FAIL('fallback primary_type 없음');
  refinedFallback.refined_meta?.result_stage === 'refined'
    ? PASS('fallback result_stage = refined')
    : FAIL(`fallback result_stage = ${refinedFallback.refined_meta?.result_stage}`);
} catch (e) {
  FAIL(`proxy fallback 실패: ${e.message}`);
}

// ─── 4. _compat 자체가 없는 구형 payload ─────────────────────
console.log('\n[ 4. _compat 없는 완전 구형 payload ]');
const noCompatBaseline = JSON.parse(JSON.stringify(baseline.result));
delete noCompatBaseline._compat;

try {
  const refinedNoCompat = buildCameraRefinedResult(noCompatBaseline, mockCamera);
  refinedNoCompat.result?.primary_type
    ? PASS(`no-compat fallback primary_type = ${refinedNoCompat.result.primary_type}`)
    : FAIL('no-compat fallback primary_type 없음');
} catch (e) {
  FAIL(`_compat 없는 payload refine 실패: ${e.message}`);
}

console.log('\n' + '═'.repeat(60));
if (process.exitCode === 1) {
  console.log('  결과: FAIL (위 항목 확인 필요)');
} else {
  console.log('  결과: 전체 통과');
}
console.log('═'.repeat(60) + '\n');
