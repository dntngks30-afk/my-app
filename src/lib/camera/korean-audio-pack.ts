/**
 * PR D: Korean pre-recorded audio pack / playback abstraction
 *
 * 우선순위: 1) 사전 녹음 클립 → 2) speech synthesis → 3) 비프음 fallback
 * cue key 기반으로 클립 매핑, 클립 없으면 TTS로 안전 fallback
 */
import type { VoiceCue } from './voice-guidance';

/**
 * 지원하는 한국어 cue clip 키
 * public/audio/cues/ko 내 실제 파일명 기준
 */
export type KoreanCueClipKey =
  | 'start_capture'
  | 'start_follow_up_testing'
  | 'countdown_3'
  | 'countdown_2'
  | 'countdown_1'
  | 'framing_full_body'
  | 'framing_center_body'
  | 'framing_hold_still'
  | 'framing_step_back'
  | 'move_slowly'
  | 'squat_go_deeper'
  | 'push_floor_with_foot'
  | 'overhead_raise_higher'
  | 'overhead_hold_top'
  | 'good_job'
  | 'test_complete'
  | 'success'
  | 'ready_to_shoot';

/** dedupeKey → clip key 매핑 (정적 cue, 실제 파일명 사용) */
const DEDUPE_KEY_TO_CLIP: Record<string, KoreanCueClipKey> = {
  'ready:setup': 'ready_to_shoot',
  'start:squat': 'start_capture',
  'start:overhead-reach': 'start_capture',
  'countdown:3': 'countdown_3',
  'countdown:2': 'countdown_2',
  'countdown:1': 'countdown_1',
  'correction:full-body': 'framing_full_body',
  'correction:step-back': 'framing_step_back',
  'correction:framing': 'framing_center_body',
  'correction:hold:overhead-reach': 'overhead_hold_top',
  'correction:motion:overhead-reach': 'overhead_raise_higher',
  'correction:squat:bottom-stall': 'push_floor_with_foot',
  'success:generic': 'good_job',
  'success:final': 'test_complete',
};

/** recovery.primary 텍스트 → clip key (동적 cue, 실제 파일명 사용) */
const TEXT_TO_CLIP: Record<string, KoreanCueClipKey> = {
  '카메라를 고정하고 천천히 움직여주세요': 'move_slowly',
  '조금 뒤로 가 주세요': 'framing_step_back',
  '조금 더 깊게 앉아주세요': 'squat_go_deeper',
  '조금 더 앉았다가 다시 올라와주세요': 'squat_go_deeper',
  '양팔을 머리 위로 끝까지 올려주세요': 'overhead_raise_higher',
  '두번째 테스트입니다. 양 팔을 머리위로 끝까지 올려주세요': 'start_follow_up_testing',
  '맨 위에서 잠깐 멈춰주세요': 'overhead_hold_top',
  '발로 바닥을 밀며 일어나주세요': 'push_floor_with_foot',
  '자세를 잠깐 고정한 뒤 다시 해주세요': 'framing_hold_still',
  '전신이 화면에 들어오게 맞춰주세요': 'framing_center_body',
  '테스트 완료. 잠시 후 결과가 나옵니다': 'test_complete',
};

const AUDIO_BASE = '/audio/cues/ko';

/**
 * cue에서 clip key를 결정
 */
export function resolveCueToClipKey(cue: VoiceCue): KoreanCueClipKey | null {
  const fromDedupe = DEDUPE_KEY_TO_CLIP[cue.dedupeKey];
  if (fromDedupe) return fromDedupe;

  const fromText = TEXT_TO_CLIP[cue.text];
  if (fromText) return fromText;

  return null;
}

/** clip key → 실제 파일명 (공백 등 포함, 기본은 key.mp3) */
const CLIP_KEY_TO_FILENAME: Partial<Record<KoreanCueClipKey, string>> = {
  push_floor_with_foot: 'Push the floor with your foot.mp3',
  start_follow_up_testing: 'Start follow-up testing.mp3',
  test_complete: 'Test complete.mp3',
};

/**
 * clip key → public 경로
 */
export function getClipPath(clipKey: KoreanCueClipKey): string {
  const filename = CLIP_KEY_TO_FILENAME[clipKey] ?? `${clipKey}.mp3`;
  return `${AUDIO_BASE}/${filename}`;
}

/** How a clip playback run terminated (clip mode only). */
export type ClipTerminalMode = 'ended' | 'near_end' | 'watchdog' | 'error';

