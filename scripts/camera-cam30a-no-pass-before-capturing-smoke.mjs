/**
 * PR-CAM-30A — setup/arming/countdown 에서 pass latch·navigation 불가 정책
 *
 * npx tsx scripts/camera-cam30a-no-pass-before-capturing-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { squatPageExerciseEvaluationActive } = await import(
  '../src/app/movement-test/camera/squat/page.tsx'
);

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}${extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : ''}`);
    process.exitCode = 1;
  }
}

const PRE_CAPTURE = ['setup', 'arming', 'countdown'];

console.log('\n── A. pre-capture phases — exercise evaluation / latch path 비활성 ──');
for (const phase of PRE_CAPTURE) {
  ok(`A-${phase}: squatPageExerciseEvaluationActive false`, squatPageExerciseEvaluationActive(phase) === false, phase);
}

console.log('\n── B. capturing — 평가 소비 허용 ──');
ok('B1: capturing true', squatPageExerciseEvaluationActive('capturing') === true);

console.log('\n── C. 모순 시나리오: not_ready + countdown clip 도중에도 latch 불가(정책) ──');
// 페이지 정책: phase 가 capturing 아니면 latch 불가 — readiness/clip 과 무관
ok('C1: countdown + 정책상 latch 불가', squatPageExerciseEvaluationActive('countdown') === false);
ok('C2: arming + 정책상 latch 불가', squatPageExerciseEvaluationActive('arming') === false);

console.log(`\n━━━ PR-CAM-30A no-pass-before-capturing: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
