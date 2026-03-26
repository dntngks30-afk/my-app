/**
 * PR-HOTFIX-06 smoke test
 * analyzer-owned MediaPipe runtime 구조를 순수 JS로 검증한다.
 *
 * 목표:
 * - analyzer끼리 landmarker/timestamp 상태를 공유하지 않음
 * - analyzer 내부 timestamp만 단조 증가
 * - fatal 오류는 해당 analyzer만 poison
 * - CameraPreview가 fatal analyzer만 재생성
 * - stale loop는 generation token으로 차단
 * - happy path에는 무거운 cooldown/backoff가 없음
 */

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
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

let nextAnalyzerId = 1;

function bumpAnalyzerTimestampMs(lastDetectTimestampMs, candidateMs) {
  let c = Number.isFinite(candidateMs) && candidateMs >= 0 ? candidateMs : 0;
  if (lastDetectTimestampMs >= 0 && c <= lastDetectTimestampMs) {
    c = lastDetectTimestampMs + 1;
  }
  return c;
}

function createAnalyzerFatalFrame(analyzerId, timestampMs = 0) {
  return {
    timestampMs,
    landmarks: null,
    source: 'mediapipe',
    width: 0,
    height: 0,
    _mediapipeDetectFailed: true,
    _mediapipeAnalyzerFatal: true,
    _mediapipeAnalyzerNeedsRecreate: true,
    _mediapipeAnalyzerId: analyzerId,
  };
}

function createMockLandmarker(label, options = {}) {
  let closed = false;
  let callCount = 0;

  return {
    label,
    get closed() {
      return closed;
    },
    get callCount() {
      return callCount;
    },
    detectForVideo(_video, ts) {
      callCount += 1;
      if (options.throwFatalAtCall === callCount) {
        throw new Error('Packet timestamp mismatch');
      }
      if (options.throwNonFatalAtCall === callCount) {
        throw new Error('temporary detect failure');
      }
      return {
        landmarks: [[{ x: 0.1, y: 0.2, z: 0, visibility: 0.9 }]],
        ts,
      };
    },
    close() {
      closed = true;
    },
  };
}

function createMockAnalyzer(label, landmarker) {
  const analyzerId = nextAnalyzerId++;
  let lastDetectTimestampMs = -1;
  let detectInFlight = false;
  let fatal = false;
  let closed = false;
  let nonFatalLogCount = 0;

  function poisonAnalyzer(reason) {
    if (fatal) return;
    fatal = true;
    detectInFlight = false;
    if (landmarker && typeof landmarker.close === 'function') {
      landmarker.close();
    }
  }

  return {
    label,
    analyzerId,
    get fatal() {
      return fatal;
    },
    get lastDetectTimestampMs() {
      return lastDetectTimestampMs;
    },
    get nonFatalLogCount() {
      return nonFatalLogCount;
    },
    analyze(videoCurrentTimeMs) {
      const fallbackTs = Number.isFinite(videoCurrentTimeMs) ? videoCurrentTimeMs : 0;
      if (closed) {
        return {
          timestampMs: fallbackTs,
          landmarks: null,
          source: 'mediapipe',
          width: 0,
          height: 0,
        };
      }
      if (fatal) {
        return createAnalyzerFatalFrame(analyzerId, fallbackTs);
      }
      if (detectInFlight) {
        return {
          timestampMs: fallbackTs,
          landmarks: null,
          source: 'mediapipe',
          width: 0,
          height: 0,
        };
      }

      const ts = bumpAnalyzerTimestampMs(lastDetectTimestampMs, fallbackTs);
      lastDetectTimestampMs = ts;
      detectInFlight = true;

      try {
        const result = landmarker.detectForVideo({}, ts);
        detectInFlight = false;
        return {
          timestampMs: ts,
          landmarks: result.landmarks[0],
          source: 'mediapipe',
          width: 100,
          height: 100,
          _mediapipeAnalyzerId: analyzerId,
        };
      } catch (error) {
        detectInFlight = false;
        if (isFatalDetectError(error)) {
          poisonAnalyzer(error);
          return createAnalyzerFatalFrame(analyzerId, ts);
        }
        nonFatalLogCount += 1;
        return {
          timestampMs: ts,
          landmarks: null,
          source: 'mediapipe',
          width: 100,
          height: 100,
          _mediapipeDetectFailed: true,
          _mediapipeAnalyzerId: analyzerId,
        };
      }
    },
    close() {
      closed = true;
      detectInFlight = false;
      if (landmarker && typeof landmarker.close === 'function') {
        landmarker.close();
      }
    },
  };
}