/** PR D: playback observability */
export interface PlaybackObservability {
  cueKey: string;
  clipKey: KoreanCueClipKey | null;
  clipPath: string | null;
  mode: 'clip' | 'speech' | 'beep';
  clipMissing?: boolean;
  clipFailed?: boolean;
  /** PR-P0: load stalled (no canplaythrough/error within CLIP_LOAD_TIMEOUT_MS) */
  clipLoadTimedOut?: boolean;
  /** PR Safari: which path fired first to complete waited clip playback */
  clipTerminalMode?: ClipTerminalMode;
  success: boolean;
}

const playbackObsState: {
  last: PlaybackObservability | null;
} = {
  last: null,
};

export function getLastPlaybackObservability(): PlaybackObservability | null {
  return playbackObsState.last;
}

function setPlaybackObs(obs: PlaybackObservability) {
  playbackObsState.last = obs;
}

/**
 * PR-P0-START-SEQUENCE-AUDIO-BLOCK-GUARD-01 / PR-P0-WAITED-CUE-COMPLETION-UNBLOCK-01:
 * clip load stall on new domains must not block indefinitely — fall through to TTS/beep.
 */
const CLIP_LOAD_TIMEOUT_MS = 8000;

/**
 * PR-P0-WAITED-CUE-COMPLETION-UNBLOCK-01: Safari/WebKit may omit `ended` after audible play;
 * release waited callers with near-end + duration+slack watchdog (single-fire).
 */
const CLIP_COMPLETION_SLACK_MS = 1500;
const CLIP_COMPLETION_UNKNOWN_DURATION_MS = 18000;
const CLIP_COMPLETION_MAX_MS = 60000;
/** Safari-safe: treat as terminal when within this many seconds of duration */
const CLIP_NEAR_END_EPSILON_SEC = 0.14;

/** 재생 중인 Audio 인스턴스 (cancel 시 정지용) */
let activeClipAudio: HTMLAudioElement | null = null;

/** Removes listeners/timers only — never invokes clip onEnd/onError (cancel / unmount). */
let activeClipCleanup: (() => void) | null = null;

