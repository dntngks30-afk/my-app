import type { CameraStepId } from '@/lib/public/camera-test';
import type { ExerciseGateResult, SquatCycleDebug } from './auto-progression';
import { getEffectiveRetryGuidance } from './camera-guidance';
import type { LiveReadinessState } from './live-readiness';
import {
  playCueWithFallback,
  cancelClipPlayback,
  type SpeakTTSOptions,
} from './korean-audio-pack';

export type VoiceCueKind = 'start' | 'countdown' | 'correction' | 'success';
export type VoiceCuePriority = 1 | 2 | 3 | 4 | 5 | 6;

export interface VoiceCue {
  kind: VoiceCueKind;
  dedupeKey: string;
  text: string;
  priority: VoiceCuePriority;
  cooldownMs: number;
  interrupt?: boolean;
  fallbackBeep?: boolean;
}

export interface VoicePlaybackState {
  activeCueKey: string | null;
  activePriority: number;
  lastSpokenAt: Record<string, number>;
}

export interface VoicePlaybackDecision {
  allowed: boolean;
  interruptActive: boolean;
  reason: 'ok' | 'cooldown' | 'lower_priority_active' | 'same_active';
}

type VoiceGuidanceGate = {
  failureReasons: ExerciseGateResult['failureReasons'];
  userGuidance: ExerciseGateResult['userGuidance'];
  progressionState: ExerciseGateResult['progressionState'];
  guardrail: Pick<ExerciseGateResult['guardrail'], 'captureQuality' | 'flags' | 'debug'>;
  readinessState?: LiveReadinessState;
  framingHint?: string | null;
  /** squat 전용: bottom-stall recovery cue 조건 판단 */
  squatCycleDebug?: SquatCycleDebug | null;
  /** PR-C4: overhead hold cue suppress — holdDurationMs, topEntryAtMs 등 */
  evaluatorResult?: { debug?: { highlightedMetrics?: { holdDurationMs?: number } } };
};

/** PR E: approved Korean phrases for TTS — internal/debug strings must never be spoken */
const APPROVED_KOREAN_FRAMING_HINTS = new Set([
  '화면이 너무 어두워요',
  '조금 뒤로 가 주세요',
  '머리부터 발끝까지 보이게 해주세요',
  '전신이 화면에 들어오게 맞춰주세요',
  '머리부터 발끝까지 보이게 해주세요',
  '조금 더 가까이 와주세요',
  '손끝까지 보이게 해 주세요',
  '몸이 화면 안에서 더 크게 보이게 해주세요',
  '전신이 보이도록 다시 맞춰 주세요',
]);

function toApprovedKoreanFramingText(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (APPROVED_KOREAN_FRAMING_HINTS.has(raw)) return raw;
  /* internal/debug string — never speak; use generic fallback or silence */
  return '전신이 화면에 들어오게 맞춰주세요';
}

const FRAMING_REASONS = [
  'framing_invalid',
  'left_side_missing',
  'right_side_missing',
  'hard_partial',
  'capture_quality_invalid',
  'capture_quality_low',
] as const;

const STABILITY_REASONS = [
  'insufficient_signal',
  'valid_frames_too_few',
  'unstable_frame_timing',
  'unstable_bbox',
  'unstable_landmarks',
  'confidence_too_low',
  'landmark_confidence_low',
] as const;

const MOTION_REASONS = [
  'rep_incomplete',
  'depth_not_reached',
  'ascent_not_detected',
  'hold_too_short',
] as const;

const runtimeState: VoicePlaybackState & {
  unlocked: boolean;
  audioContext: AudioContext | null;
  waitResolver: ((ok: boolean) => void) | null;
} = {
  activeCueKey: null,
  activePriority: 0,
  lastSpokenAt: {},
  unlocked: false,
  audioContext: null,
  waitResolver: null,
};

function hasAny(reasons: string[], expected: readonly string[]) {
  return expected.some((reason) => reasons.includes(reason));
}

function getBrowserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (runtimeState.audioContext) return runtimeState.audioContext;

  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return null;

  try {
    runtimeState.audioContext = new AudioContextCtor();
  } catch {
    runtimeState.audioContext = null;
  }

  return runtimeState.audioContext;
}

async function playFallbackBeep(cue: VoiceCue): Promise<boolean> {
  if (!cue.fallbackBeep) return false;

  const audioContext = getBrowserAudioContext();
  if (!audioContext) return false;

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const frequency = cue.kind === 'success' ? 880 : 660;
    const durationSec = cue.kind === 'countdown' ? 0.12 : 0.18;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSec);
    return true;
  } catch {
    return false;
  }
}

export function createVoicePlaybackState(): VoicePlaybackState {
  return {
    activeCueKey: null,
    activePriority: 0,
    lastSpokenAt: {},
  };
}

export function decideVoicePlayback(
  state: VoicePlaybackState,
  cue: VoiceCue,
  now: number
): VoicePlaybackDecision {
  const lastSpokenAt = state.lastSpokenAt[cue.dedupeKey];
  if (typeof lastSpokenAt === 'number' && now - lastSpokenAt < cue.cooldownMs) {
    return { allowed: false, interruptActive: false, reason: 'cooldown' };
  }

  if (state.activeCueKey === cue.dedupeKey) {
    return { allowed: false, interruptActive: false, reason: 'same_active' };
  }

  if (state.activeCueKey && cue.priority <= state.activePriority && !cue.interrupt) {
    return { allowed: false, interruptActive: false, reason: 'lower_priority_active' };
  }

  return {
    allowed: true,
    interruptActive: Boolean(state.activeCueKey) && cue.priority > state.activePriority,
    reason: 'ok',
  };
}

export function unlockVoiceGuidance() {
  runtimeState.unlocked = true;
  const audioContext = getBrowserAudioContext();
  void audioContext?.resume().catch(() => undefined);
}

export function cancelVoiceGuidance() {
  cancelClipPlayback();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (runtimeState.waitResolver) {
    const resolve = runtimeState.waitResolver;
    runtimeState.waitResolver = null;
    resolve(false);
  }
  runtimeState.activeCueKey = null;
  runtimeState.activePriority = 0;
}

export function resetVoiceGuidanceSession() {
  cancelVoiceGuidance();
  runtimeState.lastSpokenAt = {};
  correctiveAntiSpamState.lastCandidateKey = null;
  correctiveAntiSpamState.candidateStableSince = null;
  correctiveAntiSpamState.correctiveLatchedKey = null;
  correctiveAntiSpamState.lastReadiness = null;
  correctiveAntiSpamState.readyToShootPlayedThisSession = false;
  correctiveAntiSpamState.lastEmittedAtMs = null;
}

/** PR G4: funnel-level intro — "촬영이 시작됩니다"는 funnel 첫 진입에서만 1회.
 * squat 이후 overhead 등 다음 motion step에서는 재실행하지 않는다. */
let funnelIntroPlayed = false;

export function hasFunnelIntroPlayed(): boolean {
  return funnelIntroPlayed;
}

export function setFunnelIntroPlayed(): void {
  funnelIntroPlayed = true;
}

/** PR G4: funnel 이탈 시 호출 (layout unmount). 다음 funnel 진입 시 intro 재생 허용. */
export function clearFunnelIntro(): void {
  funnelIntroPlayed = false;
}

/** PR G2: ready_to_shoot cue가 이번 capture session에서 이미 재생되었는지 */
export function hasReadyToShootPlayedThisSession(): boolean {
  return correctiveAntiSpamState.readyToShootPlayedThisSession;
}

/** PR G2: ready_to_shoot cue 재생 완료 시 호출 — 이후 중복 재생 방지 */
export function markReadyToShootPlayed(): void {
  correctiveAntiSpamState.readyToShootPlayedThisSession = true;
}

/** PR C: corrective cue anti-spam / latching state */
const STABLE_HOLD_MS = 500;
/**
 * PR G2: 4s cadence lock — red(framing) 및 white(movement) 모두 4초 주기.
 * frame-reactive 발화를 억제하고 time-gated 정책을 강제한다.
 */
