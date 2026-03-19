/**
 * FLOW-06 — Session Create Rewire Smoke Test
 *
 * 구조적 정합성 및 경계 계약을 검증.
 * DB/API 연결 없이 파일 존재 + 코드 패턴 검사.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve('.');
let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    failed++;
  }
}

function readSrc(rel) {
  const p = resolve(root, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

console.log('\n=== FLOW-06: Session Create Rewire Smoke Test ===\n');

// 1. 신규 파일 존재 확인
console.log('[1] 신규 파일 존재 확인');
assert(
  'getLatestClaimedPublicResultForUser.ts 존재',
  existsSync(resolve(root, 'src/lib/public-results/getLatestClaimedPublicResultForUser.ts'))
);
assert(
  'buildSessionDeepSummaryFromPublicResult.ts 존재',
  existsSync(resolve(root, 'src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts'))
);

// 2. getLatestClaimedPublicResultForUser 내용 확인
console.log('\n[2] getLatestClaimedPublicResultForUser 검증');
const loader = readSrc('src/lib/public-results/getLatestClaimedPublicResultForUser.ts');
assert('함수 export', loader?.includes('export async function getLatestClaimedPublicResultForUser'));
assert('claimed_at IS NOT NULL 조건', loader?.includes("'claimed_at', 'is', null"));
assert('claimed_at DESC 정렬', loader?.includes("'claimed_at', { ascending: false }"));
assert('validateUnifiedDeepResultV2 검증', loader?.includes('validateUnifiedDeepResultV2'));
assert('안전 fallback (null 반환)', loader?.includes('return null'));
assert('getServerSupabaseAdmin 사용 (service_role)', loader?.includes('getServerSupabaseAdmin'));

// 3. buildSessionDeepSummaryFromPublicResult 내용 확인
console.log('\n[3] buildSessionDeepSummaryFromPublicResult 어댑터 검증');
const adapter = readSrc('src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts');
assert('함수 export', adapter?.includes('export function buildSessionDeepSummaryFromPublicResult'));
assert('_compat.focus_tags 우선 사용', adapter?.includes('compat?.focus_tags'));
assert('_compat.avoid_tags 우선 사용', adapter?.includes('compat?.avoid_tags'));
assert('primary_type 기반 focus 파생 맵 존재', adapter?.includes('PRIMARY_TYPE_FOCUS_MAP'));
assert('evidence_level → deep_level 변환', adapter?.includes('evidenceLevelToDeepLevel'));
assert('pain_mode → safety_mode 변환', adapter?.includes('painModeToSafetyMode'));
assert("source_mode: 'public_result' 관찰가능성", adapter?.includes("source_mode: 'public_result' as const"));
assert('source_public_result_id 포함', adapter?.includes('source_public_result_id'));
assert('SessionDeepSummary 계약 상속', adapter?.includes('extends SessionDeepSummary'));

// 4. session create 라우트 재배선 확인
console.log('\n[4] session create 라우트 재배선 검증');
const createRoute = readSrc('src/app/api/session/create/route.ts');
assert('getLatestClaimedPublicResultForUser import', createRoute?.includes('getLatestClaimedPublicResultForUser'));
assert('buildSessionDeepSummaryFromPublicResult import', createRoute?.includes('buildSessionDeepSummaryFromPublicResult'));
assert('public result 우선 시도 (claimed)', createRoute?.includes('claimedPublicResult'));
assert('legacy fallback 존재', createRoute?.includes('loadSessionDeepSummary'));
assert("analysisSourceMode = 'public_result'", createRoute?.includes("analysisSourceMode = 'public_result'"));
assert("analysisSourceMode = 'legacy_paid_deep'", createRoute?.includes("analysisSourceMode = 'legacy_paid_deep'"));
assert('ANALYSIS_INPUT_UNAVAILABLE 에러', createRoute?.includes('ANALYSIS_INPUT_UNAVAILABLE'));
assert('source_public_result_id trace 기록', createRoute?.includes('source_public_result_id'));
assert('loadSessionDeepSummary 레거시 경로 보존', createRoute?.includes('await loadSessionDeepSummary'));

// 5. ApiErrorCode 신규 코드 확인
console.log('\n[5] ApiErrorCode 확인');
const contract = readSrc('src/lib/api/contract.ts');
assert('ANALYSIS_INPUT_UNAVAILABLE 추가됨', contract?.includes("ANALYSIS_INPUT_UNAVAILABLE: 'ANALYSIS_INPUT_UNAVAILABLE'"));

// 6. FLOW 경계: session create 없음
console.log('\n[6] FLOW 경계 확인');
assert(
  'session create 라우트에 claim 로직 없음',
  !createRoute?.includes('claimPublicResult') &&
  !createRoute?.includes('claimed_at =')
);
assert(
  'session create 라우트에 onboarding form 없음',
  !createRoute?.includes('onboarding-complete') &&
  !createRoute?.includes('exercise_experience_level')
);

// 7. deep_test_attempts 경로 보존 확인
console.log('\n[7] legacy deep_test_attempts 경로 보존 확인');
assert(
  'loadSessionDeepSummary 여전히 import됨',
  createRoute?.includes("import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary'")
);
assert(
  'loadSessionDeepSummary 여전히 호출됨 (legacy fallback)',
  createRoute?.includes('await loadSessionDeepSummary(userId)')
);

// 8. 어댑터가 deep_test_attempts 건드리지 않음
console.log('\n[8] 어댑터 독립성 확인');
assert(
  'loader에 deep_test_attempts 없음',
  !loader?.includes('deep_test_attempts')
);
assert(
  '어댑터에 deep_test_attempts 없음',
  !adapter?.includes('deep_test_attempts')
);

console.log(`\n=== 결과: ${passed} 통과 / ${passed + failed} 총 ===\n`);

if (failed > 0) {
  console.error(`FAIL: ${failed}개 실패`);
  process.exit(1);
} else {
  console.log('모든 smoke test 통과.\n');
}
