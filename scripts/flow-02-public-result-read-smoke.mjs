/**
 * FLOW-02 — Public Result Read / Handoff Smoke Tests
 *
 * DB 연결 없이 검증 가능한 항목:
 *
 *  1. getPublicResult.ts 파일 구조 — 존재·주요 심볼 export
 *  2. GET /api/public-results/[id] 라우트 파일 존재
 *  3. public-result-handoff.ts — localStorage 키/함수 export 검증
 *  4. loadPublicResult.ts — 클라이언트 fetch 헬퍼 존재
 *  5. persistPublicResult.ts — savePublicResultHandoff import 추가 확인
 *  6. baseline page — loadPublicResultHandoff + loadPublicResult import 확인
 *  7. refined page  — loadPublicResultHandoff + loadPublicResult import 확인
 *  8. refined page  — recoveredRefined state 추가 확인
 *  9. getPublicResult — deep_test_attempts 의존 없음
 * 10. getPublicResult — PublicResultNotFoundError / PublicResultInvalidPayloadError export
 * 11. API route — UUID 포맷 검증 코드 존재
 * 12. API route — 404 처리 코드 존재
 * 13. handoff keys — 상수 값 정확성 검증
 * 14. loadPublicResult — null 반환 안전성 (throw 안 함)
 * 15. baseline page — DB 복구 실패 시 기존 local 경로 fallback 유지
 * 16. refined page  — DB 복구 실패 시 기존 local 경로 fallback 유지
 * 17. migration FLOW-01 파일 — RLS "FLOW-02" 예정 주석 포함 확인
 * 18. getPublicResult — anon_id mismatch 시 warn(접근 차단 아님) 패턴
 * 19. persistPublicResult — savePublicResultHandoff 호출 코드 존재
 * 20. renderer 소비 계약 — PublicResultRenderer는 UnifiedDeepResultV2만 소비
 *
 * 실행: npx tsx scripts/flow-02-public-result-read-smoke.mjs
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

// ─── 테스트 ──────────────────────────────────────────────────────────────────

console.log('\n[FLOW-02 Smoke] Public Result Read / Handoff\n');

// 1. getPublicResult.ts 파일 존재 및 주요 심볼 export
run('getPublicResult.ts 존재 및 핵심 export', () => {
  const src = readFile('src/lib/public-results/getPublicResult.ts');
  const errs = [];
  if (!src.includes('export async function getPublicResult'))
    errs.push('getPublicResult 함수 export 없음');
  if (!src.includes('GetPublicResultInput'))
    errs.push('GetPublicResultInput 타입 없음');
  if (!src.includes('GetPublicResultOutput'))
    errs.push('GetPublicResultOutput 타입 없음');
  return errs;
});

// 2. GET /api/public-results/[id] 라우트 파일 존재
run('GET /api/public-results/[id] route 파일 존재', () => {
  const exists = fileExists('src/app/api/public-results/[id]/route.ts');
  return exists ? [] : ['파일 없음: src/app/api/public-results/[id]/route.ts'];
});

// 3. public-result-handoff.ts — 키 상수 및 함수 export
run('public-result-handoff.ts 키/함수 export', () => {
  const src = readFile('src/lib/public-results/public-result-handoff.ts');
  const errs = [];
  if (!src.includes('HANDOFF_KEY_BASELINE'))
    errs.push('HANDOFF_KEY_BASELINE 상수 없음');
  if (!src.includes('HANDOFF_KEY_REFINED'))
    errs.push('HANDOFF_KEY_REFINED 상수 없음');
  if (!src.includes('export function savePublicResultHandoff'))
    errs.push('savePublicResultHandoff 함수 없음');
  if (!src.includes('export function loadPublicResultHandoff'))
    errs.push('loadPublicResultHandoff 함수 없음');
  if (!src.includes('export function clearPublicResultHandoff'))
    errs.push('clearPublicResultHandoff 함수 없음');
  return errs;
});

// 4. loadPublicResult.ts 존재 및 export
run('loadPublicResult.ts 존재 및 export', () => {
  const src = readFile('src/lib/public-results/loadPublicResult.ts');
  const errs = [];
  if (!src.includes('export async function loadPublicResult'))
    errs.push('loadPublicResult 함수 export 없음');
  if (!src.includes('LoadedPublicResult'))
    errs.push('LoadedPublicResult 타입 없음');
  return errs;
});

// 5. persistPublicResult.ts — savePublicResultHandoff import
run('persistPublicResult.ts — savePublicResultHandoff import', () => {
  const src = readFile('src/lib/public-results/persistPublicResult.ts');
  return src.includes('savePublicResultHandoff')
    ? []
    : ['savePublicResultHandoff import 없음'];
});

// 6. baseline page — FLOW-02 imports
run('baseline page — loadPublicResultHandoff + loadPublicResult import', () => {
  const src = readFile('src/app/movement-test/baseline/page.tsx');
  const errs = [];
  if (!src.includes('loadPublicResultHandoff'))
    errs.push('loadPublicResultHandoff import 없음');
  if (!src.includes('loadPublicResult'))
    errs.push('loadPublicResult import 없음');
  return errs;
});

// 7. refined page — FLOW-02 imports
run('refined page — loadPublicResultHandoff + loadPublicResult import', () => {
  const src = readFile('src/app/movement-test/refined/page.tsx');
  const errs = [];
  if (!src.includes('loadPublicResultHandoff'))
    errs.push('loadPublicResultHandoff import 없음');
  if (!src.includes('loadPublicResult'))
    errs.push('loadPublicResult import 없음');
  return errs;
});

// 8. refined page — recoveredRefined state 추가
run('refined page — recoveredRefined state 존재', () => {
  const src = readFile('src/app/movement-test/refined/page.tsx');
  return src.includes('recoveredRefined')
    ? []
    : ['recoveredRefined state 없음'];
});

// 9. getPublicResult.ts — deep_test_attempts 의존 없음
run('getPublicResult.ts — deep_test_attempts 의존 없음', () => {
  const src = readFile('src/lib/public-results/getPublicResult.ts');
  return src.includes('deep_test_attempts')
    ? ['deep_test_attempts 참조 존재 (분리 위반)']
    : [];
});

// 10. getPublicResult — 에러 클래스 export
run('getPublicResult — PublicResultNotFoundError / InvalidPayloadError export', () => {
  const src = readFile('src/lib/public-results/getPublicResult.ts');
  const errs = [];
  if (!src.includes('export class PublicResultNotFoundError'))
    errs.push('PublicResultNotFoundError 없음');
  if (!src.includes('export class PublicResultInvalidPayloadError'))
    errs.push('PublicResultInvalidPayloadError 없음');
  return errs;
});

// 11. API route — UUID 포맷 검증 코드
run('GET route — UUID 포맷 검증 로직 존재', () => {
  const src = readFile('src/app/api/public-results/[id]/route.ts');
  return src.includes('uuidPattern') || src.includes('UUID')
    ? []
    : ['UUID 포맷 검증 코드 없음'];
});

// 12. API route — 404 처리
run('GET route — 404 응답 코드 존재', () => {
  const src = readFile('src/app/api/public-results/[id]/route.ts');
  return src.includes('status: 404') || src.includes("{ status: 404 }")
    ? []
    : ['404 응답 처리 없음'];
});

// 13. handoff 키 값 정확성
run('handoff 키 값 — moveRePublicResultId:v1:baseline/refined', () => {
  const src = readFile('src/lib/public-results/public-result-handoff.ts');
  const errs = [];
  if (!src.includes('moveRePublicResultId:v1:baseline'))
    errs.push('baseline 키 값 불일치');
  if (!src.includes('moveRePublicResultId:v1:refined'))
    errs.push('refined 키 값 불일치');
  return errs;
});

// 14. loadPublicResult — null 반환 안전성 (throw 없음)
run('loadPublicResult — null 반환 best-effort (throw 없음)', () => {
  const src = readFile('src/lib/public-results/loadPublicResult.ts');
  // throw를 의도적으로 쓰는 곳 없어야 함 (try/catch 안 제외)
  // try-catch 내부에서 재throw하지 않는 패턴 확인
  const errs = [];
  if (!src.includes('return null'))
    errs.push('null 반환 경로 없음');
  // catch 블록이 있고 throw하지 않음
  if (!src.includes('catch'))
    errs.push('오류 처리 catch 블록 없음');
  return errs;
});

// 15. baseline page — fallback: 기존 로컬 계산 경로 유지
run('baseline page — loadSurveyAnswers fallback 경로 유지', () => {
  const src = readFile('src/app/movement-test/baseline/page.tsx');
  const errs = [];
  if (!src.includes('loadSurveyAnswers'))
    errs.push('loadSurveyAnswers 로컬 경로 제거됨 (regression)');
  if (!src.includes('buildFreeSurveyBaselineResult'))
    errs.push('buildFreeSurveyBaselineResult 로컬 경로 제거됨 (regression)');
  return errs;
});

// 16. refined page — fallback: 기존 로컬 계산 경로 유지
run('refined page — loadSurveyAnswers + buildCameraRefinedResult fallback 유지', () => {
  const src = readFile('src/app/movement-test/refined/page.tsx');
  const errs = [];
  if (!src.includes('loadSurveyAnswers'))
    errs.push('loadSurveyAnswers 로컬 경로 제거됨 (regression)');
  if (!src.includes('buildCameraRefinedResult'))
    errs.push('buildCameraRefinedResult 로컬 경로 제거됨 (regression)');
  return errs;
});

// 17. FLOW-01 migration — FLOW-02 SELECT 정책 예정 주석
run('FLOW-01 migration — FLOW-02 SELECT 정책 예정 주석 존재', () => {
  const src = readFile('supabase/migrations/202603270000_flow01_public_results.sql');
  return src.includes('FLOW-02')
    ? []
    : ['FLOW-02 예정 주석 없음'];
});

// 18. getPublicResult — anon_id mismatch 시 warn(차단 아님) 패턴
run('getPublicResult — anon_id mismatch warn(접근 차단 아님)', () => {
  const src = readFile('src/lib/public-results/getPublicResult.ts');
  const errs = [];
  // console.warn이 있어야 함
  if (!src.includes('console.warn'))
    errs.push('anon_id mismatch warn 없음');
  // data.anon_id 불일치 검사 코드가 있어야 함
  if (!src.includes('data.anon_id'))
    errs.push('data.anon_id 참조 없음 (mismatch 체크 없음)');
  // warn 메시지에 'anon_id' 키워드가 포함되어야 함
  if (!src.includes('anon_id mismatch') && !src.includes('anon_id !== anonId'))
    errs.push('anon_id mismatch 또는 불일치 체크 텍스트 없음');
  return errs;
});

// 19. persistPublicResult — savePublicResultHandoff 호출 코드
run('persistPublicResult — savePublicResultHandoff 호출 존재', () => {
  const src = readFile('src/lib/public-results/persistPublicResult.ts');
  return src.includes('savePublicResultHandoff(')
    ? []
    : ['savePublicResultHandoff 호출 없음'];
});

// 20. PublicResultRenderer — UnifiedDeepResultV2 소비 계약 유지
run('PublicResultRenderer — UnifiedDeepResultV2 소비 계약 유지', () => {
  const src = readFile('src/components/public-result/PublicResultRenderer.tsx');
  return src.includes('result: UnifiedDeepResultV2')
    ? []
    : ['UnifiedDeepResultV2 prop 없음 (renderer 계약 위반)'];
});

// ─── 요약 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`  Total : ${passed + failed}`);
console.log(`  Pass  : ${passed}`);
console.log(`  Fail  : ${failed}`);
console.log('─'.repeat(50));

if (failed > 0) {
  console.error('\n[FLOW-02] 실패한 테스트가 있습니다. 위 오류를 확인하세요.\n');
  process.exit(1);
} else {
  console.log('\n[FLOW-02] 모든 smoke test 통과.\n');
}