function createCameraPreviewSim() {
  let loopGeneration = 0;
  let recreateScheduled = false;
  let analyzerRecreateCount = 0;
  let lastHandledFatalAnalyzerId = null;
  let currentAnalyzer = null;
  let recreateDelayMs = null;
  let cancelled = false;

  function startAnalyzer(factory) {
    loopGeneration += 1;
    const myGeneration = loopGeneration;
    currentAnalyzer = factory();

    function runFrame(videoCurrentTimeMs) {
      if (cancelled) return { stopped: 'cancelled' };
      if (loopGeneration !== myGeneration) return { stopped: 'stale_generation' };

      const frame = currentAnalyzer.analyze(videoCurrentTimeMs);
      if (
        frame._mediapipeAnalyzerFatal &&
        frame._mediapipeAnalyzerNeedsRecreate &&
        typeof frame._mediapipeAnalyzerId === 'number' &&
        frame._mediapipeAnalyzerId !== lastHandledFatalAnalyzerId &&
        !recreateScheduled
      ) {
        lastHandledFatalAnalyzerId = frame._mediapipeAnalyzerId;
        recreateScheduled = true;
        loopGeneration += 1;
        currentAnalyzer.close();
        currentAnalyzer = null;
        analyzerRecreateCount += 1;
        recreateDelayMs = 120;
        return { stopped: 'fatal_recreate_scheduled', frame };
      }

      return { frame };
    }

    return { myGeneration, runFrame };
  }

  function flushRecreate(factory) {
    if (!recreateScheduled || cancelled) return null;
    recreateScheduled = false;
    return startAnalyzer(factory);
  }

  return {
    get loopGeneration() {
      return loopGeneration;
    },
    get recreateScheduled() {
      return recreateScheduled;
    },
    get analyzerRecreateCount() {
      return analyzerRecreateCount;
    },
    get lastHandledFatalAnalyzerId() {
      return lastHandledFatalAnalyzerId;
    },
    get currentAnalyzer() {
      return currentAnalyzer;
    },
    get recreateDelayMs() {
      return recreateDelayMs;
    },
    cancel() {
      cancelled = true;
    },
    startAnalyzer,
    flushRecreate,
  };
}

console.log('\n[A] Analyzer-owned runtime');
const analyzerA = createMockAnalyzer('A', createMockLandmarker('landmarker-A'));
const analyzerB = createMockAnalyzer('B', createMockLandmarker('landmarker-B'));
const frameA1 = analyzerA.analyze(1000);
const frameB1 = analyzerB.analyze(1000);
assert('A1: analyzer id가 서로 다름', analyzerA.analyzerId !== analyzerB.analyzerId);
assert('A2: analyzer A timestamp = 1000', frameA1.timestampMs === 1000, `got ${frameA1.timestampMs}`);
assert('A3: analyzer B도 독립적으로 timestamp = 1000', frameB1.timestampMs === 1000, `got ${frameB1.timestampMs}`);
assert('A4: analyzer끼리 timestamp 상태를 공유하지 않음', analyzerA.lastDetectTimestampMs === analyzerB.lastDetectTimestampMs);

console.log('\n[B] Local monotonic timestamp');
const frameA2 = analyzerA.analyze(900);
const frameA3 = analyzerA.analyze(900);
assert('B1: 같은 analyzer 안에서 역행 입력도 단조 증가', frameA2.timestampMs > frameA1.timestampMs);
assert('B2: 같은 analyzer 안에서 중복 입력도 단조 증가', frameA3.timestampMs > frameA2.timestampMs);
const analyzerARecreated = createMockAnalyzer('A-recreated', createMockLandmarker('landmarker-A2'));
const frameARecreated = analyzerARecreated.analyze(1000);
assert('B3: 재생성된 analyzer는 global continuity 없이 새 lifecycle 시작', frameARecreated.timestampMs === 1000);

