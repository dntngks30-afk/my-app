/**
 * FLOW-04 — Post-Pay Onboarding Smoke Tests
 *
 * DB 연결 없이 검증 가능한 항목:
 *
 *  1. migration 파일 존재 및 session_user_profile 확장
 *  2. profile.ts — exercise_experience_level, pain_or_discomfort_present
 *  3. session/profile API — 새 필드 수락
 *  4. onboarding 페이지 존재
 *  5. onboarding-complete 페이지 존재
 *  6. onboarding-prep — "실행 준비하기" CTA 및 /onboarding 연결
 *  7. onboarding — target_frequency, experience, pain 필드
 *  8. onboarding — /api/session/profile 호출
 *  9. result_v2_json / public_results에 onboarding 저장 없음
 * 10. deep_test_attempts 의존 없음
 *
 * 실행: npx tsx scripts/flow-04-post-pay-onboarding-smoke.mjs
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

console.log('\n[FLOW-04 Smoke] Post-Pay Onboarding\n');

run('migration — session_user_profile 확장', () => {
  const src = readFile('supabase/migrations/202603280000_flow04_onboarding_session_profile.sql');
  const errs = [];
  if (!src.includes('exercise_experience_level')) errs.push('exercise_experience_level 없음');
  if (!src.includes('pain_or_discomfort_present')) errs.push('pain_or_discomfort_present 없음');
  return errs;
});

run('profile.ts — 새 타입/검증', () => {
  const src = readFile('src/lib/session/profile.ts');
  const errs = [];
  if (!src.includes('exercise_experience_level')) errs.push('exercise_experience_level 없음');
  if (!src.includes('pain_or_discomfort_present')) errs.push('pain_or_discomfort_present 없음');
  if (!src.includes('isValidExerciseExperienceLevel')) errs.push('isValidExerciseExperienceLevel 없음');
  return errs;
});

run('session/profile API — 새 필드 수락', () => {
  const src = readFile('src/app/api/session/profile/route.ts');
  const errs = [];
  if (!src.includes('exercise_experience_level')) errs.push('exercise_experience_level 없음');
  if (!src.includes('pain_or_discomfort_present')) errs.push('pain_or_discomfort_present 없음');
  return errs;
});

run('onboarding 페이지 존재', () => {
  return fileExists('src/app/onboarding/page.tsx') ? [] : ['onboarding page 없음'];
});

run('onboarding-complete 페이지 존재', () => {
  return fileExists('src/app/onboarding-complete/page.tsx') ? [] : ['onboarding-complete 없음'];
});

run('onboarding-prep — 실행 준비하기 → /onboarding', () => {
  const src = readFile('src/app/onboarding-prep/page.tsx');
  const errs = [];
  if (!src.includes('실행 준비하기')) errs.push('실행 준비하기 CTA 없음');
  if (!src.includes('/onboarding')) errs.push('/onboarding 연결 없음');
  return errs;
});

run('onboarding — target_frequency, experience, pain', () => {
  const src = readFile('src/app/onboarding/page.tsx');
  const errs = [];
  if (!src.includes('target_frequency')) errs.push('target_frequency 없음');
  if (!src.includes('exercise_experience_level')) errs.push('exercise_experience_level 없음');
  if (!src.includes('pain_or_discomfort_present')) errs.push('pain_or_discomfort_present 없음');
  return errs;
});

run('onboarding — /api/session/profile 호출', () => {
  const src = readFile('src/app/onboarding/page.tsx');
  return src.includes('/api/session/profile') ? [] : ['profile API 호출 없음'];
});

run('onboarding — result_v2_json에 저장 안 함', () => {
  const onboarding = readFile('src/app/onboarding/page.tsx');
  const profile = readFile('src/app/api/session/profile/route.ts');
  const errs = [];
  if (onboarding.includes('result_v2_json')) errs.push('onboarding이 result_v2_json 참조');
  if (profile.includes('public_results')) errs.push('profile API가 public_results 참조');
  return errs;
});

run('onboarding — deep_test_attempts 의존 없음', () => {
  const src = readFile('src/app/onboarding/page.tsx');
  return src.includes('deep_test_attempts') ? ['deep_test_attempts 참조 존재'] : [];
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`  Total : ${passed + failed}`);
console.log(`  Pass  : ${passed}`);
console.log(`  Fail  : ${failed}`);
console.log('─'.repeat(50));

if (failed > 0) {
  console.error('\n[FLOW-04] 실패한 테스트가 있습니다.\n');
  process.exit(1);
} else {
  console.log('\n[FLOW-04] 모든 smoke test 통과.\n');
}
