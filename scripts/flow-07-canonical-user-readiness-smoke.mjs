/**
 * FLOW-07 — Canonical User Readiness Smoke Test
 *
 * 구조적 정합성 및 readiness 계약을 검증.
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

console.log('\n=== FLOW-07: Canonical User Readiness Smoke Test ===\n');

// 1. 파일 존재 확인
console.log('[1] 신규 파일 존재 확인');
assert(
  'getCanonicalUserReadiness.ts 존재',
  existsSync(resolve(root, 'src/lib/readiness/getCanonicalUserReadiness.ts'))
);
assert(
  'GET /api/readiness/route.ts 존재',
  existsSync(resolve(root, 'src/app/api/readiness/route.ts'))
);
assert(
  'get-session-readiness.ts 존재 (PR-FLOW-06 SSOT)',
  existsSync(resolve(root, 'src/lib/readiness/get-session-readiness.ts'))
);

// 2. readiness 유틸 구조 확인
console.log('\n[2] getCanonicalUserReadiness + getSessionReadiness 검증');
const util = readSrc('src/lib/readiness/getCanonicalUserReadiness.ts');
const ssot = readSrc('src/lib/readiness/get-session-readiness.ts');
assert('getCanonicalUserReadiness export', util?.includes('export async function getCanonicalUserReadiness'));
assert('UNAUTHENTICATED_READINESS export', util?.includes('export const UNAUTHENTICATED_READINESS'));
assert('CanonicalUserReadiness 타입 export', util?.includes('export interface CanonicalUserReadiness'));
assert('NextActionCode 타입 정의', util?.includes("export type NextActionCode"));
assert('getSessionReadiness export', ssot?.includes('export async function getSessionReadiness'));
assert('loadReadinessContext export', ssot?.includes('export async function loadReadinessContext'));

// 3. 접근(access) 상태 확인
console.log('\n[3] access 상태 검증');
assert("has_active_plan 필드", util?.includes('has_active_plan'));
assert("plan_status 조회", util?.includes("plan_status"));
assert("plan_status === 'active' 확인", ssot?.includes("=== 'active'"));

// 4. 분석(analysis) 상태 확인
console.log('\n[4] analysis 상태 검증');
assert('getLatestClaimedPublicResultForUser 사용', ssot?.includes('getLatestClaimedPublicResultForUser'));
assert('loadSessionDeepSummary legacy fallback', ssot?.includes('loadSessionDeepSummary'));
assert("source_mode 'public_result'", util?.includes("'public_result'"));
assert("source_mode 'legacy_paid_deep'", util?.includes("'legacy_paid_deep'"));
assert('has_claimed_public_result', util?.includes('has_claimed_public_result'));
assert('has_analysis_input', util?.includes('has_analysis_input'));

// 5. 온보딩(onboarding) 상태 확인
console.log('\n[5] onboarding 상태 검증');
assert('has_target_frequency 체크', util?.includes('has_target_frequency'));
assert('has_execution_setup 체크', util?.includes('has_execution_setup'));
assert('missing_fields 반환', util?.includes('missing_fields'));
assert('exercise_experience_level 체크', ssot?.includes('exercise_experience_level'));
assert('pain_or_discomfort_present 체크', ssot?.includes('pain_or_discomfort_present'));

// 6. 세션(session) 상태 확인
console.log('\n[6] session 상태 검증');
assert('can_create_session', util?.includes('can_create_session'));
assert('blocking_reason_code', util?.includes('blocking_reason_code'));
assert('DAILY_LIMIT_REACHED', util?.includes("'DAILY_LIMIT_REACHED'"));
assert('PROGRAM_FINISHED', util?.includes("'PROGRAM_FINISHED'"));
assert('ANALYSIS_INPUT_UNAVAILABLE', util?.includes("'ANALYSIS_INPUT_UNAVAILABLE'"));
assert('FREQUENCY_REQUIRED (타입)', util?.includes("'FREQUENCY_REQUIRED'"));
assert('ONBOARDING_INCOMPLETE', util?.includes("'ONBOARDING_INCOMPLETE'"));
assert('INACTIVE_PLAN', util?.includes("'INACTIVE_PLAN'"));
assert('getTodayCompletedAndNextUnlock 사용', ssot?.includes('getTodayCompletedAndNextUnlock'));

// 7. next_action 도출 확인
console.log('\n[7] next_action 도출 검증');
assert("'login' action", util?.includes("'login'"));
assert("'pay' action", util?.includes("'pay'"));
assert("'claim_result' action", util?.includes("'claim_result'"));
assert("'complete_onboarding' action", util?.includes("'complete_onboarding'"));
assert("'create_session' action", util?.includes("'create_session'"));
assert("'open_app' action", util?.includes("'open_app'"));
assert("'blocked' action", util?.includes("'blocked'"));
assert('deriveNextActionLegacy (레거시 next_action)', util?.includes('function deriveNextActionLegacy'));

// 8. API 라우트 확인
console.log('\n[8] /api/readiness 라우트 검증');
const route = readSrc('src/app/api/readiness/route.ts');
assert('GET export', route?.includes('export async function GET'));
assert('getCurrentUserId 사용', route?.includes('getCurrentUserId'));
assert('미인증 → UNAUTHENTICATED_SESSION_READINESS_V1 반환 (401 아님)', route?.includes('UNAUTHENTICATED_SESSION_READINESS_V1'));
assert('force-dynamic', route?.includes("force-dynamic"));
assert('ok() 사용', route?.includes('return ok('));
assert('getSessionReadiness 호출', route?.includes('getSessionReadiness'));

// 9. READ ONLY 검증: DB 변경 없음
console.log('\n[9] READ ONLY 검증');
assert('claim 로직 없음', !ssot?.includes('claimPublicResult') && !ssot?.includes('claimed_at ='));
assert('session create 로직 없음', !ssot?.includes('INSERT INTO session') && !ssot?.includes('createSession'));
assert('onboarding save 로직 없음', !ssot?.includes('applyTargetFrequency') && !ssot?.includes('.upsert('));

// 10. FLOW-08 준비: 재사용 가능 계약
console.log('\n[10] FLOW-08 준비 확인');
assert('next_action.href 존재 (레거시 Canonical)', util?.includes('href:'));
assert('CanonicalUserReadiness 단일 export (재사용 가능)', util?.includes('export interface CanonicalUserReadiness'));
assert('병렬 DB 조회 (Promise.all)', ssot?.includes('Promise.all'));

console.log(`\n=== 결과: ${passed} 통과 / ${passed + failed} 총 ===\n`);

if (failed > 0) {
  console.error(`FAIL: ${failed}개 실패`);
  process.exit(1);
} else {
  console.log('모든 smoke test 통과.\n');
}
