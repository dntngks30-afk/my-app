/**
 * FLOW-01 — Public Result Persistence Smoke Tests
 *
 * DB 연결 없이 검증 가능한 항목:
 * 1. Deep Result V2 validation이 저장 전 게이트 역할을 하는지
 * 2. invalid payload → PublicResultValidationError 발생
 * 3. valid baseline result → createPublicResult 인수 조립 정상
 * 4. valid refined result → createPublicResult 인수 조립 정상
 * 5. anon-id 헬퍼 (getOrCreateAnonId 구조 검증)
 * 6. migration 파일 존재 및 핵심 DDL 포함 여부
 * 7. API route 파일 구조 검증
 * 8. baseline/refined page가 persistPublicResult import하는지
 * 9. 저장 실패 시 UX 블로킹 없는 패턴 (best-effort catch 존재)
 * 10. deep_test_attempts와 분리되어 있는지
 *
 * 실행: npx tsx scripts/flow-01-public-result-persistence-smoke.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

let passed = 0;
let failed = 0;

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

async function runAsync(label, fn) {
  try {
    const errs = await fn();
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

function readFile(relPath) {
  return readFileSync(join(projectRoot, relPath), 'utf-8');
}

// ─── 픽스처 ──────────────────────────────────────────────────────────────────

function makeValidBaselineResult() {
  return {
    primary_type: 'LOWER_INSTABILITY',
    secondary_type: 'CORE_CONTROL_DEFICIT',
    priority_vector: { lower_stability: 0.8, trunk_control: 0.4, lower_mobility: 0.2, upper_mobility: 0.1, asymmetry: 0.1 },
    pain_mode: 'none',
    confidence: 0.72,
    evidence_level: 'partial',
    source_mode: 'free_survey',
    missing_signals: ['pain_intensity_missing'],
    reason_codes: ['top_axis_lower_stability'],
    summary_copy: '하체 안정성 신호가 두드러집니다.',
    _compat: { scoring_version: 'free_survey_v2_core' },
  };
}

function makeValidRefinedResult() {
  return {
    ...makeValidBaselineResult(),
    source_mode: 'camera',
    evidence_level: 'partial',
    summary_copy: '동작 분석을 통해 확인되었습니다.',
    _compat: { scoring_version: 'camera_fusion_v2' },
  };
}

function makeInvalidResult() {
  return {
    // primary_type 누락
    confidence: 0.5,
    evidence_level: 'partial',
    source_mode: 'free_survey',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 순수 로직 파일만 dynamic import (Supabase 종속 없음)
  const { validateUnifiedDeepResultV2 } = await import(
    '../src/lib/result/deep-result-v2-contract.ts'
  );
  const { buildFreeSurveyBaselineResult } = await import(
    '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
  );
  const { buildCameraRefinedResult } = await import(
    '../src/lib/deep-v2/builders/build-camera-refined-result.ts'
  );

  // createPublicResult.ts는 Supabase import로 module-load 실패 가능
  // → validation 로직만 순수 함수로 재현해서 검증
  function testValidationGate(result) {
    const { valid, errors } = validateUnifiedDeepResultV2(result);
    if (!valid) {
      const err = new Error(`Public Result V2 validation failed:\n${errors.join('\n')}`);
      err.name = 'PublicResultValidationError';
      throw err;
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  FLOW-01 Public Result Persistence Smoke Tests');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Deep Result V2 Validation Gate
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[ 1. Deep Result V2 Validation Gate ]');

  run('valid baseline result → validation passes', () => {
    const { valid, errors } = validateUnifiedDeepResultV2(makeValidBaselineResult());
    if (!valid) return errors;
    return [];
  });

  run('valid refined result → validation passes', () => {
    const { valid, errors } = validateUnifiedDeepResultV2(makeValidRefinedResult());
    if (!valid) return errors;
    return [];
  });

  run('invalid result (missing primary_type) → validation fails', () => {
    const { valid } = validateUnifiedDeepResultV2(makeInvalidResult());
    if (valid) return ['invalid result should not pass validation'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. createPublicResult 인수 조립 검증 (DB 없이 validation 경로만)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 2. createPublicResult 인수 조립 ]');

  run('invalid result → validation gate throws (PublicResultValidationError)', () => {
    try {
      testValidationGate(makeInvalidResult());
      return ['should have thrown PublicResultValidationError'];
    } catch (e) {
      if (e?.name === 'PublicResultValidationError') return [];
      return [`expected PublicResultValidationError, got ${e?.name}`];
    }
  });

  run('valid baseline result → validation gate passes', () => {
    try {
      testValidationGate(makeValidBaselineResult());
      return [];
    } catch (e) {
      return [`unexpected error: ${e?.message}`];
    }
  });

  run('valid refined result → validation gate passes', () => {
    try {
      testValidationGate(makeValidRefinedResult());
      return [];
    } catch (e) {
      return [`unexpected error: ${e?.message}`];
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. createPublicResult.ts 구조 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 3. createPublicResult.ts 구조 ]');

  const createUtilContent = readFile('src/lib/public-results/createPublicResult.ts');

  run('public_results 테이블 INSERT (deep_test_attempts 아님)', () => {
    if (!createUtilContent.includes(".from('public_results')"))
      return ["should .from('public_results')"];
    // 코드에서 실제 deep_test_attempts 테이블 쿼리가 없어야 함 (주석 언급은 허용)
    if (createUtilContent.includes(".from('deep_test_attempts')"))
      return ['should NOT .from(deep_test_attempts)'];
    return [];
  });

  run('getServerSupabaseAdmin 사용 (service role)', () => {
    if (!createUtilContent.includes('getServerSupabaseAdmin'))
      return ['should use getServerSupabaseAdmin'];
    return [];
  });

  run('validateUnifiedDeepResultV2 호출 (저장 전 검증)', () => {
    if (!createUtilContent.includes('validateUnifiedDeepResultV2'))
      return ['should validate before insert'];
    return [];
  });

  run('PublicResultValidationError 클래스 정의', () => {
    if (!createUtilContent.includes('class PublicResultValidationError'))
      return ['PublicResultValidationError class missing'];
    return [];
  });

  run('user_id nullable (anon-first 설계)', () => {
    if (!createUtilContent.includes('userId ?? null'))
      return ['user_id should be nullable (userId ?? null)'];
    return [];
  });

  run('result_stage 필드 저장', () => {
    if (!createUtilContent.includes('result_stage'))
      return ['result_stage should be stored'];
    return [];
  });

  run('confidence_normalized 저장', () => {
    if (!createUtilContent.includes('confidence_normalized'))
      return ['confidence_normalized should be stored'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Migration 파일 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 4. Migration 파일 ]');

  const migrationContent = readFile('supabase/migrations/202603270000_flow01_public_results.sql');

  run('public_results 테이블 CREATE', () => {
    if (!migrationContent.includes('CREATE TABLE IF NOT EXISTS public.public_results'))
      return ['migration should create public_results table'];
    return [];
  });

  run('anon_id 컬럼 존재', () => {
    if (!migrationContent.includes('anon_id'))
      return ['migration should have anon_id column'];
    return [];
  });

  run('user_id nullable 컬럼 존재', () => {
    if (!migrationContent.includes('user_id'))
      return ['migration should have user_id column'];
    return [];
  });

  run('result_v2_json JSONB 타입', () => {
    if (!migrationContent.includes('result_v2_json') || !migrationContent.includes('JSONB'))
      return ['migration should have result_v2_json JSONB'];
    return [];
  });

  run('result_stage CHECK constraint', () => {
    if (!migrationContent.includes("CHECK (result_stage IN ('baseline', 'refined'))"))
      return ['migration should have result_stage check constraint'];
    return [];
  });

  run('claimed_at nullable 컬럼 (FLOW-05 준비)', () => {
    if (!migrationContent.includes('claimed_at'))
      return ['migration should have claimed_at for FLOW-05'];
    return [];
  });

  run('anon_id 인덱스 존재', () => {
    if (!migrationContent.includes('idx_public_results_anon_id'))
      return ['migration should have anon_id index'];
    return [];
  });

  run('RLS 활성화', () => {
    if (!migrationContent.includes('ENABLE ROW LEVEL SECURITY'))
      return ['migration should enable RLS'];
    return [];
  });

  run('deep_test_attempts FK/관계 없음 (분리 보장)', () => {
    // 주석 언급은 허용, 실제 REFERENCES/FK 없어야 함
    if (migrationContent.includes('REFERENCES public.deep_test_attempts') ||
        migrationContent.includes('REFERENCES deep_test_attempts'))
      return ['migration should NOT have FK to deep_test_attempts'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. API Route 구조 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 5. API Route (/api/public-results) ]');

  const apiContent = readFile('src/app/api/public-results/route.ts');

  run('POST handler 존재', () => {
    if (!apiContent.includes('export async function POST'))
      return ['POST handler missing'];
    return [];
  });

  run('anonId 필수 검증', () => {
    if (!apiContent.includes('anonId'))
      return ['anonId validation missing'];
    return [];
  });

  run('stage 검증 (baseline/refined)', () => {
    if (!apiContent.includes("stage !== 'baseline' && stage !== 'refined'"))
      return ['stage validation missing'];
    return [];
  });

  run('PublicResultValidationError → 400 응답', () => {
    if (!apiContent.includes('PublicResultValidationError'))
      return ['PublicResultValidationError handling missing'];
    if (!apiContent.includes('status: 400'))
      return ['should return 400 for validation error'];
    return [];
  });

  run('201 Created 응답', () => {
    if (!apiContent.includes('status: 201'))
      return ['should return 201 on success'];
    return [];
  });

  run('인증 optional (getCurrentUserId + catch)', () => {
    if (!apiContent.includes('getCurrentUserId'))
      return ['getCurrentUserId not used'];
    if (!apiContent.includes('.catch('))
      return ['getCurrentUserId should have catch (auth is optional)'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. anon-id 헬퍼 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 6. Anon ID 헬퍼 ]');

  const anonIdContent = readFile('src/lib/public-results/anon-id.ts');

  run('getOrCreateAnonId 함수 존재', () => {
    if (!anonIdContent.includes('export function getOrCreateAnonId'))
      return ['getOrCreateAnonId function missing'];
    return [];
  });

  run('localStorage key = moveReAnonId:v1', () => {
    if (!anonIdContent.includes("'moveReAnonId:v1'"))
      return ['ANON_ID_KEY should be moveReAnonId:v1'];
    return [];
  });

  run('SSR 안전 처리 (typeof window)', () => {
    if (!anonIdContent.includes("typeof window === 'undefined'"))
      return ['should handle SSR (typeof window === undefined)'];
    return [];
  });

  run('localStorage 실패 안전 처리 (try/catch)', () => {
    if (!anonIdContent.includes('try {'))
      return ['should handle localStorage access failure'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Public Flow 연결 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 7. Public Flow 연결 (baseline/refined 페이지) ]');

  const baselineContent = readFile('src/app/movement-test/baseline/page.tsx');
  const refinedContent = readFile('src/app/movement-test/refined/page.tsx');

  run('baseline page: persistPublicResult import', () => {
    if (!baselineContent.includes('persistPublicResult'))
      return ['baseline page should import persistPublicResult'];
    return [];
  });

  run('baseline page: stage="baseline" 전달', () => {
    if (!baselineContent.includes("stage: 'baseline'"))
      return ['baseline page should pass stage: baseline'];
    return [];
  });

  run('baseline page: best-effort catch 패턴 (.catch(', () => {
    if (!baselineContent.includes('.catch('))
      return ['baseline page should use .catch() for best-effort'];
    return [];
  });

  run('refined page: persistPublicResult import', () => {
    if (!refinedContent.includes('persistPublicResult'))
      return ['refined page should import persistPublicResult'];
    return [];
  });

  run('refined page: stage="refined" 전달', () => {
    if (!refinedContent.includes("stage: 'refined'"))
      return ['refined page should pass stage: refined'];
    return [];
  });

  run('refined page: best-effort catch 패턴', () => {
    if (!refinedContent.includes('.catch('))
      return ['refined page should use .catch() for best-effort'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. V2-03/V2-05/V2-06 regression
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 8. Regression — V2-03/V2-05/V2-06 ]');

  run('baseline builder 여전히 동작', () => {
    try {
      const b = buildFreeSurveyBaselineResult({ 'v2_C1': 4, 'v2_C2': 4, 'v2_C3': 4 });
      const { valid } = validateUnifiedDeepResultV2(b.result);
      if (!valid) return ['baseline result contract invalid after FLOW-01'];
      return [];
    } catch (e) {
      return [`baseline builder threw: ${e.message}`];
    }
  });

  run('refined builder 여전히 동작', () => {
    try {
      const baseline = buildFreeSurveyBaselineResult({ 'v2_C1': 4, 'v2_C2': 4 }).result;
      const camera = {
        movementType: 'kangaroo', patternSummary: '', avoidItems: [], resetAction: '',
        confidence: 0.85, captureQuality: 'ok', flags: [], retryRecommended: false,
        fallbackMode: null, insufficientSignal: false,
        evaluatorResults: [{
          stepId: 'squat', insufficientSignal: false,
          metrics: [{ name: 'depth', value: 0.3, trend: 'concern' }],
        }],
        resultEvidenceLevel: 'strong_evidence', resultToneMode: 'confident',
        debug: { perExercise: [] },
      };
      const refined = buildCameraRefinedResult(baseline, camera);
      const { valid } = validateUnifiedDeepResultV2(refined.result);
      if (!valid) return ['refined result contract invalid after FLOW-01'];
      return [];
    } catch (e) {
      return [`refined builder threw: ${e.message}`];
    }
  });

  run('PublicResultRenderer 여전히 존재 (V2-06)', () => {
    const content = readFile('src/components/public-result/PublicResultRenderer.tsx');
    if (!content.includes('PublicResultRenderer'))
      return ['PublicResultRenderer missing'];
    return [];
  });

  // ─── 결과 요약 ─────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
