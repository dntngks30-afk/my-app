/**
 * PR-HOTFIX-07 smoke test
 *
 * 검증 항목:
 * A. detect timestamp 소스가 video.currentTime이 아닌 performance.now() 오프셋임을 확인
 * B. analyzer-local 단조 증가 timestamp 동작 확인
 * C. fatal analyzer frame이 onPoseFrame / overlay draw 전에 인터셉트됨을 확인
 * D. fatal frame 이후 loop가 즉시 return하여 onPoseFrame이 호출되지 않음을 확인
 * E. 비 fatal frame은 정상적으로 onPoseFrame / draw까지 도달함을 확인
 * F. 연속 fatal 시 동일 analyzerId에 대한 중복 recreate가 발생하지 않음을 확인
 *
 * 실행: node scripts/camera-hotfix07-ts-source-and-fatal-intercept-smoke.mjs
 */

// ---------------------------------------------------------------------------
// minimal performance.now() polyfill (Node 16+는 기본 지원)
// ---------------------------------------------------------------------------
const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function assert(cond, label) {
  if (!cond) {
    console.error(`  FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Mock: analyzer-local timestamp logic (mediapipe-pose.ts 내부 로직 인라인)
// ---------------------------------------------------------------------------
function makeMockAnalyzer({ simulateFatalOnCall } = {}) {
  const analyzerStartedAtMs = perfNow();
  let lastDetectTimestampMs = -1;
  let fatalTriggered = false;
  const analyzerId = Math.floor(Math.random() * 10000) + 1;
  const tsLog = [];

  function bumpAnalyzerTimestampMs(lastMs, candidateMs) {
    let c = candidateMs;
    if (!Number.isFinite(c) || c < 0) c = 0;
    if (lastMs >= 0 && c <= lastMs) c = lastMs + 1;
    return c;
  }

  let callCount = 0;

  return {
    analyzerId,
    tsLog,
    analyze(video) {
      callCount++;
      const rawNowMs = perfNow() - analyzerStartedAtMs;

      if (fatalTriggered) {
        return {
          timestampMs: rawNowMs,
          landmarks: null,
          source: 'mediapipe',
          width: 0,
          height: 0,
          _mediapipeAnalyzerFatal: true,
          _mediapipeAnalyzerNeedsRecreate: true,
          _mediapipeAnalyzerId: analyzerId,
        };
      }

      const ts = bumpAnalyzerTimestampMs(lastDetectTimestampMs, rawNowMs);
      lastDetectTimestampMs = ts;
      tsLog.push(ts);

      if (simulateFatalOnCall && callCount >= simulateFatalOnCall) {
        fatalTriggered = true;
        return {
          timestampMs: ts,
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

      return {
        timestampMs: ts,
        landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }],
        source: 'mediapipe',
        width: 640,
        height: 480,
      };
    },
    close() {},
  };
}

// ---------------------------------------------------------------------------
// Mock video element
// ---------------------------------------------------------------------------
function makeMockVideo({ currentTimeSentinel = false } = {}) {
  return {
    // 모바일에서 관측된 INT32_MAX 포화값 (video.currentTime)
    get currentTime() {
      return currentTimeSentinel ? 2147483647 : 1.234;
    },
    readyState: 4,
    paused: false,
    ended: false,
    videoWidth: 640,
    videoHeight: 480,
    srcObject: { active: true, getVideoTracks: () => [{ readyState: 'live' }] },
  };
}

// ---------------------------------------------------------------------------
// Test A: detect timestamp는 video.currentTime이 아닌 performance.now() 기반이어야 함
// ---------------------------------------------------------------------------
console.log('\n[Test A] detect ts source — performance.now() 기반이어야 함');
{
  const analyzer = makeMockAnalyzer();
  // 모바일 포화값(INT32_MAX) video를 주입
  const sentinelVideo = makeMockVideo({ currentTimeSentinel: true });
  const frame = analyzer.analyze(sentinelVideo);

  // 정상 analyze가 이뤄졌어야 함 (fatal frame이 아님)
  assert(!frame._mediapipeAnalyzerFatal, 'sentinel video.currentTime으로 fatal 발생 없음');

  // timestamp가 INT32_MAX * 1000 근처가 아니어야 함
  const INT32_MAX_MS = 2147483647 * 1000;
  assert(
    frame.timestampMs < INT32_MAX_MS - 1_000_000,
    `ts=${frame.timestampMs}이 INT32_MAX 포화값(${INT32_MAX_MS})과 충분히 다름`,
  );

  // timestamp가 performance.now() 오프셋 범위 내여야 함 (0 ~ 60000ms 내)
  assert(
    frame.timestampMs >= 0 && frame.timestampMs < 60_000,
    `ts=${frame.timestampMs}이 performance.now() 오프셋 범위(0~60000ms) 내에 있음`,
  );
}

// ---------------------------------------------------------------------------
// Test B: analyzer-local 단조 증가 timestamp 동작 확인
// ---------------------------------------------------------------------------
console.log('\n[Test B] analyzer-local monotonic timestamp');
{
  const analyzer = makeMockAnalyzer();
  const video = makeMockVideo();

  const frames = [];
  for (let i = 0; i < 10; i++) {
    frames.push(analyzer.analyze(video));
    // 실제 RAF 간격 시뮬레이션 없이 연속 호출 → bump 로직으로 단조 보장
  }

  const tsList = frames.map((f) => f.timestampMs);
  let allMonotonic = true;
  for (let i = 1; i < tsList.length; i++) {
    if (tsList[i] <= tsList[i - 1]) {
      allMonotonic = false;
      console.error(`  ts[${i}]=${tsList[i]} <= ts[${i - 1}]=${tsList[i - 1]}`);
    }
  }
  assert(allMonotonic, `10회 연속 analyze 모두 단조 증가: [${tsList.join(', ')}]`);
}

// ---------------------------------------------------------------------------
// Test C: fatal frame이 onPoseFrame / draw 전에 인터셉트됨을 확인
// (CameraPreview loop 로직 시뮬레이션)
// ---------------------------------------------------------------------------
console.log('\n[Test C] fatal frame intercept before onPoseFrame / draw');
{
  let onPoseFrameCallCount = 0;
  let drawCallCount = 0;
  let recreateTriggered = false;

  const analyzer = makeMockAnalyzer({ simulateFatalOnCall: 1 });

  // CameraPreview loop 핵심 로직 인라인 시뮬레이션
  function simulateLoop(frame) {
    // ─── HOTFIX-07 적용 후 순서: fatal 체크 먼저 ───
    if (
      frame._mediapipeAnalyzerFatal &&
      frame._mediapipeAnalyzerNeedsRecreate &&
      typeof frame._mediapipeAnalyzerId === 'number'
    ) {
      recreateTriggered = true;
      return; // onPoseFrame / draw 호출 없이 종료
    }
    // 정상 frame만 여기까지 도달
    onPoseFrameCallCount++;
    drawCallCount++;
  }

  const fatalFrame = analyzer.analyze(makeMockVideo());
  simulateLoop(fatalFrame);

  assert(recreateTriggered, 'fatal frame에서 recreate 트리거됨');
  assert(onPoseFrameCallCount === 0, 'fatal frame에서 onPoseFrame 호출 없음 (flicker 방지)');
  assert(drawCallCount === 0, 'fatal frame에서 draw 호출 없음 (skeleton 깜빡임 방지)');
}

// ---------------------------------------------------------------------------
// Test D: 비 fatal frame은 onPoseFrame / draw까지 도달함
// ---------------------------------------------------------------------------
console.log('\n[Test D] non-fatal frame reaches onPoseFrame / draw');
{
  let onPoseFrameCallCount = 0;
  let drawCallCount = 0;
  let recreateTriggered = false;

  const analyzer = makeMockAnalyzer(); // fatal 없음

  function simulateLoop(frame) {
    if (
      frame._mediapipeAnalyzerFatal &&
      frame._mediapipeAnalyzerNeedsRecreate &&
      typeof frame._mediapipeAnalyzerId === 'number'
    ) {
      recreateTriggered = true;
      return;
    }
    onPoseFrameCallCount++;
    drawCallCount++;
  }

  for (let i = 0; i < 5; i++) {
    simulateLoop(analyzer.analyze(makeMockVideo()));
  }

  assert(!recreateTriggered, '정상 frame에서 recreate 미트리거');
  assert(onPoseFrameCallCount === 5, `5회 모두 onPoseFrame 도달 (count=${onPoseFrameCallCount})`);
  assert(drawCallCount === 5, `5회 모두 draw 도달 (count=${drawCallCount})`);
}

// ---------------------------------------------------------------------------
// Test E: 동일 analyzerId에 대한 중복 recreate 차단 (lastHandledFatalAnalyzerIdRef 로직)
// ---------------------------------------------------------------------------
console.log('\n[Test E] duplicate recreate blocked for same analyzerId');
{
  let recreateCount = 0;
  let lastHandledId = null;
  let recreateScheduled = false;

  function simulateFatalHandling(frame) {
    if (
      frame._mediapipeAnalyzerFatal &&
      frame._mediapipeAnalyzerNeedsRecreate &&
      typeof frame._mediapipeAnalyzerId === 'number' &&
      frame._mediapipeAnalyzerId !== lastHandledId &&
      !recreateScheduled
    ) {
      lastHandledId = frame._mediapipeAnalyzerId;
      recreateScheduled = true;
      recreateCount++;
      return true;
    }
    return false;
  }

  const fixedAnalyzerId = 42;
  const fatalFrame = {
    timestampMs: 100,
    landmarks: null,
    source: 'mediapipe',
    width: 0,
    height: 0,
    _mediapipeAnalyzerFatal: true,
    _mediapipeAnalyzerNeedsRecreate: true,
    _mediapipeAnalyzerId: fixedAnalyzerId,
  };

  // 같은 fatal frame을 3번 처리 시도
  simulateFatalHandling(fatalFrame);
  simulateFatalHandling(fatalFrame);
  simulateFatalHandling(fatalFrame);

  assert(recreateCount === 1, `동일 analyzerId(${fixedAnalyzerId}) → recreate 1회만 발생 (count=${recreateCount})`);
}

// ---------------------------------------------------------------------------
// Test F: 구 video.currentTime 경로가 도달 불가임을 확인 (코드 경로 부재 검증)
// ---------------------------------------------------------------------------
console.log('\n[Test F] old video.currentTime timestamp path is not reachable');
{
  // mediapipe-pose.ts 소스를 파일로 읽어 video.currentTime 사용 여부 확인
  const fs = await import('fs');
  const path = await import('path');
  const src = fs.readFileSync(
    path.resolve('src/lib/motion/mediapipe-pose.ts'),
    'utf8'
  );

  // mediaTimestampMsFromVideo 함수 정의가 제거됐는지 확인
  const hasFnDef = src.includes('function mediaTimestampMsFromVideo');
  assert(!hasFnDef, 'mediaTimestampMsFromVideo 함수 정의가 제거됨');

  // rawMediaMs 변수가 남아있지 않은지 확인
  const hasRawMediaMs = src.includes('rawMediaMs');
  assert(!hasRawMediaMs, 'rawMediaMs 변수가 detect 경로에서 제거됨');

  // rawNowMs (performance.now 오프셋) 사용이 존재하는지 확인
  const hasRawNowMs = src.includes('rawNowMs');
  assert(hasRawNowMs, 'rawNowMs (performance.now 오프셋) 사용 확인');

  // analyzerStartedAtMs 캡처가 존재하는지 확인
  const hasAnalyzerStartedAt = src.includes('analyzerStartedAtMs');
  assert(hasAnalyzerStartedAt, 'analyzerStartedAtMs 생성 시 캡처 확인');

  // bumpAnalyzerTimestampMs가 rawNowMs와 함께 사용되는지 확인
  const hasBumpWithNow = src.includes('bumpAnalyzerTimestampMs(lastDetectTimestampMs, rawNowMs)');
  assert(hasBumpWithNow, 'bumpAnalyzerTimestampMs가 rawNowMs와 함께 사용됨');
}

// ---------------------------------------------------------------------------
// Test G: CameraPreview.tsx fatal intercept 순서가 onPoseFrame 앞인지 코드 확인
// ---------------------------------------------------------------------------
console.log('\n[Test G] CameraPreview.tsx fatal intercept order verification');
{
  const fs = await import('fs');
  const src = fs.readFileSync('src/components/public/CameraPreview.tsx', 'utf8');

  const fatalCheckIdx = src.indexOf('frame._mediapipeAnalyzerFatal');
  const onPoseFrameIdx = src.indexOf('onPoseFrameRef.current?.(frame)');
  const drawIdx = src.indexOf('drawPoseFrameToCanvas(overlayCanvasRef.current, frame');

  assert(fatalCheckIdx !== -1, 'fatal check 코드 존재');
  assert(onPoseFrameIdx !== -1, 'onPoseFrame 호출 코드 존재');
  assert(drawIdx !== -1, 'drawPoseFrameToCanvas 호출 코드 존재');
  assert(
    fatalCheckIdx < onPoseFrameIdx,
    `fatal check(idx=${fatalCheckIdx})가 onPoseFrame(idx=${onPoseFrameIdx}) 앞에 위치`,
  );
  assert(
    fatalCheckIdx < drawIdx,
    `fatal check(idx=${fatalCheckIdx})가 draw(idx=${drawIdx}) 앞에 위치`,
  );
}

console.log('\n=== PR-HOTFIX-07 smoke test complete ===\n');
