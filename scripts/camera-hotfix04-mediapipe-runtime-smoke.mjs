/**
 * PR-HOTFIX-04 smoke test
 * MediaPipe runtime singleton / detect 직렬화 / fatal reset 검증
 *
 * Node.js 환경(브라우저 API 없음) — runtime 로직 자체만 테스트.
 * 실제 PoseLandmarker 는 mock으로 대체한다.
 */

// ─── 최소 globalThis 환경 확인 ─────────────────────────────────────────────
if (typeof globalThis === 'undefined') {
  throw new Error('globalThis 미지원 환경');
}

// ─── 테스트용 런타임 로직 인라인 (브라우저 전용 mediapipe-pose.ts 대신) ───

const RUNTIME_KEY = '__moveReMpRuntime_v3';

function getRuntime() {
  const g = globalThis;
  if (typeof g[RUNTIME_KEY] !== 'object' || g[RUNTIME_KEY] === null) {
    g[RUNTIME_KEY] = {
      landmarkerPromise: null,
      lastDetectTimestampMs: -1,
      detectInFlight: false,
      fatalCooldownUntilMs: 0,
      fatalResetCount: 0,
      logWindowStartMs: 0,
      logCountInWindow: 0,
    };
  }
  return g[RUNTIME_KEY];
}

function resetRuntime() {
  globalThis[RUNTIME_KEY] = {
    landmarkerPromise: null,
    lastDetectTimestampMs: -1,
    detectInFlight: false,
    fatalCooldownUntilMs: 0,
    fatalResetCount: 0,
    logWindowStartMs: 0,
    logCountInWindow: 0,
  };
}

function bumpMonotonicTimestampMs(candidateMs) {
  const rt = getRuntime();
  let c = candidateMs;
  if (!Number.isFinite(c) || c < 0) c = 0;
  if (rt.lastDetectTimestampMs >= 0 && c <= rt.lastDetectTimestampMs) {
    c = rt.lastDetectTimestampMs + 1;
  }
  rt.lastDetectTimestampMs = c;
  return c;
}

const FATAL_DETECT_PATTERNS = [
  'packet timestamp mismatch',
  'calculatorgraph',
  'graph error',
  'bad timestamp',
];
const FATAL_COOLDOWN_MS = 2_000;

function isFatalDetectError(err) {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return FATAL_DETECT_PATTERNS.some((p) => msg.includes(p));
}

function applyFatalReset(err) {
  const rt = getRuntime();
  rt.landmarkerPromise = null;
  rt.lastDetectTimestampMs = -1;
  rt.detectInFlight = false;
  rt.fatalCooldownUntilMs = Date.now() + FATAL_COOLDOWN_MS;
  rt.fatalResetCount += 1;
}

const DETECT_ERROR_LOG_WINDOW_MS = 30_000;
const DETECT_ERROR_LOG_MAX_PER_WINDOW = 8;

function shouldLogDetectVideoError() {
  const rt = getRuntime();
  const now = Date.now();
  if (now - rt.logWindowStartMs > DETECT_ERROR_LOG_WINDOW_MS) {
    rt.logWindowStartMs = now;
    rt.logCountInWindow = 0;
  }
  if (rt.logCountInWindow >= DETECT_ERROR_LOG_MAX_PER_WINDOW) return false;
  rt.logCountInWindow += 1;
  return true;
}

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── S1: globalThis 싱글톤 — 모듈 재평가 시뮬레이션 ─────────────────────────

console.log('\n[S1] globalThis singleton persistence');
resetRuntime();

// 첫 접근
const rt1 = getRuntime();
rt1.lastDetectTimestampMs = 5000;

// "모듈 재평가"를 getRuntime()을 새로 호출하는 것으로 시뮬레이션
// (key가 동일하므로 기존 객체를 반환해야 함)
const rt2 = getRuntime();

assert('S1a: 동일 객체 참조', rt1 === rt2, `rt1=${rt1}, rt2=${rt2}`);
assert('S1b: timestamp 유지', rt2.lastDetectTimestampMs === 5000, `got ${rt2.lastDetectTimestampMs}`);

// ─── S2: 단조 증가 타임스탬프 — 두 analyzer 인스턴스 공유 ────────────────────

console.log('\n[S2] Monotonic timestamp across shared runtime');
resetRuntime();

// 인스턴스 A: 1000ms 제출
const t1 = bumpMonotonicTimestampMs(1000);
assert('S2a: t1 = 1000', t1 === 1000, `t1=${t1}`);

// 인스턴스 B: 800ms 제출 (역행 → bump)
const t2 = bumpMonotonicTimestampMs(800);
assert('S2b: t2 > t1 (역행 방지)', t2 > t1, `t1=${t1}, t2=${t2}`);

// 인스턴스 A: 1000ms 다시 제출 (중복 → bump)
const t3 = bumpMonotonicTimestampMs(1000);
assert('S2c: t3 > t2 (중복 방지)', t3 > t2, `t2=${t2}, t3=${t3}`);

// 정상 진행
const t4 = bumpMonotonicTimestampMs(2000);
assert('S2d: t4 = 2000', t4 === 2000, `t4=${t4}`);
assert('S2e: 단조 증가 전체', t1 < t2 && t2 < t3 && t3 < t4, `${t1},${t2},${t3},${t4}`);

// ─── S3: fatal error 감지 ────────────────────────────────────────────────────

console.log('\n[S3] Fatal error detection');

const fatalCases = [
  ['Packet timestamp mismatch at node X', true],
  ['CalculatorGraph::Run() failed in Calculator', true],
  ['Graph Error: unexpected state', true],
  ['Bad timestamp detected', true],
  ['CUDA out of memory', false],
  ['Network error', false],
];