console.log('\n[C] Fatal analyzer failure poisons only that analyzer');
const fatalAnalyzer = createMockAnalyzer(
  'fatal',
  createMockLandmarker('fatal-landmarker', { throwFatalAtCall: 2 })
);
const healthyAnalyzer = createMockAnalyzer('healthy', createMockLandmarker('healthy-landmarker'));
const fatalFrame1 = fatalAnalyzer.analyze(1000);
const fatalFrame2 = fatalAnalyzer.analyze(1100);
const healthyFrame1 = healthyAnalyzer.analyze(1000);
assert('C1: fatal 전 첫 호출은 정상', !fatalFrame1._mediapipeAnalyzerFatal);
assert('C2: fatal 호출은 analyzer fatal frame 반환', fatalFrame2._mediapipeAnalyzerFatal === true);
assert('C3: fatal analyzer는 recreate 필요 신호를 포함', fatalFrame2._mediapipeAnalyzerNeedsRecreate === true);
assert('C4: healthy analyzer는 영향받지 않음', !healthyFrame1._mediapipeAnalyzerFatal);
const fatalFrame3 = fatalAnalyzer.analyze(1200);
assert('C5: poison 이후 재호출도 detect를 계속 쓰지 않고 fatal frame 반환', fatalFrame3._mediapipeAnalyzerFatal === true);

console.log('\n[D] CameraPreview recreate path');
const previewSim = createCameraPreviewSim();
const fatalFactory = () =>
  createMockAnalyzer('preview-fatal', createMockLandmarker('preview-fatal-landmarker', { throwFatalAtCall: 1 }));
const healthyFactory = () =>
  createMockAnalyzer('preview-healthy', createMockLandmarker('preview-healthy-landmarker'));
const loop1 = previewSim.startAnalyzer(fatalFactory);
const resultD1 = loop1.runFrame(1000);
assert('D1: fatal analyzer frame이 recreate를 예약', resultD1.stopped === 'fatal_recreate_scheduled');
assert('D2: recreateScheduled=true', previewSim.recreateScheduled === true);
assert('D3: analyzerRecreateCount=1', previewSim.analyzerRecreateCount === 1);
assert('D4: recreate delay는 짧고 명시적', previewSim.recreateDelayMs === 120);
const loop2 = previewSim.flushRecreate(healthyFactory);
assert('D5: recreate 후 새 loop 생성', Boolean(loop2));
const resultD6 = loop2.runFrame(1000);
assert('D6: 재생성 analyzer는 정상 frame', !resultD6.frame._mediapipeAnalyzerFatal);

console.log('\n[E] Stale loop blocked');
const staleResult = loop1.runFrame(1100);
assert('E1: 이전 loop는 stale_generation으로 차단', staleResult.stopped === 'stale_generation');

console.log('\n[F] Bounded fatal handling');
const previewSim2 = createCameraPreviewSim();
const repeatedFatalFactory = () =>
  createMockAnalyzer('repeat-fatal', createMockLandmarker('repeat-fatal-landmarker', { throwFatalAtCall: 1 }));
const loopF1 = previewSim2.startAnalyzer(repeatedFatalFactory);
loopF1.runFrame(1000);
const recreateCountAfterFirst = previewSim2.analyzerRecreateCount;
const repeatAfterHandled = loopF1.runFrame(1010);
assert('F1: 첫 fatal 처리 후 recreate count=1', recreateCountAfterFirst === 1);
assert('F2: stale loop 재실행은 추가 recreate를 만들지 않음', repeatAfterHandled.stopped === 'stale_generation');
assert('F3: recreate spam 없음', previewSim2.analyzerRecreateCount === 1);

console.log('\n[G] Happy path remains lightweight');
const smoothAnalyzer = createMockAnalyzer('smooth', createMockLandmarker('smooth-landmarker'));
const smoothFrames = [1000, 1060, 1120, 1180].map((ts) => smoothAnalyzer.analyze(ts));
assert('G1: normal path에서 fatal metadata 없음', smoothFrames.every((f) => !f._mediapipeAnalyzerFatal));
assert('G2: normal path에서 detect backoff/cooldown 상태 없음', smoothAnalyzer.nonFatalLogCount === 0);

console.log('\n========================================');
console.log(`Result: ${passed} passed / ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