const REPEAT_COOLDOWN_MS = 4000;
const FRAMING_CUE_PREFIXES = [
  'correction:framing',
  'correction:full-body',
  'correction:step-back',
  'correction:framing-hint:',
];

const correctiveAntiSpamState: {
  lastCandidateKey: string | null;
  candidateStableSince: number | null;
  correctiveLatchedKey: string | null;
  lastReadiness: LiveReadinessState | null;
  lastObserved: {
    cueCandidate: string | null;
    suppressedReason: string | null;
    played: boolean;
  } | null;
  /** PR G2: capturing 시작 후 최초 white 진입에만 ready_to_shoot 1회 */
  readyToShootPlayedThisSession: boolean;
  /** PR G2: 마지막 emit 타임스탬프 (observability) */
  lastEmittedAtMs: number | null;
} = {
  lastCandidateKey: null,
  candidateStableSince: null,
  correctiveLatchedKey: null,
  lastReadiness: null,
  lastObserved: null,
  readyToShootPlayedThisSession: false,
  lastEmittedAtMs: null,
};

function isFramingCue(dedupeKey: string): boolean {
  return FRAMING_CUE_PREFIXES.some((p) => dedupeKey.startsWith(p));
}

export interface CorrectiveCueResult {
  played: boolean;
  suppressedReason?: string;
  cueCanceled?: boolean;
}

export interface CorrectiveCueOptions {
  stepId: CameraStepId;
  gate: VoiceGuidanceGate;
  passLatched: boolean;
  now?: number;
  /** PR E: live cueing blocked during intro/countdown */
  liveCueingEnabled?: boolean;
  /** PR-C4: overhead hold cue one-shot — 이번 시도에서 이미 재생했으면 true */
  holdCuePlayedRef?: { current: boolean };
  /** PR-C4: hold cue 재생/종료 시 overlap guard용 */
  onHoldCueStateChange?: (active: boolean) => void;
}

/**
 * PR C: State-transition-driven corrective cue with anti-spam.
 * Requires stable hold before speaking, latch + repeat cooldown, stale cancel on readiness change.
 */
