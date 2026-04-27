/**
 * FLOW-08 — App Entry / Next-Action Rewire Smoke Test
 *
 * 구조적 정합성 및 entry 재배선 계약을 검증.
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

console.log('\n=== FLOW-08: App Entry / Next-Action Rewire Smoke Test ===\n');

// 1. 신규/수정 파일 존재 확인
console.log('[1] 파일 존재 확인');
assert(
  'fetchReadinessClient.ts 존재',
  existsSync(resolve(root, 'src/lib/readiness/fetchReadinessClient.ts'))
);
assert(
  'ReadinessEntryGate.tsx 존재',
  existsSync(resolve(root, 'src/app/app/_components/ReadinessEntryGate.tsx'))
);

// 2. ReadinessEntryGate 내용 확인
console.log('\n[2] ReadinessEntryGate 검증');
const gate = readSrc('src/app/app/_components/ReadinessEntryGate.tsx');
assert('ReadinessEntryGate export', gate?.includes('export default function ReadinessEntryGate'));
assert('GO_RESULT → /movement-test/baseline', gate?.includes('/movement-test/baseline'));
assert("GO_ONBOARDING → /onboarding", gate?.includes("'/onboarding'"));
assert("GO_AUTH → /app/auth", gate?.includes("'/app/auth'"));
assert('GO_SESSION_CREATE → /session-preparing', gate?.includes("'/session-preparing'"));
assert('gating 초기 true (readiness 전 children 비노출)', gate?.includes('useState(true)'));
assert('checkedRef 중복 방지 (sessionStorage 하드 스킵 없음)', gate?.includes('checkedRef') && !gate?.includes('isReadinessAlreadyChecked'));
assert('fetchReadinessClient 사용', gate?.includes('fetchReadinessClient'));
assert('pass-through에서 markReadinessChecked', gate?.includes('markReadinessChecked'));
assert('fetch 실패 시 pass-through', gate?.includes('if (!readiness)'));

// 3. fetchReadinessClient 확인
console.log('\n[3] fetchReadinessClient 검증');
const fetcher = readSrc('src/lib/readiness/fetchReadinessClient.ts');
assert('fetchReadinessClient export', fetcher?.includes('export async function fetchReadinessClient'));
assert('SessionReadinessV1 타입 re-export', fetcher?.includes('export type { SessionReadinessV1 }'));
assert('Bearer token 사용', fetcher?.includes('Bearer'));
assert('실패 시 null 반환 (best-effort)', fetcher?.includes('return null'));

// 4. /app/(tabs)/home/page.tsx ReadinessEntryGate 통합 확인
console.log('\n[4] /app/home page ReadinessEntryGate 통합 확인');
const homePage = readSrc('src/app/app/(tabs)/home/page.tsx');
assert('ReadinessEntryGate import', homePage?.includes('ReadinessEntryGate'));
assert('ReadinessEntryGate로 HomePageClient 감쌈', homePage?.includes('<ReadinessEntryGate>'));

// 5. AppAuthGate paywall CTA 교체 확인
console.log('\n[5] AppAuthGate paywall CTA 교체 확인');
const authGate = readSrc('src/app/app/_components/AppAuthGate.tsx');
assert('구 paid-first CTA 제거 (/deep-analysis?pay=1)', !authGate?.includes('/deep-analysis?pay=1'));
assert('새 public-first CTA (/movement-test/baseline)', authGate?.includes('/movement-test/baseline'));
assert('실행 권한 안내 문구', authGate?.includes('실행 권한'));

// 6. onboarding-complete에서 readiness 체크 초기화
console.log('\n[6] onboarding-complete readiness 체크 초기화 확인');
const onboardingComplete = readSrc('src/app/onboarding-complete/page.tsx');
assert('clearReadinessCheck import', onboardingComplete?.includes('clearReadinessCheck'));
assert('claim 완료 후 clearReadinessCheck 호출', onboardingComplete?.includes('clearReadinessCheck()'));

// 7. 실행 core 변경 없음 확인 (HomePageClient 미수정)
console.log('\n[7] 실행 core 무수정 확인');
const homeClient = readSrc('src/app/app/(tabs)/home/_components/HomePageClient.tsx');
assert('HomePageClient에 ReadinessEntryGate 미포함 (core 분리)', !homeClient?.includes('ReadinessEntryGate'));
assert('HomePageClient에 fetchReadinessClient 미포함', !homeClient?.includes('fetchReadinessClient'));

// 8. AppAuthGate 기존 auth 로직 유지 확인
console.log('\n[8] AppAuthGate 기존 auth 로직 유지 확인');
assert('auth check 유지', authGate?.includes("setStatus('auth')"));
assert('allowed 상태 유지', authGate?.includes("setStatus('allowed')"));
assert('router.replace auth?next redirect 유지', authGate?.includes('router.replace('));

// 9. FLOW-07 readiness API 연결 확인
console.log('\n[9] readiness API 연결 확인');
assert('fetchReadinessClient가 /api/readiness 호출', fetcher?.includes("'/api/readiness'"));
assert('ReadinessEntryGate가 PR-FLOW-06 next_action 사용', gate?.includes('SessionReadinessNextAction'));

// 10. deep-test rerun 기본 경로 없음 확인
console.log('\n[10] deep-test rerun 기본 경로 없음 확인');
assert('ReadinessEntryGate에 deep-test 없음', !gate?.includes('/app/deep-test'));
assert('fetchReadinessClient에 deep-test 없음', !fetcher?.includes('deep-test'));

console.log(`\n=== 결과: ${passed} 통과 / ${passed + failed} 총 ===\n`);

if (failed > 0) {
  console.error(`FAIL: ${failed}개 실패`);
  process.exit(1);
} else {
  console.log('모든 smoke test 통과.\n');
}
