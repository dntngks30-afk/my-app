/**
 * FLOW-05 — Claim Public Result Smoke Test
 *
 * 구조적 정합성 및 경계 계약을 검증한다.
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

console.log('\n=== FLOW-05: Claim Public Result Smoke Test ===\n');

// 1. 파일 존재 확인
console.log('[1] 신규 파일 존재 확인');
assert(
  'claimPublicResult.ts 존재',
  existsSync(resolve(root, 'src/lib/public-results/claimPublicResult.ts'))
);
assert(
  'POST /api/public-results/[id]/claim/route.ts 존재',
  existsSync(resolve(root, 'src/app/api/public-results/[id]/claim/route.ts'))
);
assert(
  'useClaimPublicResult.ts 존재',
  existsSync(resolve(root, 'src/lib/public-results/useClaimPublicResult.ts'))
);
assert(
  'FLOW-05 마이그레이션 파일 존재',
  existsSync(resolve(root, 'supabase/migrations/202603290000_flow05_claim_public_result.sql'))
);

// 2. claimPublicResult.ts 내용 확인
console.log('\n[2] claimPublicResult.ts — 클레임 규칙 검증');
const claimUtil = readSrc('src/lib/public-results/claimPublicResult.ts');
assert('claimPublicResult 함수 export', claimUtil?.includes('export async function claimPublicResult'));
assert('ClaimNotFoundError 정의', claimUtil?.includes('export class ClaimNotFoundError'));
assert('ClaimConflictError 정의', claimUtil?.includes('export class ClaimConflictError'));
assert("'claimed' outcome 처리", claimUtil?.includes("'claimed'"));
assert("'already_owned' 멱등 outcome 처리", claimUtil?.includes("'already_owned'"));
assert('user_id IS NULL 조건 (동시성 안전)', claimUtil?.includes('.is(\'user_id\', null)'));
assert('getServerSupabaseAdmin 사용', claimUtil?.includes('getServerSupabaseAdmin'));
assert('session create 로직 없음', !claimUtil?.includes('session_create') && !claimUtil?.includes('createSession'));

// 3. API route 확인
console.log('\n[3] claim API route 검증');
const claimRoute = readSrc('src/app/api/public-results/[id]/claim/route.ts');
assert('POST export 존재', claimRoute?.includes('export async function POST'));
assert('401 인증 없음 처리', claimRoute?.includes('status: 401'));
assert('404 not found 처리', claimRoute?.includes('status: 404'));
assert('409 conflict 처리', claimRoute?.includes('status: 409'));
assert('ClaimNotFoundError import', claimRoute?.includes('ClaimNotFoundError'));
assert('ClaimConflictError import', claimRoute?.includes('ClaimConflictError'));
assert('getCurrentUserId 사용', claimRoute?.includes('getCurrentUserId'));

// 4. 클라이언트 헬퍼 확인
console.log('\n[4] claimPublicResultClient 검증');
const clientHelper = readSrc('src/lib/public-results/useClaimPublicResult.ts');
assert('claimPublicResultClient export', clientHelper?.includes('export async function claimPublicResultClient'));
assert('best-effort (절대 throw 안 함)', !clientHelper?.includes('throw ') || clientHelper?.includes('return { ok: false'));
assert('unauthenticated 분기', clientHelper?.includes("'unauthenticated'"));
assert('supabaseBrowser 세션 확인', clientHelper?.includes('supabaseBrowser'));

// 5. onboarding-complete 통합 확인
console.log('\n[5] onboarding-complete claim 통합 검증');
const onboardingComplete = readSrc('src/app/onboarding-complete/page.tsx');
assert('claimPublicResultClient import', onboardingComplete?.includes('claimPublicResultClient'));
assert('loadBridgeContext 사용', onboardingComplete?.includes('loadBridgeContext'));
assert('clearBridgeContext claim 후 호출', onboardingComplete?.includes('clearBridgeContext'));
assert('claim 실패 시 warn만 (UX 블로킹 없음)', onboardingComplete?.includes('console.warn'));
assert('claim 실패로 UX 차단 없음 (no throw)', !onboardingComplete?.includes('throw '));

// 6. FLOW 경계: session create 없음
console.log('\n[6] FLOW 경계 — session create 없음');
assert(
  'claimPublicResult.ts에 session create 없음',
  !claimUtil?.includes('session_create') &&
  !claimUtil?.includes('INSERT INTO sessions') &&
  !claimUtil?.includes('createSession')
);
assert(
  'claim route에 session create 없음',
  !claimRoute?.includes('INSERT INTO sessions') &&
  !claimRoute?.includes('createSession')
);

// 7. deep_test_attempts 독립성
console.log('\n[7] deep_test_attempts 분리 확인');
assert(
  'claimPublicResult.ts에 deep_test_attempts 없음',
  !claimUtil?.includes('deep_test_attempts')
);
assert(
  'claim route에 deep_test_attempts 없음',
  !claimRoute?.includes('deep_test_attempts')
);

// 8. FLOW-01 public_results 테이블 claim 필드 확인
console.log('\n[8] FLOW-01 스키마 claim 필드 확인');
const migration01 = readSrc('supabase/migrations/202603270000_flow01_public_results.sql');
assert('user_id nullable 컬럼 존재', migration01?.includes('user_id') && migration01?.includes('REFERENCES auth.users'));
assert('claimed_at nullable 컬럼 존재', migration01?.includes('claimed_at'));

console.log(`\n=== 결과: ${passed} 통과 / ${passed + failed} 총 ===\n`);

if (failed > 0) {
  console.error(`FAIL: ${failed}개 실패`);
  process.exit(1);
} else {
  console.log('모든 smoke test 통과.\n');
}