export function trySpeakCorrectiveCueWithAntiSpam(
  options: CorrectiveCueOptions
): CorrectiveCueResult {
  const { stepId, gate, passLatched, liveCueingEnabled = true } = options;
  const now = options.now ?? Date.now();
  const readiness = gate.readinessState ?? null;

  if (!liveCueingEnabled) {
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: null,
      suppressedReason: 'intro_countdown_active',
      played: false,
    };
    return { played: false, suppressedReason: 'intro_countdown_active' };
  }

  if (passLatched) {
    correctiveAntiSpamState.lastReadiness = readiness;
    if (correctiveAntiSpamState.correctiveLatchedKey) {
      cancelVoiceGuidance();
      correctiveAntiSpamState.correctiveLatchedKey = null;
      correctiveAntiSpamState.lastCandidateKey = null;
      correctiveAntiSpamState.candidateStableSince = null;
      correctiveAntiSpamState.lastObserved = {
        cueCandidate: null,
        suppressedReason: 'success_override',
        played: false,
      };
      return { played: false, cueCanceled: true };
    }
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: null,
      suppressedReason: 'pass_latched',
      played: false,
    };
    return { played: false };
  }

  const cue = getCorrectiveVoiceCue(stepId, gate);
  const candidateKey = cue?.dedupeKey ?? null;

  if (readiness === 'ready' && correctiveAntiSpamState.lastReadiness === 'not_ready') {
    if (isFramingCue(correctiveAntiSpamState.correctiveLatchedKey ?? '')) {
      cancelVoiceGuidance();
      correctiveAntiSpamState.correctiveLatchedKey = null;
    }
    correctiveAntiSpamState.lastCandidateKey = null;
    correctiveAntiSpamState.candidateStableSince = null;
  }
  correctiveAntiSpamState.lastReadiness = readiness;

  if (!cue) {
    if (candidateKey !== correctiveAntiSpamState.lastCandidateKey) {
      correctiveAntiSpamState.lastCandidateKey = null;
      correctiveAntiSpamState.candidateStableSince = null;
    }
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: null,
      suppressedReason: 'no_cue',
      played: false,
    };
    return { played: false };
  }

  if (readiness === 'ready' && isFramingCue(cue.dedupeKey)) {
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: cue.dedupeKey,
      suppressedReason: 'readiness_white_framing_stale',
      played: false,
    };
    return { played: false, suppressedReason: 'readiness_white_framing_stale' };
  }

  if (candidateKey !== correctiveAntiSpamState.lastCandidateKey) {
    correctiveAntiSpamState.lastCandidateKey = candidateKey;
    correctiveAntiSpamState.candidateStableSince = now;
  }

  const stableSince = correctiveAntiSpamState.candidateStableSince ?? now;
  const holdElapsed = now - stableSince;
  if (holdElapsed < STABLE_HOLD_MS) {
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: cue.dedupeKey,
      suppressedReason: 'stable_hold',
      played: false,
    };
    return { played: false, suppressedReason: 'stable_hold' };
  }

  const lastSpokenAt = runtimeState.lastSpokenAt[cue.dedupeKey];
  const cooldownElapsed = typeof lastSpokenAt === 'number' ? now - lastSpokenAt : Infinity;
  const effectiveCooldown = Math.max(cue.cooldownMs, REPEAT_COOLDOWN_MS);
  if (cooldownElapsed < effectiveCooldown) {
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: cue.dedupeKey,
      suppressedReason: 'repeat_cooldown',
      played: false,
    };
    return { played: false, suppressedReason: 'repeat_cooldown' };
  }

  const decision = decideVoicePlayback(runtimeState, cue, now);
  if (!decision.allowed) {
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: cue.dedupeKey,
      suppressedReason: decision.reason,
      played: false,
    };
    return { played: false, suppressedReason: decision.reason };
  }

  /* PR-C4: overhead hold cue one-shot — 이미 재생했으면 suppress */
  const isOverheadHoldCue = stepId === 'overhead-reach' && candidateKey === 'correction:hold:overhead-reach';
  if (isOverheadHoldCue && options.holdCuePlayedRef?.current) {
    correctiveAntiSpamState.lastObserved = {
      cueCandidate: cue.dedupeKey,
      suppressedReason: 'hold_cue_one_shot',
      played: false,
    };
    return { played: false, suppressedReason: 'hold_cue_one_shot' };
  }

  if (decision.interruptActive) {
    cancelVoiceGuidance();
  }

  void speakVoiceCue(cue);
  if (isOverheadHoldCue) {
    options.holdCuePlayedRef && (options.holdCuePlayedRef.current = true);
    options.onHoldCueStateChange?.(true);
    const HOLD_CUE_ESTIMATED_DURATION_MS = 3000;
    setTimeout(() => options.onHoldCueStateChange?.(false), HOLD_CUE_ESTIMATED_DURATION_MS);
  }
  correctiveAntiSpamState.correctiveLatchedKey = cue.dedupeKey;
  correctiveAntiSpamState.lastEmittedAtMs = now;
  correctiveAntiSpamState.lastObserved = {
    cueCandidate: cue.dedupeKey,
    suppressedReason: null,
    played: true,
  };
  return { played: true };
}

export function cancelCorrectiveCueForSuccess() {
  if (correctiveAntiSpamState.correctiveLatchedKey) {
    cancelVoiceGuidance();
    correctiveAntiSpamState.correctiveLatchedKey = null;
    correctiveAntiSpamState.lastCandidateKey = null;
    correctiveAntiSpamState.candidateStableSince = null;
  }
}

