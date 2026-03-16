import type { CameraStepId } from '@/lib/public/camera-test';
import type { ExerciseGateResult } from './auto-progression';
import { getEffectiveRetryGuidance } from './camera-guidance';

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
  guardrail: Pick<ExerciseGateResult['guardrail'], 'captureQuality' | 'flags'>;
};

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
} = {
  activeCueKey: null,
  activePriority: 0,
  lastSpokenAt: {},
  unlocked: false,
  audioContext: null,
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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  runtimeState.activeCueKey = null;
  runtimeState.activePriority = 0;
}

export function resetVoiceGuidanceSession() {
  cancelVoiceGuidance();
  runtimeState.lastSpokenAt = {};
}

export async function speakVoiceCue(cue: VoiceCue | null): Promise<boolean> {
  if (!cue || typeof window === 'undefined' || !runtimeState.unlocked) {
    return false;
  }

  const decision = decideVoicePlayback(runtimeState, cue, Date.now());
  if (!decision.allowed) {
    return false;
  }

  if (decision.interruptActive) {
    cancelVoiceGuidance();
  }

  runtimeState.lastSpokenAt[cue.dedupeKey] = Date.now();
  runtimeState.activeCueKey = cue.dedupeKey;
  runtimeState.activePriority = cue.priority;

  const canSpeak =
    'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  if (!canSpeak) {
    const beepPlayed = await playFallbackBeep(cue);
    runtimeState.activeCueKey = null;
    runtimeState.activePriority = 0;
    return beepPlayed;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(cue.text);
    utterance.lang = 'ko-KR';
    utterance.rate = cue.kind === 'countdown' ? 0.96 : 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => {
      if (runtimeState.activeCueKey === cue.dedupeKey) {
        runtimeState.activeCueKey = null;
        runtimeState.activePriority = 0;
      }
    };
    utterance.onerror = () => {
      if (runtimeState.activeCueKey === cue.dedupeKey) {
        runtimeState.activeCueKey = null;
        runtimeState.activePriority = 0;
      }
      void playFallbackBeep(cue);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    runtimeState.activeCueKey = null;
    runtimeState.activePriority = 0;
    return playFallbackBeep(cue);
  }
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
    text: '좋아요',
    priority: 6,
    cooldownMs: 1500,
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
  const allReasons = [...failureReasons, ...flags];

  if (failureReasons.includes('left_side_missing') || failureReasons.includes('right_side_missing')) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:full-body',
      text: '머리부터 발끝까지 보이게 해주세요',
      priority: 5,
      cooldownMs: 3600,
      interrupt: true,
    };
  }

  if (failureReasons.includes('capture_quality_invalid')) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:step-back',
      text: '조금 뒤로 가 주세요',
      priority: 5,
      cooldownMs: 3600,
      interrupt: true,
    };
  }

  if (hasAny(allReasons, FRAMING_REASONS)) {
    return {
      kind: 'correction',
      dedupeKey: 'correction:framing',
      text: '전신이 화면에 들어오게 맞춰주세요',
      priority: 5,
      cooldownMs: 4200,
      interrupt: true,
    };
  }

  if (hasAny(allReasons, STABILITY_REASONS)) {
    const recovery = getEffectiveRetryGuidance(stepId, {
      failureReasons: gate.failureReasons,
      guardrail: gate.guardrail,
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
    return {
      kind: 'correction',
      dedupeKey: `correction:hold:${stepId}`,
      text: stepId === 'overhead-reach' ? '맨 위에서 잠깐 멈춰주세요' : '한 번 더 천천히 해주세요',
      priority: 3,
      cooldownMs: 4200,
    };
  }

  if (hasAny(allReasons, MOTION_REASONS)) {
    const recovery = getEffectiveRetryGuidance(stepId, {
      failureReasons: gate.failureReasons,
      guardrail: gate.guardrail,
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