export function cancelClipPlayback() {
  const cleanup = activeClipCleanup;
  activeClipCleanup = null;
  if (cleanup) {
    try {
      cleanup();
    } catch {
      /* ignore */
    }
  }
  if (activeClipAudio) {
    try {
      activeClipAudio.pause();
      activeClipAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeClipAudio = null;
  }
}

/**
 * pre-recorded clip 재생 시도
 */
async function tryPlayClip(
  clipKey: KoreanCueClipKey,
  onEnd: () => void,
  onError: () => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const path = getClipPath(clipKey);
  const audio = new Audio(path);

  type LoadResult = { ok: true } | { ok: false; reason: 'error' | 'timeout' };
  const loadResult = await new Promise<LoadResult>((resolve) => {
    let settled = false;
    const finish = (result: LoadResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
      audio.removeEventListener('error', onError);
      resolve(result);
    };
    const onCanPlayThrough = () => finish({ ok: true });
    const onError = () => finish({ ok: false, reason: 'error' });
    const timeoutId = window.setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[korean-audio-pack] clip load timeout', { clipKey, path });
      }
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        /* ignore */
      }
      finish({ ok: false, reason: 'timeout' });
    }, CLIP_LOAD_TIMEOUT_MS);
    audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.load();
  });

  if (!loadResult.ok) {
    setPlaybackObs({
      cueKey: clipKey,
      clipKey,
      clipPath: getClipPath(clipKey),
      mode: 'speech',
      clipMissing: loadResult.reason === 'error',
      clipLoadTimedOut: loadResult.reason === 'timeout',
      success: false,
    });
    return false;
  }

  try {
    let clipPlaybackSettled = false;
    let clipCompletionSafetyId: ReturnType<typeof window.setTimeout> | null = null;

    function clearClipCompletionSafety() {
      if (clipCompletionSafetyId !== null) {
        window.clearTimeout(clipCompletionSafetyId);
        clipCompletionSafetyId = null;
      }
    }

    function clipCompletionSafetyDelayMs(): number {
      const d = audio.duration;
      if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
        return Math.min(d * 1000 + CLIP_COMPLETION_SLACK_MS, CLIP_COMPLETION_MAX_MS);
      }
      return CLIP_COMPLETION_UNKNOWN_DURATION_MS;
    }

    function onEnded() {
      settleClipComplete('ended');
    }

    function onPlaybackError() {
      settleClipError();
    }

    function onTimeUpdate() {
      if (clipPlaybackSettled) return;
      const d = audio.duration;
      if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) return;
      if (audio.currentTime >= Math.max(0, d - CLIP_NEAR_END_EPSILON_SEC)) {
        settleClipComplete('near_end');
      }
    }

    function onLoadedMetadataForArm() {
      armClipCompletionSafety();
    }

    function cleanupPlaybackResources() {
      clearClipCompletionSafety();
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onPlaybackError);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadataForArm);
    }

    function applyClipTerminalObs(terminal: ClipTerminalMode) {
      const prev = playbackObsState.last;
      if (!prev || prev.mode !== 'clip') return;
      setPlaybackObs({
        ...prev,
        clipTerminalMode: terminal,
        success: terminal !== 'error',
      });
    }

    function armClipCompletionSafety() {
      clearClipCompletionSafety();
      if (clipPlaybackSettled) return;
      const ms = clipCompletionSafetyDelayMs();
      clipCompletionSafetyId = window.setTimeout(() => {
        clipCompletionSafetyId = null;
        if (clipPlaybackSettled) return;
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[korean-audio-pack] clip terminal watchdog', {
            clipKey,
            path,
            scheduledMs: ms,
          });
        }
        settleClipComplete('watchdog');
      }, ms);
    }

    function settleClipComplete(terminal: 'ended' | 'near_end' | 'watchdog') {
      if (clipPlaybackSettled) return;
      clipPlaybackSettled = true;
      activeClipCleanup = null;
      cleanupPlaybackResources();
      activeClipAudio = null;
      applyClipTerminalObs(terminal);
      onEnd();
    }

    function settleClipError() {
      if (clipPlaybackSettled) return;
      clipPlaybackSettled = true;
      activeClipCleanup = null;
      cleanupPlaybackResources();
      activeClipAudio = null;
      onError();
      setPlaybackObs({
        cueKey: clipKey,
        clipKey,
        clipPath: getClipPath(clipKey),
        mode: 'speech',
        clipFailed: true,
        clipTerminalMode: 'error',
        success: false,
      });
    }

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onPlaybackError, { once: true });
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadataForArm, { once: true });

    activeClipCleanup = () => {
      cleanupPlaybackResources();
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      if (activeClipAudio === audio) {
        activeClipAudio = null;
      }
    };

    activeClipAudio = audio;
    await audio.play();
    setPlaybackObs({
      cueKey: clipKey,
      clipKey,
      clipPath: getClipPath(clipKey),
      mode: 'clip',
      success: true,
    });
    armClipCompletionSafety();
    return true;
  } catch {
    const cleanup = activeClipCleanup;
    activeClipCleanup = null;
    if (cleanup) {
      try {
        cleanup();
      } catch {
        /* ignore */
      }
    }
    activeClipAudio = null;
    setPlaybackObs({
      cueKey: clipKey,
      clipKey,
      clipPath: getClipPath(clipKey),
      mode: 'speech',
      clipFailed: true,
      success: false,
    });
    return false;
  }
}

/** TTS 콜백 타입 */
export interface SpeakTTSOptions {
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * PR D: playback 추상화 — clip 우선, speech fallback, beep 최종 fallback
 */
export async function playCueWithFallback(
  cue: VoiceCue,
  speakWithTTS: (text: string, opts: SpeakTTSOptions) => Promise<boolean>,
  playBeep: () => Promise<boolean>,
  onClipOrSpeechEnd: () => void,
  onClipOrSpeechError: () => void
): Promise<boolean> {
  const clipKey = resolveCueToClipKey(cue);

  if (clipKey) {
    const played = await tryPlayClip(
      clipKey,
      onClipOrSpeechEnd,
      onClipOrSpeechError
    );
    if (played) return true;
  } else {
    setPlaybackObs({
      cueKey: cue.dedupeKey,
      clipKey: null,
      mode: 'speech',
      clipMissing: true,
      success: false,
    });
  }

  const rate = cue.kind === 'countdown' ? 0.96 : 1;
  const ttsOk = await speakWithTTS(cue.text, {
    rate,
    onEnd: onClipOrSpeechEnd,
    onError: onClipOrSpeechError,
  });

  if (ttsOk) {
    setPlaybackObs({
      cueKey: cue.dedupeKey,
      clipKey: clipKey ?? null,
      clipPath: clipKey ? getClipPath(clipKey) : null,
      mode: 'speech',
      success: true,
    });
    return true;
  }

  const beepOk = await playBeep();
  setPlaybackObs({
    cueKey: cue.dedupeKey,
    clipKey: clipKey ?? null,
    clipPath: clipKey ? getClipPath(clipKey) : null,
    mode: 'beep',
    success: beepOk,
  });
  return beepOk;
}
