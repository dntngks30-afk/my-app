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
  | 'countdown_3'
  | 'countdown_2'
  | 'countdown_1'
  | 'framing_full_body'
  | 'framing_center_body'
  | 'framing_hold_still'
  | 'framing_step_back'
  | 'move_slowly'
  | 'squat_go_deeper'
  | 'overhead_raise_higher'
  | 'overhead_hold_top'
  | 'good_job'
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
  'success:generic': 'good_job',
};

/** recovery.primary 텍스트 → clip key (동적 cue, 실제 파일명 사용) */
const TEXT_TO_CLIP: Record<string, KoreanCueClipKey> = {
  '카메라를 고정하고 천천히 움직여주세요': 'move_slowly',
  '조금 뒤로 가 주세요': 'framing_step_back',
  '조금 더 깊게 앉아주세요': 'squat_go_deeper',
  '조금 더 앉았다가 다시 올라와주세요': 'squat_go_deeper',
  '양팔을 머리 위로 끝까지 올려주세요': 'overhead_raise_higher',
  '맨 위에서 잠깐 멈춰주세요': 'overhead_hold_top',
  '자세를 잠깐 고정한 뒤 다시 해주세요': 'framing_hold_still',
  '전신이 화면에 들어오게 맞춰주세요': 'framing_center_body',
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

/**
 * clip key → public 경로
 */
export function getClipPath(clipKey: KoreanCueClipKey): string {
  return `${AUDIO_BASE}/${clipKey}.mp3`;
}

/** PR D: playback observability */
export interface PlaybackObservability {
  cueKey: string;
  clipKey: KoreanCueClipKey | null;
  clipPath: string | null;
  mode: 'clip' | 'speech' | 'beep';
  clipMissing?: boolean;
  clipFailed?: boolean;
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

/** 재생 중인 Audio 인스턴스 (cancel 시 정지용) */
let activeClipAudio: HTMLAudioElement | null = null;

export function cancelClipPlayback() {
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

  const loaded = await new Promise<boolean>((resolve) => {
    audio.addEventListener('canplaythrough', () => resolve(true), { once: true });
    audio.addEventListener('error', () => resolve(false), { once: true });
    audio.load();
  });

  if (!loaded) {
    setPlaybackObs({
      cueKey: clipKey,
      clipKey,
      clipPath: getClipPath(clipKey),
      mode: 'speech',
      clipMissing: true,
      success: false,
    });
    return false;
  }

  try {
    audio.addEventListener('ended', () => {
      activeClipAudio = null;
      onEnd();
    }, { once: true });
    audio.addEventListener('error', () => {
      activeClipAudio = null;
      onError();
      setPlaybackObs({
        cueKey: clipKey,
        clipKey,
        clipPath: getClipPath(clipKey),
        mode: 'speech',
        clipFailed: true,
        success: false,
      });
    }, { once: true });

    activeClipAudio = audio;
    await audio.play();
    setPlaybackObs({
      cueKey: clipKey,
      clipKey,
      clipPath: getClipPath(clipKey),
      mode: 'clip',
      success: true,
    });
    return true;
  } catch {
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