export function getCorrectiveCueObservability(): {
  cueCandidate: string | null;
  suppressedReason: string | null;
  played: boolean;
  latchedKey: string | null;
  lastReadiness: string | null;
  /** PR G2: 현재 readiness 기반 phase */
  readinessPhase: 'red' | 'white' | 'green' | null;
  /** PR G2: 마지막 emit 타임스탬프 (ms) */
  emittedAtMs: number | null;
  /** PR G2: 다음 eligible emit 타임 (ms) — emittedAtMs + REPEAT_COOLDOWN_MS */
  nextEligibleAtMs: number | null;
  /** PR G2: ready_to_shoot 이번 세션에서 재생 여부 */
  readyToShootPlayed: boolean;
} | null {
  const obs = correctiveAntiSpamState.lastObserved;
  if (!obs) return null;
  const r = correctiveAntiSpamState.lastReadiness;
  const readinessPhase: 'red' | 'white' | 'green' | null =
    r === 'not_ready' ? 'red' : r === 'ready' ? 'white' : r === 'success' ? 'green' : null;
  const emittedAtMs = correctiveAntiSpamState.lastEmittedAtMs;
  return {
    ...obs,
    latchedKey: correctiveAntiSpamState.correctiveLatchedKey,
    lastReadiness: correctiveAntiSpamState.lastReadiness,
    readinessPhase,
    emittedAtMs,
    nextEligibleAtMs: emittedAtMs !== null ? emittedAtMs + REPEAT_COOLDOWN_MS : null,
    readyToShootPlayed: correctiveAntiSpamState.readyToShootPlayedThisSession,
  };
}

