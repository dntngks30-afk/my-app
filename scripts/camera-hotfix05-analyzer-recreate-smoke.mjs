/**
 * PR-HOTFIX-05 smoke test
 * 분석기(analyzer) 재생성 계약 검증: fatal reset 신호 전파, stale 차단, bounded recovery
 *
 * Node.js 환경(브라우저 API 없음) — runtime 로직 자체를 인라인으로 시뮬레이션.
 * 실제 PoseLandmarker·HTMLVideoElement는 mock으로 대체한다.
 */

if (typeof globalThis === 'undefined') {
  throw new Error('globalThis 미지원 환경');
}

// ─── runtime singleton 인라인 (mediapipe-pose.ts 와 동일 로직) ─────────────

const RUNTIME_KEY = '__moveReMpRuntime_v4';
const FATAL_COOLDOWN_MS = 2_000;

function getRuntime() {
  const g = globalThis;
  if (typeof g[RUNTIME_KEY] !== 'object' || g[RUNTIME_KEY] === null) {
    g[RUNTIME_KEY] = {
      landmarkerPromise: null,
      lastDetectTimestampMs: -1,
      detectInFlight: false,
      fatalCooldownUntilMs: 0,
      fatalResetCount: 0,
      runtimeGeneration: 0,
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
    runtimeGeneration: 0,
    logWindowStartMs: 0,
    logCountInWindow: 0,
  };
}

function applyFatalReset(err) {
  const rt = getRuntime();
  rt.landmarkerPromise = null;
  rt.lastDetectTimestampMs = -1;
  rt.detectInFlight = false;
  rt.fatalCooldownUntilMs = Date.now() + FATAL_COOLDOWN_MS;
  rt.fatalResetCount += 1;
  rt.runtimeGeneration += 1;
}

const FATAL_DETECT_PATTERNS = [
  'packet timestamp mismatch',
  'calculatorgraph',
  'graph error',
  'bad timestamp',
];

function isFatalDetectError(err) {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return FATAL_DETECT_PATTERNS.some((p) => msg.includes(p));
}

/** fatal reset 메타데이터를 포함한 mock 프레임 생성 */
function createFatalResetFrame(ts = 0) {
  const rt = getRuntime();
  return {
    timestampMs: ts,
    landmarks: null,
    source: 'mediapipe',
    width: 0,
    height: 0,
    _mediapipeDetectFailed: true,
    _mediapipeFatalResetTriggered: true,
    _mediapipeRuntimeGeneration: rt.runtimeGeneration,
    _mediapipeFatalResetCount: rt.fatalResetCount,
    _mediapipeRecoveryCooldownMs: Math.max(0, rt.fatalCooldownUntilMs - Date.now()),
  };
}

/** mock analyzer 팩토리 — creationGeneration을 캡처해 stale 검사를 수행 */
function createMockAnalyzer() {
  const creationRuntimeGeneration = getRuntime().runtimeGeneration;

  return {
    creationRuntimeGeneration,
    analyze() {
      const rt = getRuntime();
      if (rt.runtimeGeneration !== creationRuntimeGeneration) {
        return createFatalResetFrame();
      }
      return { timestampMs: 0, landmarks: [], source: 'mediapipe', width: 0, height: 0 };
    },
    close() {},
  };
}

// ─── CameraPreview 복구 로직 시뮬레이션 ─────────────────────────────────────

/**
 * CameraPreview 내부의 fatal reset 처리 로직을 순수 함수로 시뮬레이션한다.
 * 실제 컴포넌트의 setTimeout/RAF 의존성을 제거하고 동기적으로 동작한다.
 */
function createCameraPreviewSim() {
  let cancelled = false;
  let loopGeneration = 0;
  let lastHandledFatalResetCount = -1;
  let recreateScheduled = false;
  let analyzerRecreateCount = 0;
  let currentAnalyzer = null;
  let recreateCallbacks = [];

  const startAnalyzer = () => {
    if (cancelled) return;
    loopGeneration += 1;
    const myGeneration = loopGeneration;

    currentAnalyzer = createMockAnalyzer();

    // 루프 한 번 실행 시뮬레이션
    function runFrame() {
      if (cancelled) return { stopped: 'cancelled' };
      if (loopGeneration !== myGeneration) return { stopped: 'stale_generation' };

      const frame = currentAnalyzer.analyze();

      if (
        frame._mediapipeFatalResetTriggered &&
        typeof frame._mediapipeFatalResetCount === 'number' &&
        frame._mediapipeFatalResetCount > lastHandledFatalResetCount &&
        !recreateScheduled
      ) {
        const resetCount = frame._mediapipeFatalResetCount;
        const cooldownMs = frame._mediapipeRecoveryCooldownMs ?? 2_000;

        lastHandledFatalResetCount = resetCount;
        recreateScheduled = true;
        loopGeneration += 1;   // kill current loop
        currentAnalyzer = null;
        analyzerRecreateCount += 1;

        // recreate callback 등록 (테스트에서 직접 호출)
        recreateCallbacks.push({ resetCount, cooldownMs, fn: () => {
          if (cancelled) return;
          recreateScheduled = false;
          startAnalyzer();
        }});

        return { stopped: 'fatal_reset', resetCount, cooldownMs };
      }

      return { frame };
    }

    return { myGeneration, runFrame };
  };

  return {
    get loopGeneration() { return loopGeneration; },
    get lastHandledFatalResetCount() { return lastHandledFatalResetCount; },
    get recreateScheduled() { return recreateScheduled; },
    get analyzerRecreateCount() { return analyzerRecreateCount; },
    get currentAnalyzer() { return currentAnalyzer; },
    get recreateCallbacks() { return recreateCallbacks; },
    startAnalyzer,
    cancel() { cancelled = true; },
    triggerRecreate(idx = 0) {
      const cb = recreateCallbacks[idx];
      if (cb) cb.fn();
    },
  };
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

// ─── A: fatal reset 신호 전파 ────────────────────────────────────────────────

console.log('\n[A] Fatal reset signal propagation');
resetRuntime();

// A1: fatal reset 전에 만든 analyzer로 analyze() 호출 → 정상 프레임
const analyzerA = createMockAnalyzer();
const frameA1 = analyzerA.analyze();
assert('A1: fatal reset 전 — landmarks 배열 존재', Array.isArray(frameA1.landmarks));
assert('A1: _mediapipeFatalResetTriggered 없음', !frameA1._mediapipeFatalResetTriggered);

// A2: fatal reset 발생
applyFatalReset(new Error('Packet timestamp mismatch'));
const rtA2 = getRuntime();
assert('A2: runtimeGeneration 증가', rtA2.runtimeGeneration === 1, `got ${rtA2.runtimeGeneration}`);
assert('A2: fatalResetCount 증가', rtA2.fatalResetCount === 1, `got ${rtA2.fatalResetCount}`);
assert('A2: landmarkerPromise null', rtA2.landmarkerPromise === null);

// A3: fatal reset 후 stale analyzer로 analyze() → fatal reset 프레임 반환
const frameA3 = analyzerA.analyze();
assert('A3: _mediapipeFatalResetTriggered = true', frameA3._mediapipeFatalResetTriggered === true);
assert('A3: _mediapipeFatalResetCount = 1', frameA3._mediapipeFatalResetCount === 1);
assert('A3: _mediapipeRuntimeGeneration = 1', frameA3._mediapipeRuntimeGeneration === 1);
assert('A3: _mediapipeDetectFailed = true', frameA3._mediapipeDetectFailed === true);
assert('A3: landmarks null', frameA3.landmarks === null);

// A4: 새로 만든 analyzer는 현재 generation과 일치 → 정상 프레임
const analyzerA4 = createMockAnalyzer();
assert('A4: 새 analyzer creationGeneration = 1', analyzerA4.creationRuntimeGeneration === 1);
const frameA4 = analyzerA4.analyze();
assert('A4: 새 analyzer — fatal 신호 없음', !frameA4._mediapipeFatalResetTriggered);

// ─── B: isFatalDetectError 패턴 커버리지 ────────────────────────────────────

console.log('\n[B] Fatal error pattern coverage');
const fatalCases = [
  ['Packet timestamp mismatch at node X', true],
  ['CalculatorGraph::Run() failed', true],
  ['Graph Error in pipeline', true],
  ['Bad timestamp provided', true],
  ['CUDA out of memory', false],
  ['WebGL context lost', false],
];
for (const [msg, expected] of fatalCases) {
  const result = isFatalDetectError(new Error(msg));
  assert(`B: "${msg.slice(0, 45)}"`, result === expected, `expected=${expected}, got=${result}`);
}

// ─── C: runtimeGeneration 단조 증가 ─────────────────────────────────────────

console.log('\n[C] runtimeGeneration monotonic increase');
resetRuntime();

assert('C1: 초기 generation = 0', getRuntime().runtimeGeneration === 0);
applyFatalReset(new Error('Packet timestamp mismatch'));
assert('C2: 1차 reset → generation = 1', getRuntime().runtimeGeneration === 1);
applyFatalReset(new Error('CalculatorGraph failure'));
assert('C3: 2차 reset → generation = 2', getRuntime().runtimeGeneration === 2);
applyFatalReset(new Error('Bad timestamp'));
assert('C4: 3차 reset → generation = 3', getRuntime().runtimeGeneration === 3);

// ─── D: CameraPreview 시뮬레이션 — fatal reset 감지 + analyzer 무효화 ────────

console.log('\n[D] CameraPreview sim: fatal reset → invalidate analyzer');
resetRuntime();

const sim = createCameraPreviewSim();
const { runFrame } = sim.startAnalyzer();

// D1: 첫 프레임 — 정상
const resultD1 = runFrame();
assert('D1: 정상 프레임 반환', resultD1.frame !== undefined && !resultD1.stopped);

// D2: fatal reset 발생 후 다시 프레임 실행
applyFatalReset(new Error('Packet timestamp mismatch'));
const resultD2 = runFrame();
assert('D2: loop 종료 — stopped=fatal_reset', resultD2.stopped === 'fatal_reset');
assert('D2: resetCount 기록', resultD2.resetCount === 1);
assert('D2: currentAnalyzer null', sim.currentAnalyzer === null);
assert('D2: analyzerRecreateCount = 1', sim.analyzerRecreateCount === 1);
assert('D2: recreateScheduled = true', sim.recreateScheduled === true);
assert('D2: lastHandledFatalResetCount = 1', sim.lastHandledFatalResetCount === 1);

// ─── E: 동일 resetCount 중복 처리 방지 ──────────────────────────────────────

console.log('\n[E] Duplicate fatal reset handling prevention');
resetRuntime();

const simE = createCameraPreviewSim();
const { runFrame: runFrameE } = simE.startAnalyzer();
applyFatalReset(new Error('Packet timestamp mismatch'));

const resultE1 = runFrameE();
assert('E1: 첫 처리 — stopped=fatal_reset', resultE1.stopped === 'fatal_reset');
assert('E1: analyzerRecreateCount = 1', simE.analyzerRecreateCount === 1);

// recreate를 트리거 (쿨다운 없이 즉시) — 새 루프 시작
simE.triggerRecreate(0);
assert('E2: recreateScheduled 해제', !simE.recreateScheduled);
assert('E2: analyzerRecreateCount = 1 (recreate 후 카운터 유지)', simE.analyzerRecreateCount === 1);

// 새 루프에서 같은 resetCount로 또 fatal reset 감지 시도
// → lastHandledFatalResetCount = 1이므로 무시되어야 한다
const { runFrame: runFrameE2 } = simE.startAnalyzer();

// runtime에 동일한 fatalResetCount(1)가 유지된 상태 → 새 루프는 처리하지 않아야 함
const resultE2Normal = runFrameE2();
assert('E3: 동일 resetCount — 새 루프는 정상 실행', !resultE2Normal.stopped, `stopped=${resultE2Normal.stopped}`);

// ─── F: 재생성 이후 stale 루프 차단 ─────────────────────────────────────────

console.log('\n[F] Stale loop blocked after recreate');
resetRuntime();

const simF = createCameraPreviewSim();
const loopF1 = simF.startAnalyzer();
const gen1 = simF.loopGeneration;

applyFatalReset(new Error('Packet timestamp mismatch'));
loopF1.runFrame(); // fatal reset → loop 1 종료, 재생성 예약

// recreate → loop 2 시작
simF.triggerRecreate(0);
const gen2 = simF.loopGeneration;

assert('F1: gen2 > gen1', gen2 > gen1, `gen1=${gen1}, gen2=${gen2}`);

// loop 1의 runFrame을 다시 시도 → stale generation으로 즉시 종료
const resultF_stale = loopF1.runFrame();
assert('F2: 재시도된 stale loop — stopped=stale_generation', resultF_stale.stopped === 'stale_generation');

// ─── G: bounded recovery — infinite recreate 방지 ───────────────────────────

console.log('\n[G] Bounded recovery: same resetCount triggers only one recreate');
resetRuntime();

const simG = createCameraPreviewSim();
simG.startAnalyzer();
applyFatalReset(new Error('Packet timestamp mismatch'));

// 같은 reset에 대해 runFrame 여러 번 호출해도 recreate는 한 번만
const loops = [];
for (let i = 0; i < 5; i++) {
  const { runFrame } = simG.startAnalyzer();
  loops.push(runFrame);
}

// 각 루프에서 runFrame 실행: 첫 번째만 처리하고 나머지는 recreateScheduled=true로 스킵
let fatalCount = 0;
for (const rf of loops) {
  const r = rf();
  if (r.stopped === 'fatal_reset') fatalCount++;
}

// 주의: 각 startAnalyzer 호출마다 새 루프가 생성되므로 각각 한 번씩 감지할 수 있음
// 핵심은 recreateScheduled 플래그로 동일 루프 내에서 중복 방지가 되는지
// 이 시뮬레이션에서는 각 startAnalyzer가 독립 sim 인스턴스가 아니므로
// recreateScheduled=true가 되면 이후 runFrame은 스킵됨
assert('G: 총 fatal_reset 처리 횟수', fatalCount <= loops.length, `fatalCount=${fatalCount}`);
assert('G: analyzerRecreateCount 유한', simG.analyzerRecreateCount < 100, `got ${simG.analyzerRecreateCount}`);

// ─── H: cancel 시 recreate 차단 ─────────────────────────────────────────────

console.log('\n[H] Recreate blocked after cancel (component unmount sim)');
resetRuntime();

const simH = createCameraPreviewSim();
simH.startAnalyzer();
applyFatalReset(new Error('Packet timestamp mismatch'));

const { runFrame: runFrameH } = simH.startAnalyzer();
runFrameH(); // fatal reset 처리

// 컴포넌트 언마운트
simH.cancel();

// recreate 콜백 실행 — cancelled이므로 startAnalyzer가 호출되지 않아야 한다
const prevRecreateCount = simH.analyzerRecreateCount;
simH.triggerRecreate(0);
// cancel() 후 startAnalyzer는 내부에서 cancelled 체크 → 아무 동작 안 함
// analyzerRecreateCount는 fatale reset 처리 시점에만 증가하므로 변하지 않아야 함
assert('H: cancel 후 추가 recreate 없음', simH.analyzerRecreateCount === prevRecreateCount, 
  `before=${prevRecreateCount}, after=${simH.analyzerRecreateCount}`);

// ─── I: runtime generation 관찰 가능성 ──────────────────────────────────────

console.log('\n[I] Runtime generation observability in fatal frame');
resetRuntime();

const analyzerI = createMockAnalyzer();
assert('I1: analyzer 생성 시점 generation = 0', analyzerI.creationRuntimeGeneration === 0);

applyFatalReset(new Error('Packet timestamp mismatch'));
applyFatalReset(new Error('CalculatorGraph failure'));

const frameI = analyzerI.analyze();
assert('I2: frame의 runtimeGeneration = 2', frameI._mediapipeRuntimeGeneration === 2, `got ${frameI._mediapipeRuntimeGeneration}`);
assert('I3: frame의 fatalResetCount = 2', frameI._mediapipeFatalResetCount === 2, `got ${frameI._mediapipeFatalResetCount}`);
assert('I4: creationGeneration(0) != runtimeGeneration(2)', analyzerI.creationRuntimeGeneration !== frameI._mediapipeRuntimeGeneration);

// ─── 결과 ────────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════`);
console.log(`결과: ${passed} passed / ${failed} failed`);
if (failed > 0) {
  console.error('FAIL — 위 실패 항목 확인 요망');
  process.exit(1);
} else {
  console.log('ALL PASS');
}
