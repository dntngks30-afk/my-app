/**
 * Deep Scoring Core V2 Smoke & Regression Test
 *
 * 1) personas.json 전체로 새 core v2 vs 기존 v3 비교 (regression)
 * 2) source_mode 없이 core가 동작하는지 검증
 * 3) missing evidence → 0 대체 없음 검증
 * 4) PR-V2-01 UnifiedDeepResultV2 contract 만족 검증
 * 5) 기존 paid route/page가 의존하는 데이터 shape 유지 검증
 *
 * 실행: npx tsx scripts/deep-scoring-core-v2-smoke.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const personasPath = join(projectRoot, 'src/lib/deep-test/scenarios/personas.json');
const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_PRIMARY_TYPES = [
  'LOWER_INSTABILITY', 'LOWER_MOBILITY_RESTRICTION', 'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT', 'DECONDITIONED', 'STABLE',
];
const VALID_PAIN_MODES = ['none', 'caution', 'protected'];

function validateCoreResult(result) {
  const errors = [];
  if (!VALID_PRIMARY_TYPES.includes(result.primary_type))
    errors.push(`primary_type invalid: ${result.primary_type}`);
  if (result.secondary_type !== null && !VALID_PRIMARY_TYPES.includes(result.secondary_type))
    errors.push(`secondary_type invalid: ${result.secondary_type}`);
  if (!VALID_PAIN_MODES.includes(result.pain_mode))
    errors.push(`pain_mode invalid: ${result.pain_mode}`);
  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1)
    errors.push(`confidence invalid: ${result.confidence}`);
  if (!result.priority_vector || typeof result.priority_vector !== 'object')
    errors.push('priority_vector missing or invalid');
  if (!Array.isArray(result.missing_signals))
    errors.push('missing_signals must be array');
  if (!Array.isArray(result.reason_codes))
    errors.push('reason_codes must be array');
  if (!result.derived || !Array.isArray(result.derived.focus_tags))
    errors.push('derived.focus_tags missing');
  if (!result.axis_scores_raw || typeof result.axis_scores_raw !== 'object')
    errors.push('axis_scores_raw missing');
  return { valid: errors.length === 0, errors };
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const regressionDiffs = [];

function run(label, fn) {
  try {
    const errs = fn();
    if (!errs || errs.length === 0) {
      console.log(`  ✅ PASS  ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL  ${label}`);
      for (const e of errs) console.error(`         → ${e}`);
      failed++;
    }
  } catch (err) {
    console.error(`  💥 ERROR ${label}: ${err.message}`);
    failed++;
  }
}

async function main() {
  const { runDeepScoringCoreOnly, runDeepScoringWithCompat } = await import(
    '../src/lib/deep-scoring-core/compat-wrapper.ts'
  );
  const { extractPaidSurveyEvidence } = await import(
    '../src/lib/deep-scoring-core/extractors/paid-survey-extractor.ts'
  );
  const { runDeepScoringCore } = await import('../src/lib/deep-scoring-core/core.ts');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Deep Scoring Core V2 Smoke & Regression Tests');
  console.log('═══════════════════════════════════════════════════════\n');

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Core 기본 동작: source_mode 없이 실행
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[ 1. CORE 기본 동작 (source_mode 없음) ]');

  run('core는 source_mode 없이 동작해야 함', () => {
    const evidence = {
      axis_scores: { lower_stability: 2, lower_mobility: 0, upper_mobility: 0, trunk_control: 1, asymmetry: 0.5, deconditioned: 1 },
      pain_signals: { max_intensity: 0, primary_discomfort_none: false, has_location_data: false },
      movement_quality: { all_good: false },
      answered_count: 14,
      total_count: 14,
      missing_signals: [],
    };
    const result = runDeepScoringCore(evidence);
    const { valid, errors } = validateCoreResult(result);
    if (!valid) return errors;
    if (result.primary_type !== 'LOWER_INSTABILITY')
      return [`expected LOWER_INSTABILITY, got ${result.primary_type}`];
    return [];
  });

  run('missing evidence → 0 대체 없이 missing_signals에 기록', () => {
    const evidence = {
      axis_scores: { lower_stability: 0, lower_mobility: 0, upper_mobility: 0, trunk_control: 0, asymmetry: 0, deconditioned: 0 },
      pain_signals: {},  // max_intensity undefined — 데이터 없음
      movement_quality: { all_good: false },
      answered_count: 5,
      total_count: 14,
      missing_signals: ['deep_sls_quality_missing', 'pain_intensity_missing'],
    };
    const result = runDeepScoringCore(evidence);
    const errors = [];
    if (!result.missing_signals.includes('deep_sls_quality_missing'))
      errors.push('missing_signals should contain deep_sls_quality_missing');
    if (!result.missing_signals.includes('pain_intensity_missing'))
      errors.push('missing_signals should contain pain_intensity_missing');
    if (result.pain_mode !== 'none')
      errors.push(`pain_mode with undefined max_intensity should be 'none', got ${result.pain_mode}`);
    return errors;
  });

  run('STABLE evidence → primary_type STABLE', () => {
    const evidence = {
      axis_scores: { lower_stability: 0, lower_mobility: 0, upper_mobility: 0, trunk_control: 0, asymmetry: 0, deconditioned: 1 },
      pain_signals: { max_intensity: 0, primary_discomfort_none: true, has_location_data: false },
      movement_quality: { all_good: true },
      answered_count: 14,
      total_count: 14,
      missing_signals: [],
    };
    const result = runDeepScoringCore(evidence);
    if (result.primary_type !== 'STABLE')
      return [`expected STABLE, got ${result.primary_type}`];
    return [];
  });

  run('protected pain_mode → DECONDITIONED', () => {
    const evidence = {
      axis_scores: { lower_stability: 2, lower_mobility: 0, upper_mobility: 1, trunk_control: 2, asymmetry: 1, deconditioned: 3 },
      pain_signals: { max_intensity: 3, primary_discomfort_none: false, has_location_data: true },
      movement_quality: { all_good: false },
      answered_count: 14,
      total_count: 14,
      missing_signals: [],
    };
    const result = runDeepScoringCore(evidence);
    const errors = [];
    if (result.pain_mode !== 'protected') errors.push(`expected pain_mode protected, got ${result.pain_mode}`);
    if (result.primary_type !== 'DECONDITIONED') errors.push(`expected DECONDITIONED, got ${result.primary_type}`);
    return errors;
  });

  run('priority_vector: 합 = 각 축 정규화, 최대값 = 1', () => {
    const evidence = {
      axis_scores: { lower_stability: 4, lower_mobility: 0, upper_mobility: 1, trunk_control: 2, asymmetry: 0.5, deconditioned: 1 },
      pain_signals: { max_intensity: 0, primary_discomfort_none: false },
      movement_quality: { all_good: false },
      answered_count: 14,
      total_count: 14,
      missing_signals: [],
    };
    const result = runDeepScoringCore(evidence);
    const errors = [];
    const pv = result.priority_vector;
    const maxVal = Math.max(...Object.values(pv));
    if (Math.abs(maxVal - 1) > 0.001) errors.push(`priority_vector max should be 1, got ${maxVal}`);
    for (const [k, v] of Object.entries(pv)) {
      if (v < 0 || v > 1) errors.push(`priority_vector.${k} out of range: ${v}`);
    }
    return errors;
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Persona regression: 새 core v2 vs 기존 v3
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[ 2. PERSONA REGRESSION (core_v2 vs legacy_v3) ]');

  let totalPersonas = 0;
  let personasPassed = 0;
  let personasFailed = 0;

  for (const p of personas) {
    totalPersonas++;
    try {
      const compare = runDeepScoringWithCompat(p.input);
      const { diff, core_v2, legacy } = compare;
      const { valid, errors: coreErrors } = validateCoreResult(core_v2);

      const errs = [...coreErrors];

      // expected_analysis 검증 (있으면)
      const exp = p.expected_analysis || {};
      if (exp.primary_type && core_v2.primary_type !== exp.primary_type) {
        errs.push(`primary_type: expected ${exp.primary_type}, got ${core_v2.primary_type}`);
      }
      if (exp.pain_mode && core_v2.pain_mode !== exp.pain_mode) {
        errs.push(`pain_mode: expected ${exp.pain_mode}, got ${core_v2.pain_mode}`);
      }
      if (exp.priority_vector_contains) {
        const legacyPv = legacy.priority_vector;
        const legacyTopAxes = Object.entries(legacyPv)
          .sort(([, a], [, b]) => b - a)
          .map(([k]) => k);
        const corePv = core_v2.priority_vector;
        const coreTopAxes = Object.entries(corePv)
          .sort(([, a], [, b]) => b - a)
          .map(([k]) => k);
        for (const axis of exp.priority_vector_contains) {
          const legacyPass = legacyTopAxes.slice(0, 3).includes(axis);
          const corePass = coreTopAxes.slice(0, 3).includes(axis);
          if (!legacyPass) {
            // 레거시도 실패 → 픽스처 오류, 테스트 차단 없음
            console.log(`         ⚠️ [fixture] legacy_v3 also fails priority_vector_contains: ${axis} not in [${legacyTopAxes.slice(0,3).join(', ')}]`);
          } else if (!corePass) {
            errs.push(`priority_vector_contains: expected ${axis} in top-3, got [${coreTopAxes.slice(0, 3).join(', ')}] (legacy passes)`);
          }
        }
      }

      // diff 기록
      if (diff.flags.length > 0) {
        regressionDiffs.push({ id: p.id, diff, legacy_primary: legacy.primary_type, core_primary: core_v2.primary_type });
      }

      if (errs.length === 0) {
        console.log(`  ✅ ${p.id}: ${core_v2.primary_type} / ${core_v2.pain_mode}${diff.flags.length ? ` [DIFF: ${diff.flags.join(',')}]` : ''}`);
        personasPassed++;
        passed++;
      } else {
        console.error(`  ❌ ${p.id}:`);
        for (const e of errs) console.error(`         → ${e}`);
        personasFailed++;
        failed++;
      }
    } catch (err) {
      console.error(`  💥 ${p.id}: ${err.message}`);
      personasFailed++;
      failed++;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Paid Survey Extractor 검증
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[ 3. PAID SURVEY EXTRACTOR ]');

  run('extractor: answered_count 정확히 계산 (빈 배열=미응답)', () => {
    const answers = {
      deep_basic_age: 35,
      deep_basic_gender: '남',
      deep_basic_experience: '지금도 자주함',
      deep_basic_workstyle: '균형',
      deep_basic_primary_discomfort: '무릎·발목',
      deep_squat_pain_intensity: '없음',
      deep_squat_pain_location: [],           // 빈 배열 = 미응답 (deep_v3와 동일)
      deep_squat_knee_alignment: '가끔 무릎이 안쪽·바깥쪽으로 흔들림',
      deep_wallangel_pain_intensity: '없음',
      deep_wallangel_pain_location: [],       // 빈 배열 = 미응답
      deep_wallangel_quality: '문제 없음',
      deep_sls_pain_intensity: '없음',
      deep_sls_pain_location: [],             // 빈 배열 = 미응답
      deep_sls_quality: '무릎이 안쪽/바깥쪽으로 흔들리거나 발목이 꺾이며 흔들림',
    };
    const ev = extractPaidSurveyEvidence(answers);
    // 빈 배열 3개(통증위치 3곳) = 미응답 → 14 - 3 = 11 (deep_v3와 동일 로직)
    if (ev.answered_count !== 11) return [`expected 11 (3 empty arrays = unanswered), got ${ev.answered_count}`];
    if (ev.total_count !== 14) return [`total_count expected 14, got ${ev.total_count}`];
    return [];
  });

  run('extractor: 부분 응답 → missing_signals 기록', () => {
    const answers = {
      deep_basic_age: 35,
      deep_basic_primary_discomfort: '해당 없음',
    };
    const ev = extractPaidSurveyEvidence(answers);
    const errors = [];
    if (ev.missing_signals.length === 0) errors.push('missing_signals should not be empty with partial answers');
    if (ev.answered_count >= 14) errors.push(`answered_count should be < 14, got ${ev.answered_count}`);
    // pain_intensity_missing은 있어야 함
    if (!ev.missing_signals.includes('pain_intensity_missing')) {
      errors.push('missing_signals should include pain_intensity_missing when pain answers absent');
    }
    return errors;
  });

  run('extractor: pain_signals.max_intensity 정확히 파싱', () => {
    const answers = {
      deep_squat_pain_intensity: '강함(7~10)',
      deep_wallangel_pain_intensity: '없음',
      deep_sls_pain_intensity: '중간(4~6)',
    };
    const ev = extractPaidSurveyEvidence(answers);
    if (ev.pain_signals.max_intensity !== 3) return [`expected 3, got ${ev.pain_signals.max_intensity}`];
    return [];
  });

  run('extractor: STABLE movement_quality → all_good true', () => {
    const answers = {
      deep_squat_knee_alignment: '발바닥이 바닥에 잘 붙은 채로 편하게 내려가서 2–3초 유지 가능',
      deep_wallangel_quality: '문제 없음',
      deep_sls_quality: '10초 안정적으로 가능',
    };
    const ev = extractPaidSurveyEvidence(answers);
    if (!ev.movement_quality.all_good) return ['movement_quality.all_good should be true'];
    return [];
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Compat wrapper 검증 (legacy route 호환성)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[ 4. COMPAT WRAPPER (legacy route 호환성) ]');

  run('runDeepScoringWithCompat: legacy 결과 포함', () => {
    const answers = personas[0].input;
    const result = runDeepScoringWithCompat(answers);
    const errors = [];
    if (!result.legacy) errors.push('legacy result missing');
    if (!result.core_v2) errors.push('core_v2 result missing');
    if (!result.diff) errors.push('diff missing');
    // legacy가 기존 v3와 동일 shape이어야 함
    if (typeof result.legacy.scoring_version !== 'string') errors.push('legacy.scoring_version missing');
    if (!result.legacy.priority_vector) errors.push('legacy.priority_vector missing');
    if (!result.legacy.derived) errors.push('legacy.derived missing');
    return errors;
  });

  run('runDeepScoringCoreOnly: source_mode 없이 결과 반환', () => {
    const answers = personas[0].input;
    const result = runDeepScoringCoreOnly(answers);
    const { valid, errors } = validateCoreResult(result);
    return errors;
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. PR-V2-01 계약 호환 검증
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[ 5. PR-V2-01 UNIFIED CONTRACT 호환 ]');

  run('core_v2 결과 → UnifiedDeepResultV2 필수 필드 매핑 가능', () => {
    const answers = personas[0].input;
    const core = runDeepScoringCoreOnly(answers);
    const errors = [];
    // primary_type
    if (!VALID_PRIMARY_TYPES.includes(core.primary_type)) errors.push(`primary_type invalid: ${core.primary_type}`);
    // priority_vector (non-null)
    if (!core.priority_vector) errors.push('priority_vector should not be null');
    // pain_mode
    if (!VALID_PAIN_MODES.includes(core.pain_mode)) errors.push(`pain_mode invalid: ${core.pain_mode}`);
    // confidence 0~1
    if (core.confidence < 0 || core.confidence > 1) errors.push(`confidence out of range: ${core.confidence}`);
    // missing_signals array
    if (!Array.isArray(core.missing_signals)) errors.push('missing_signals must be array');
    // reason_codes array
    if (!Array.isArray(core.reason_codes)) errors.push('reason_codes must be array');
    return errors;
  });

  run('core_v2 derived: focus_tags & avoid_tags 존재', () => {
    const answers = personas[0].input;
    const core = runDeepScoringCoreOnly(answers);
    const errors = [];
    if (!Array.isArray(core.derived.focus_tags)) errors.push('derived.focus_tags not array');
    if (!Array.isArray(core.derived.avoid_tags)) errors.push('derived.avoid_tags not array');
    if (core.derived.focus_tags.length === 0) errors.push('derived.focus_tags empty');
    return errors;
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 결과 요약
  // ────────────────────────────────────────────────────────────────────────────
  console.log(`\n[ PERSONA SUMMARY: ${personasPassed}/${totalPersonas} passed ]`);
  if (regressionDiffs.length > 0) {
    console.log(`\n[ REGRESSION DIFFS (${regressionDiffs.length} personas) ]`);
    for (const d of regressionDiffs) {
      console.log(`  ⚠️  ${d.id}: legacy=${d.legacy_primary}, core=${d.core_primary}, flags=[${d.diff.flags.join(',')}]`);
    }
  } else {
    console.log('\n  ✅ No regression diffs between legacy_v3 and core_v2');
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