async function playVoiceCue(cue: VoiceCue | null, waitUntilEnd: boolean): Promise<boolean> {
  if (!cue || typeof window === 'undefined' || !runtimeState.unlocked) {
    return false;
  }

  const decision = decideVoicePlayback(runtimeState, cue, Date.now());
  if (!decision.allowed) {
    return false;
  }

  /* PR E: single-channel — always cancel any active playback before starting new */
  cancelVoiceGuidance();

  runtimeState.lastSpokenAt[cue.dedupeKey] = Date.now();
  runtimeState.activeCueKey = cue.dedupeKey;
  runtimeState.activePriority = cue.priority;

  const currentCueKey = cue.dedupeKey;
  let waitResolve: ((ok: boolean) => void) | null = null;
  let waitSettled = false;

  const settleWait = (ok: boolean) => {
    if (!waitUntilEnd || waitSettled) {
      return;
    }
    waitSettled = true;
    if (runtimeState.waitResolver === settleWait) {
      runtimeState.waitResolver = null;
    }
    waitResolve?.(ok);
  };

  const speakWithTTS = async (text: string, opts: SpeakTTSOptions): Promise<boolean> => {
    const canSpeak =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined';
    if (!canSpeak) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = opts.rate ?? 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => {
        opts.onEnd?.();
      };
      utterance.onerror = () => {
        opts.onError?.();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  };

  const onEnd = () => {
    if (runtimeState.activeCueKey === currentCueKey) {
      runtimeState.activeCueKey = null;
      runtimeState.activePriority = 0;
    }
    settleWait(true);
  };

  const onError = () => {
    if (runtimeState.activeCueKey === currentCueKey) {
      runtimeState.activeCueKey = null;
      runtimeState.activePriority = 0;
    }
    void playFallbackBeep(cue);
    settleWait(false);
  };

  const playBeep = () => playFallbackBeep(cue);
  const waitPromise = waitUntilEnd
    ? new Promise<boolean>((resolve) => {
        waitResolve = resolve;
        runtimeState.waitResolver = settleWait;
      })
    : null;

  const ok = await playCueWithFallback(
    cue,
    speakWithTTS,
    playBeep,
    onEnd,
    onError
  );

  if (!ok) {
    runtimeState.activeCueKey = null;
    runtimeState.activePriority = 0;
    settleWait(false);
    return false;
  }

  if (!waitPromise) {
    return true;
  }

  return waitPromise;
}

export async function speakVoiceCue(cue: VoiceCue | null): Promise<boolean> {
  return playVoiceCue(cue, false);
}

export async function speakVoiceCueAndWait(cue: VoiceCue | null): Promise<boolean> {
  return playVoiceCue(cue, true);
}

export function getStartVoiceCue(stepId: CameraStepId): VoiceCue {
  return {
    kind: 'start',
    dedupeKey: `start:${stepId}`,
    text:
      stepId === 'squat'
        ? '촬영을 시작합니다. 카메라에서 떨어져 가이드 라인에 맞게 서주세요.'
        : '다음 동작입니다. 정면으로 서서 준비해주세요.',
    priority: 2,
    cooldownMs: 6000,
    fallbackBeep: false,
  };
}

/** squat 성공 후 overhead 진입 시 필수 follow-up intro.
 * "두번째 테스트입니다. 양 팔을 머리위로 끝까지 올려주세요" — Start follow-up testing.mp3 */
export function getFollowUpIntroVoiceCue(): VoiceCue {
  return {
    kind: 'start',
    dedupeKey: 'followup:intro',
    text: '두번째 테스트입니다. 양 팔을 머리위로 끝까지 올려주세요',
    priority: 2,
    cooldownMs: 8000,
    fallbackBeep: false,
  };
}

/** red → white 전환 순간 1회 재생되는 상태 전이 cue.
 * interrupt: true — 재생 중인 framing cue(priority 5)를 중단하고 우선 발화한다.
 * (decideVoicePlayback의 lower_priority_active 차단을 우회하기 위해 필요) */
export function getReadyToShootVoiceCue(): VoiceCue {
  return {
    kind: 'correction',
    dedupeKey: 'ready:setup',
    text: '촬영 준비됐어요',
    priority: 3,
    cooldownMs: 6000,
    fallbackBeep: false,
    interrupt: true,
  };
}

export function getCountdownVoiceCue(value: 1 | 2 | 3): VoiceCue {
  return {
    kind: 'countdown',
    dedupeKey: `countdown:${value}`,
    text: String(value),
    priority: 5,
    cooldownMs: 900,
    interrupt: true,
    fallbackBeep: true,
  };
}

export function getSuccessVoiceCue(): VoiceCue {
  return {
    kind: 'success',
    dedupeKey: 'success:generic',
    text: '잘했어요',
    priority: 6,
    cooldownMs: 1500,
    interrupt: true,
    fallbackBeep: true,
  };
}

/** 마지막 성공(전체 퍼널 완료) 시 outro cue. "테스트 완료. 잠시 후 결과가 나옵니다" — Test complete.mp3 */
export function getFinalSuccessVoiceCue(): VoiceCue {
  return {
    kind: 'success',
    dedupeKey: 'success:final',
    text: '테스트 완료. 잠시 후 결과가 나옵니다',
    priority: 6,
    cooldownMs: 2000,
    interrupt: true,
    fallbackBeep: true,
  };
}

export function getCorrectiveVoiceCue(
  stepId: CameraStepId,
  gate: VoiceGuidanceGate
): VoiceCue | null {
  const failureReasons = gate.failureReasons ?? [];
  const flags = gate.guardrail?.flags ?? [];
  const blockFramingSpeech = gate.readinessState === 'ready';
  const effectiveFailureReasons = blockFramingSpeech
    ? failureReasons.filter(
        (reason) => !FRAMING_REASONS.includes(reason as (typeof FRAMING_REASONS)[number])
      )
    : failureReasons;
  const effectiveFlags = blockFramingSpeech
    ? flags.filter((flag) => !FRAMING_REASONS.includes(flag as (typeof FRAMING_REASONS)[number]))
    : flags;
  const allReasons = [...effectiveFailureReasons, ...effectiveFlags];
  const isNotReady = gate.readinessState === 'not_ready';

  if (isNotReady && gate.framingHint) {
    const approvedText = toApprovedKoreanFramingText(gate.framingHint);
    if (!approvedText) return null;
    return {
      kind: 'correction',
      dedupeKey: `correction:framing-hint:${gate.framingHint}`,
      text: approvedText,
      priority: 5,
      cooldownMs: 3200,
      interrupt: true,
    };
  }

  // ankle_not_in_frame 블로커 시에도 full-body 안내 (발목 미감지 = 전신 미포함)
  const ankleYMean = gate.guardrail?.debug && 'ankleYMean' in gate.guardrail.debug
    ? gate.guardrail.debug.ankleYMean
    : undefined;
  if (isNotReady && ankleYMean === null) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:full-body',
      text: '머리부터 발끝까지 보이게 해주세요',
      priority: 5,
      cooldownMs: 3600,
      interrupt: true,
    };
  }

  if (isNotReady && (failureReasons.includes('left_side_missing') || failureReasons.includes('right_side_missing'))) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:full-body',
      text: '머리부터 발끝까지 보이게 해주세요',
      priority: 5,
      cooldownMs: 3600,
      interrupt: true,
    };
  }

  if (isNotReady && failureReasons.includes('capture_quality_invalid')) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:step-back',
      text: '조금 뒤로 가 주세요',
      priority: 5,
      cooldownMs: 3600,
      interrupt: true,
    };
  }

  if (isNotReady && hasAny(allReasons, FRAMING_REASONS)) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:framing',
      text: '전신이 화면에 들어오게 맞춰주세요',
      priority: 5,
      cooldownMs: 4200,
      interrupt: true,
    };
  }

  if (gate.progressionState === 'camera_ready' && gate.readinessState === 'ready') {
    return null;
  }

  if (hasAny(allReasons, STABILITY_REASONS)) {
    const recovery = getEffectiveRetryGuidance(stepId, {
      failureReasons: effectiveFailureReasons,
      guardrail: {
        ...gate.guardrail,
        flags: effectiveFlags,
      },
      userGuidance: gate.userGuidance,
    });
    return {
      kind: 'correction',
      dedupeKey: 'correction:stability',
      text: recovery.primary,
      priority: 4,
      cooldownMs: 4200,
    };
  }

  if (allReasons.includes('hold_too_short')) {
    /* PR-C4: overhead hold cue contract — near-success suppress, cue eligibility delay */
    if (stepId === 'overhead-reach') {
      const REQUIRED_HOLD_MS = 1200;
      const CUE_SUPPRESS_NEAR_SUCCESS_MS = 350;
      const CUE_ELIGIBILITY_DELAY_MS = 400;
      const holdDurationMs =
        gate.evaluatorResult?.debug?.highlightedMetrics?.holdDurationMs ?? 0;
      const remainingHoldMs = REQUIRED_HOLD_MS - holdDurationMs;
      if (remainingHoldMs <= CUE_SUPPRESS_NEAR_SUCCESS_MS) return null;
      if (holdDurationMs < CUE_ELIGIBILITY_DELAY_MS) return null;
    }
    return {
      kind: 'correction',
      dedupeKey: `correction:hold:${stepId}`,
      text: stepId === 'overhead-reach' ? '맨 위에서 잠깐 멈춰주세요' : '한 번 더 천천히 해주세요',
      priority: 3,
      cooldownMs: 4200,
    };
  }

  if (
    stepId === 'squat' &&
    gate.readinessState === 'ready' &&
    !isNotReady &&
    hasAny(allReasons, MOTION_REASONS)
  ) {
    const sc = gate.squatCycleDebug;
    const bottomStall =
      sc?.bottomDetected &&
      !sc.recoveryDetected &&
      sc.startBeforeBottom &&
      sc.descendDetected &&
      (sc.armingSatisfied ?? true);
    if (bottomStall) {
      return {
        kind: 'correction',
        dedupeKey: 'correction:squat:bottom-stall',
        text: '발로 바닥을 밀며 일어나주세요',
        priority: 3,
        cooldownMs: 4200,
      };
    }
  }

  if (hasAny(allReasons, MOTION_REASONS)) {
    const recovery = getEffectiveRetryGuidance(stepId, {
      failureReasons: effectiveFailureReasons,
      guardrail: {
        ...gate.guardrail,
        flags: effectiveFlags,
      },
      userGuidance: gate.userGuidance,
    });
    return {
      kind: 'correction',
      dedupeKey: `correction:motion:${stepId}`,
      text: recovery.primary,
      priority: 3,
      cooldownMs: 4200,
    };
  }

  return null;
}
