/**
 * FLOW-03 — Result -> Login/Pay Bridge Smoke Tests
 *
 * DB/Stripe 연결 없이 검증 가능한 항목:
 *
 *  1. public-result-bridge.ts 존재 및 export
 *  2. useExecutionStartBridge 훅 — /execution/start canonical 진입점
 *  3. ExecutionStartClient — Stripe/pilot 분기 단일 소유
 *  4. postAuthRouting — /execution/start 시 readiness 무시 계약
 *  5. onboarding-prep 페이지 존재 (레거시 호환)
 *  6. stripe-cancel 페이지 존재
 *  7. Stripe checkout/success ALLOWED_NEXT_PREFIXES — /onboarding + /onboarding-prep
 *  8. Stripe checkout cancelNext 파라미터
 *  9. baseline/refined — 움직임 리셋 CTA 및 useExecutionStartBridge
 * 10. buildOnboardingPrepUrl (레거시 /onboarding-prep 호환)
 * 11. saveBridgeContext / loadBridgeContext / clearBridgeContext
 * 12. /movement-test ALLOWED_NEXT_PREFIXES (cancel 복귀용)
 * 13. deep_test_attempts 의존 없음
 *
 * 실행: node scripts/flow-03-result-login-pay-bridge-smoke.mjs
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

function readFile(relPath) {
  return readFileSync(join(projectRoot, relPath), 'utf-8');
}

function fileExists(relPath) {
  try {
    readFileSync(join(projectRoot, relPath));
    return true;
  } catch {
    return false;
  }
}

console.log('\n[FLOW-03 Smoke] Result -> Login/Pay Bridge\n');

run('public-result-bridge.ts 존재 및 export', () => {
  const src = readFile('src/lib/public-results/public-result-bridge.ts');
  const errs = [];
  if (!src.includes('saveBridgeContext')) errs.push('saveBridgeContext 없음');
  if (!src.includes('loadBridgeContext')) errs.push('loadBridgeContext 없음');
  if (!src.includes('clearBridgeContext')) errs.push('clearBridgeContext 없음');
  if (!src.includes('buildOnboardingPrepUrl')) errs.push('buildOnboardingPrepUrl 없음');
  return errs;
});

run('useExecutionStartBridge — /execution/start canonical', () => {
  const src = readFile('src/lib/public-results/useExecutionStartBridge.ts');
  const errs = [];
  if (!src.includes('useExecutionStartBridge')) errs.push('useExecutionStartBridge 없음');
  if (!src.includes('/execution/start')) errs.push('/execution/start 경로 없음');
  if (!src.includes('/app/auth?next=')) errs.push('/app/auth next 없음');
  if (src.includes('appendContinueExecutionParam')) errs.push('appendContinueExecutionParam 잔류');
  if (src.includes('buildOnboardingPrepUrl')) errs.push('buildOnboardingPrepUrl 잔류');
  if (src.includes('/api/stripe/checkout')) errs.push('훅에 checkout 호출 금지');
  return errs;
});

run('ExecutionStartClient 존재 — checkout 분기 단일 소유', () => {
  if (!fileExists('src/app/execution/start/ExecutionStartClient.tsx')) {
    return ['ExecutionStartClient 없음'];
  }
  const src = readFile('src/app/execution/start/ExecutionStartClient.tsx');
  const errs = [];
  if (!src.includes('/api/stripe/checkout')) errs.push('checkout 호출 필요');
  if (!src.includes("next: '/onboarding'")) errs.push('next onboarding 없음');
  if (!src.includes('cancelNext:')) errs.push('cancelNext 없음');
  if (!src.includes('/movement-test/baseline')) errs.push('cancel baseline 없음');
  if (!src.includes('redeemPilotAccessClient')) errs.push('pilot redeem 필요');
  if (!src.includes('/app/auth')) errs.push('/app/auth 진입 필요');
  return errs;
});

run('postAuthRouting — /execution/start 우선', () => {
  const src = readFile('src/lib/readiness/postAuthRouting.ts');
  const errs = [];
  if (!src.includes('/execution/start')) errs.push('/execution/start 예외 없음');
  if (!src.includes('isExecutionStartFallback')) errs.push('isExecutionStartFallback 권장');
  return errs;
});

run('onboarding-prep 페이지 존재 (레거시)', () => {
  return fileExists('src/app/onboarding-prep/page.tsx') ? [] : ['onboarding-prep page 없음'];
});

run('stripe-cancel 페이지 존재', () => {
  return fileExists('src/app/payments/stripe-cancel/page.tsx') ? [] : ['stripe-cancel page 없음'];
});

run('Stripe checkout — /onboarding ALLOWED', () => {
  const src = readFile('src/app/api/stripe/checkout/route.ts');
  return src.includes("'/onboarding'") ? [] : ['/onboarding 없음'];
});

run('Stripe checkout — /onboarding-prep ALLOWED', () => {
  const src = readFile('src/app/api/stripe/checkout/route.ts');
  return src.includes("'/onboarding-prep'") ? [] : ['/onboarding-prep 없음'];
});

run('Stripe success — /onboarding ALLOWED', () => {
  const src = readFile('src/app/payments/stripe-success/StripeSuccessClient.tsx');
  return src.includes("'/onboarding'") ? [] : ['/onboarding 없음'];
});

run('Stripe success — /onboarding-prep ALLOWED', () => {
  const src = readFile('src/app/payments/stripe-success/StripeSuccessClient.tsx');
  return src.includes("'/onboarding-prep'") ? [] : ['/onboarding-prep 없음'];
});

run('Stripe checkout — cancelNext 파라미터', () => {
  const src = readFile('src/app/api/stripe/checkout/route.ts');
  const errs = [];
  if (!src.includes('cancelNextFromBody')) errs.push('cancelNextFromBody 파싱 없음');
  if (!src.includes('cancelNext')) errs.push('cancelNext 사용 없음');
  return errs;
});

run('baseline page — 움직임 리셋 시작하기 CTA', () => {
  const src = readFile('src/app/movement-test/baseline/page.tsx');
  const errs = [];
  if (!src.includes('움직임 리셋 시작하기')) errs.push('CTA 문자열 없음');
  if (!src.includes('useExecutionStartBridge')) errs.push('useExecutionStartBridge import 없음');
  if (src.includes('ResumeExecutionGate')) errs.push('ResumeExecutionGate 잔류');
  return errs;
});

run('refined page — 움직임 리셋 시작하기 CTA', () => {
  const src = readFile('src/app/movement-test/refined/page.tsx');
  const errs = [];
  if (!src.includes('움직임 리셋 시작하기')) errs.push('CTA 문자열 없음');
  if (!src.includes('useExecutionStartBridge')) errs.push('useExecutionStartBridge import 없음');
  if (src.includes('ResumeExecutionGate')) errs.push('ResumeExecutionGate 잔류');
  return errs;
});

run('buildOnboardingPrepUrl — publicResultId/stage', () => {
  const src = readFile('src/lib/public-results/public-result-bridge.ts');
  return src.includes('publicResultId') && src.includes('stage')
    ? []
    : ['buildOnboardingPrepUrl 시그니처 불완전'];
});

run('/movement-test ALLOWED (cancel 복귀)', () => {
  const src = readFile('src/app/api/stripe/checkout/route.ts');
  return src.includes("'/movement-test'") ? [] : ['/movement-test 없음'];
});

run('bridge — deep_test_attempts 의존 없음', () => {
  const bridge = readFile('src/lib/public-results/public-result-bridge.ts');
  const hook = readFile('src/lib/public-results/useExecutionStartBridge.ts');
  const errs = [];
  if (bridge.includes('deep_test_attempts')) errs.push('bridge에 deep_test_attempts 참조');
  if (hook.includes('deep_test_attempts')) errs.push('hook에 deep_test_attempts 참조');
  return errs;
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`  Total : ${passed + failed}`);
console.log(`  Pass  : ${passed}`);
console.log(`  Fail  : ${failed}`);
console.log('─'.repeat(50));

if (failed > 0) {
  console.error('\n[FLOW-03] 실패한 테스트가 있습니다.\n');
  process.exit(1);
} else {
  console.log('\n[FLOW-03] 모든 smoke test 통과.\n');
}
