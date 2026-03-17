/**
 * Public camera voice guidance smoke test
 * Run: npx tsx scripts/camera-voice-guidance-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  createVoicePlaybackState,
  decideVoicePlayback,
  getCorrectiveVoiceCue,
  getCountdownVoiceCue,
  getStartVoiceCue,
  getSuccessVoiceCue,
  resetVoiceGuidanceSession,
  speakVoiceCue,
  trySpeakCorrectiveCueWithAntiSpam,
  unlockVoiceGuidance,
} = await import('../src/lib/camera/voice-guidance.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function createGate(overrides = {}) {
  return {
    failureReasons: [],
    userGuidance: [],
    progressionState: 'detecting',
    guardrail: {
      captureQuality: 'valid',
      flags: [],
    },
    ...overrides,
  };
}

console.log('Camera voice guidance smoke test\n');

// AT1: start / countdown / success cue basics
ok('AT1a: squat start cue exists', getStartVoiceCue('squat').text.includes('촬영을 시작합니다'));
ok('AT1b: countdown cue says 3', getCountdownVoiceCue(3).text === '3');
ok('AT1c: success cue says 잘했어요', getSuccessVoiceCue().text === '잘했어요');

// AT2: cooldown / dedupe
const playbackState = createVoicePlaybackState();
const countdownCue = getCountdownVoiceCue(3);
const allowFirst = decideVoicePlayback(playbackState, countdownCue, 1000);
ok('AT2a: first cue allowed', allowFirst.allowed === true);
playbackState.lastSpokenAt[countdownCue.dedupeKey] = 1000;
const blockedRepeat = decideVoicePlayback(playbackState, countdownCue, 1500);
ok('AT2b: repeated cue blocked by cooldown', blockedRepeat.allowed === false);

// AT3: higher priority cue may interrupt lower priority cue
playbackState.activeCueKey = 'correction:motion:squat';
playbackState.activePriority = 3;
const successDecision = decideVoicePlayback(playbackState, getSuccessVoiceCue(), 5000);
ok('AT3: success interrupts lower priority cue', successDecision.allowed && successDecision.interruptActive);

// AT4: representative framing / motion mappings
const framingCue = getCorrectiveVoiceCue(
  'squat',
  createGate({ failureReasons: ['left_side_missing'], readinessState: 'not_ready' })
);
ok('AT4a: framing cue maps to full-body message', framingCue?.text === '머리부터 발끝까지 보이게 해주세요');

const framingCueSuppressedWhenReady = getCorrectiveVoiceCue(
  'squat',
  createGate({ failureReasons: ['left_side_missing'], readinessState: 'ready' })
);
ok('AT4a-2: framing cue is suppressed once readiness is white', framingCueSuppressedWhenReady === null);

const depthCue = getCorrectiveVoiceCue(
  'squat',
  createGate({ failureReasons: ['depth_not_reached'], readinessState: 'ready' })
);
ok('AT4b: squat depth cue maps correctly', depthCue?.text === '조금 더 깊게 앉아주세요');

const holdCue = getCorrectiveVoiceCue(
  'overhead-reach',
  createGate({ failureReasons: ['hold_too_short'], readinessState: 'ready' })
);
ok('AT4c: overhead hold cue maps correctly', holdCue?.text === '맨 위에서 잠깐 멈춰주세요');

const whiteHardPartialCue = getCorrectiveVoiceCue(
  'overhead-reach',
  createGate({ failureReasons: ['hard_partial'], readinessState: 'ready' })
);
ok('AT4c-2: white readiness blocks framing-only hard partial speech', whiteHardPartialCue === null);

const framingHintCue = getCorrectiveVoiceCue(
  'squat',
  createGate({ readinessState: 'not_ready', framingHint: '조금 뒤로 가 주세요' })
);
ok('AT4d: explicit framing hint wins for red readiness', framingHintCue?.text === '조금 뒤로 가 주세요');

const internalHintCue = getCorrectiveVoiceCue(
  'squat',
  createGate({ readinessState: 'not_ready', framingHint: 'framing_invalid' })
);
ok('AT4d-2: internal framing hint sanitized to approved Korean', internalHintCue?.text === '전신이 화면에 들어오게 맞춰주세요');

const readyCameraCue = getCorrectiveVoiceCue(
  'squat',
  createGate({ progressionState: 'camera_ready', readinessState: 'ready', failureReasons: ['valid_frames_too_few'] })
);
ok('AT4e: ready camera state stays quiet for framing setup noise', readyCameraCue === null);

// AT5: non-blocking failure in non-browser env
unlockVoiceGuidance();
const noBrowserResult = await speakVoiceCue(getStartVoiceCue('squat'));
ok('AT5: no-browser speak fails gracefully', noBrowserResult === false);

// AT6: anti-spam - passLatched suppresses corrective
resetVoiceGuidanceSession();
const passLatchedResult = trySpeakCorrectiveCueWithAntiSpam({
  stepId: 'squat',
  gate: createGate({ failureReasons: ['left_side_missing'], readinessState: 'not_ready' }),
  passLatched: true,
});
ok('AT6a: passLatched suppresses corrective cue', passLatchedResult.played === false);

// AT7: anti-spam - readiness white blocks framing cue
const whiteFramingResult = trySpeakCorrectiveCueWithAntiSpam({
  stepId: 'squat',
  gate: createGate({ failureReasons: ['left_side_missing'], readinessState: 'ready' }),
  passLatched: false,
});
ok('AT7: readiness white blocks framing cue', whiteFramingResult.played === false);

// AT8: anti-spam - stable hold suppresses immediate speak
resetVoiceGuidanceSession();
const immediateResult = trySpeakCorrectiveCueWithAntiSpam({
  stepId: 'squat',
  gate: createGate({ failureReasons: ['depth_not_reached'], readinessState: 'ready' }),
  passLatched: false,
  now: 1000,
});
ok('AT8: stable hold or cooldown suppresses rapid cue', immediateResult.suppressedReason === 'stable_hold' || immediateResult.played === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