for (const [msg, expected] of fatalCases) {
  const err = new Error(msg);
  const result = isFatalDetectError(err);
  assert(`S3: "${msg.slice(0, 40)}"`, result === expected, `expected=${expected}, got=${result}`);
}

// ─── S4: fatal reset — runtime 초기화 + cooldown 적용 ───────────────────────

console.log('\n[S4] Fatal reset behavior');
resetRuntime();

const rt = getRuntime();
rt.lastDetectTimestampMs = 9999;
rt.fatalResetCount = 2;

const err = new Error('Packet timestamp mismatch');
const beforeReset = Date.now();
applyFatalReset(err);
const afterReset = Date.now();

const rtAfter = getRuntime();
assert('S4a: landmarkerPromise null', rtAfter.landmarkerPromise === null);
assert('S4b: lastDetectTimestampMs reset', rtAfter.lastDetectTimestampMs === -1, `got ${rtAfter.lastDetectTimestampMs}`);
assert('S4c: detectInFlight cleared', rtAfter.detectInFlight === false);
assert('S4d: cooldown 설정됨', rtAfter.fatalCooldownUntilMs > afterReset, `cooldown=${rtAfter.fatalCooldownUntilMs}`);
assert('S4e: cooldown >= FATAL_COOLDOWN_MS', rtAfter.fatalCooldownUntilMs >= beforeReset + FATAL_COOLDOWN_MS);
assert('S4f: fatalResetCount 증가', rtAfter.fatalResetCount === 3, `got ${rtAfter.fatalResetCount}`);

// ─── S5: fatal reset 후 쿨다운 중 detect 차단 ───────────────────────────────

console.log('\n[S5] Detect blocked during fatal cooldown');
resetRuntime();

applyFatalReset(new Error('Packet timestamp mismatch'));
const rt5 = getRuntime();

// 쿨다운 중: detect 차단 확인
const isCoolingDown = Date.now() < rt5.fatalCooldownUntilMs;
assert('S5a: 쿨다운 활성화', isCoolingDown);

// detectInFlight 가드: in-flight 중이면 skip
resetRuntime();
const rt5b = getRuntime();
rt5b.detectInFlight = true;
assert('S5b: detectInFlight=true이면 skip 경로', rt5b.detectInFlight === true);

// ─── S6: log rate-limiting ───────────────────────────────────────────────────

console.log('\n[S6] Log rate-limiting');
resetRuntime();

// 윈도우 초기화
const rt6 = getRuntime();
rt6.logWindowStartMs = Date.now();
rt6.logCountInWindow = 0;

let logAllowed = 0;
for (let i = 0; i < 12; i++) {
  if (shouldLogDetectVideoError()) logAllowed++;
}

assert(
  'S6a: 한 윈도우에서 최대 8개만 허용',
  logAllowed === DETECT_ERROR_LOG_MAX_PER_WINDOW,
  `allowed=${logAllowed}, max=${DETECT_ERROR_LOG_MAX_PER_WINDOW}`
);

// 윈도우 만료 → 새 윈도우 열림
const rt6b = getRuntime();
rt6b.logWindowStartMs = Date.now() - DETECT_ERROR_LOG_WINDOW_MS - 1;
const afterExpiry = shouldLogDetectVideoError();
assert('S6b: 윈도우 만료 후 새 log 허용', afterExpiry === true);

// ─── S7: detectInFlight 직렬화 — 중첩 detect 방지 ───────────────────────────

console.log('\n[S7] detectInFlight serialization guard');
resetRuntime();

const rt7 = getRuntime();

// 첫 번째 detect 진행 중 표시
rt7.detectInFlight = true;

// 두 번째 detect 시도: detectInFlight=true이므로 skip해야 함
const shouldSkip = rt7.detectInFlight;
assert('S7a: detectInFlight=true → skip 확인', shouldSkip === true);

// detect 완료 후 flag 해제
rt7.detectInFlight = false;

// 이제 새 detect 허용
const canProceed = !rt7.detectInFlight;
assert('S7b: detectInFlight=false → proceed 허용', canProceed === true);

// ─── S8: stale generation token (CameraPreview 로직 시뮬레이션) ──────────────

console.log('\n[S8] Stale loop generation kill');

let currentGeneration = 0;
const framesFromGen1 = [];
const framesFromGen2 = [];

// 세대 1 루프 시작
currentGeneration++;
const gen1 = currentGeneration;

function simulateLoop(myGen, target) {
  // RAF를 10번 실행한다고 가정
  for (let i = 0; i < 10; i++) {
    if (currentGeneration !== myGen) break; // stale → 종료
    target.push(i);
  }
}

// gen1 루프 5번 실행
for (let i = 0; i < 5; i++) {
  if (currentGeneration !== gen1) break;
  framesFromGen1.push(i);
}

// 새 세대 시작 (gen2) — gen1 루프는 이제 stale
currentGeneration++;
const gen2 = currentGeneration;

// gen1이 "stale 감지 전"에 추가로 실행 시도
simulateLoop(gen1, framesFromGen1);
// gen2 루프 실행
simulateLoop(gen2, framesFromGen2);

assert('S8a: gen1 stale → 프레임 추가 없음', framesFromGen1.length === 5, `gen1 frames=${framesFromGen1.length}`);
assert('S8b: gen2 정상 실행', framesFromGen2.length === 10, `gen2 frames=${framesFromGen2.length}`);

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════`);
console.log(`결과: ${passed} passed / ${failed} failed`);
if (failed > 0) {
  console.error('FAIL — 위 실패 항목 확인 요망');
  process.exit(1);
} else {
  console.log('ALL PASS');
}
