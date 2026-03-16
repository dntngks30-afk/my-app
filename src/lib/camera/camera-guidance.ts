/**
 * PR-5: 카메라 프레이밍/재시도 가이드
 * - 사용자용 짧은 안내 문구 (한국어)
 * - 기술 용어 노출 없음
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import type { ExerciseGateResult } from './auto-progression';

/** Pre-capture 단계용 설정 안내 */
export interface PreCaptureGuidance {
  primary: string;
  secondary?: string;
}

/** Retry 시 복구 안내 (우선순위 적용) */
export interface RetryRecoveryGuidance {
  primary: string;
  secondary?: string;
}

/** 동작별 기본 설정 가이드 */
export interface MovementSetupGuide {
  badges: string[];
  instructions: string[];
  readinessLabel: string | null;
}

const FRAMING_FLAGS = [
  'framing_invalid',
  'hard_partial',
  'left_side_missing',
  'right_side_missing',
  'capture_quality_invalid',
  'capture_quality_low',
] as const;

const UNSTABLE_FLAGS = [
  'unstable_frame_timing',
  'unstable_bbox',
  'unstable_landmarks',
] as const;

const MOTION_FLAGS = ['rep_incomplete', 'hold_too_short'] as const;

function hasAny(reasons: string[], list: readonly string[]): boolean {
  return list.some((r) => reasons.includes(r));
}

/**
 * Pre-capture 단계에서 표시할 설정 안내
 * camera_ready, insufficient_signal, detecting 시 사용
 */
export function getPreCaptureGuidance(
  stepId: CameraStepId,
  gate: Pick<
    ExerciseGateResult,
    'guardrail' | 'flags' | 'failureReasons' | 'progressionState'
  >,
  sampledFrameCount: number
): PreCaptureGuidance {
  const flags = gate.guardrail?.flags ?? [];
  const failureReasons = gate.failureReasons ?? [];
  const all = [...flags, ...failureReasons];

  if (sampledFrameCount === 0) {
    if (stepId === 'squat') {
      return { primary: '전신이 화면 안에 들어오게 서 주세요' };
    }
    if (stepId === 'overhead-reach') {
      return { primary: '팔이 화면 안에 모두 보이게 해 주세요' };
    }
    return { primary: '전신이 화면 안에 들어오게 서 주세요' };
  }

  if (hasAny(all, FRAMING_FLAGS)) {
    if (hasAny(all, ['left_side_missing', 'right_side_missing'])) {
      return { primary: '머리부터 발끝까지 보이게 해 주세요' };
    }
    if (gate.guardrail?.captureQuality === 'invalid') {
      return { primary: '조금 뒤로 가 주세요', secondary: '몸이 화면 안에서 더 크게 보이게 해 주세요' };
    }
    return { primary: '전신이 보이도록 다시 맞춰 주세요' };
  }

  if (hasAny(all, UNSTABLE_FLAGS)) {
    return { primary: '카메라를 고정하고 천천히 움직여주세요' };
  }

  if (
    gate.progressionState === 'insufficient_signal' ||
    hasAny(all, ['insufficient_signal', 'valid_frames_too_few'])
  ) {
    return { primary: '조금만 더 유지해 주세요' };
  }

  if (stepId === 'squat') {
    return { primary: '정면을 보고 준비해 주세요', secondary: '앉았다 일어나는 동작을 천천히 보여주세요' };
  }
  if (stepId === 'overhead-reach') {
    return { primary: '정면을 보고 준비해 주세요', secondary: '팔을 끝까지 올리고 잠깐 유지해 주세요' };
  }

  return { primary: '정면을 보고 준비해 주세요' };
}

/**
 * Retry 시 복구 안내 (우선순위: framing > joints > unstable > motion > generic)
 */
export function getRetryRecoveryGuidance(
  stepId: CameraStepId,
  failureReasons: string[],
  flags: string[]
): RetryRecoveryGuidance {
  const all = [...failureReasons, ...flags];

  if (hasAny(all, FRAMING_FLAGS)) {
    if (failureReasons.includes('framing_invalid')) {
      return { primary: '머리부터 발끝까지 보이게 해주세요' };
    }
    if (
      failureReasons.includes('left_side_missing') ||
      failureReasons.includes('right_side_missing')
    ) {
      return { primary: '조금 더 가까이 와주세요', secondary: '전신이 화면 안에 들어오게 맞춰 주세요' };
    }
    if (failureReasons.includes('hard_partial')) {
      return { primary: '손끝까지 보이게 해 주세요' };
    }
    if (
      failureReasons.includes('capture_quality_invalid') ||
      failureReasons.includes('capture_quality_low')
    ) {
      return { primary: '몸이 화면 안에서 더 크게 보이게 해주세요' };
    }
    return { primary: '전신이 보이도록 다시 맞춰 주세요' };
  }

  if (hasAny(all, UNSTABLE_FLAGS)) {
    return { primary: '카메라를 고정하고 천천히 움직여주세요' };
  }

  if (failureReasons.includes('insufficient_signal') || flags.includes('valid_frames_too_few')) {
    return { primary: '한 번 더 천천히 해주세요' };
  }

  if (flags.includes('hold_too_short')) {
    if (stepId === 'overhead-reach') {
      return { primary: '맨 위에서 잠깐 멈춰주세요' };
    }
    return { primary: '한 번 더 천천히 해주세요' };
  }

  if (failureReasons.includes('rep_incomplete')) {
    if (stepId === 'squat') {
      return { primary: '조금 더 앉았다가 다시 올라와주세요' };
    }
    if (stepId === 'overhead-reach') {
      return { primary: '양팔을 머리 위로 끝까지 올려주세요' };
    }
    return { primary: '한 번 더 천천히 해주세요' };
  }

  if (failureReasons.includes('depth_not_reached')) {
    return { primary: '조금 더 깊게 앉아주세요' };
  }

  if (failureReasons.includes('ascent_not_detected')) {
    return { primary: '조금 더 앉았다가 다시 올라와주세요' };
  }

  if (failureReasons.includes('confidence_too_low')) {
    return { primary: '자세를 잠깐 고정한 뒤 다시 해주세요' };
  }

  if (flags.includes('landmark_confidence_low')) {
    return { primary: '조명을 조금 더 밝게 해주세요' };
  }

  return { primary: '조금 더 안정적으로 해주세요' };
}

/**
 * 동작별 기본 설정 가이드 (guideBadges, guideInstructions, readinessLabel)
 */
export function getMovementSetupGuide(
  stepId: CameraStepId,
  gate: Pick<ExerciseGateResult, 'guardrail' | 'flags'> | null
): MovementSetupGuide {
  if (stepId === 'squat') {
    const readinessLabel =
      gate &&
      gate.guardrail?.captureQuality !== 'invalid' &&
      !gate.flags?.includes('framing_invalid') &&
      !gate.flags?.includes('hard_partial') &&
      !gate.flags?.includes('left_side_missing') &&
      !gate.flags?.includes('right_side_missing')
        ? '전신이 잘 보여요'
        : null;
    return {
      badges: ['전신 촬영', '정면', '천천히'],
      instructions: [
        '발을 어깨 너비로 벌리고 서 주세요',
        '앉았다 일어나는 동작을 천천히 보여주세요',
        '머리부터 발끝까지 화면에 들어오게 맞춰 주세요',
      ],
      readinessLabel,
    };
  }

  if (stepId === 'overhead-reach') {
    const readinessLabel =
      gate &&
      gate.guardrail?.captureQuality !== 'invalid' &&
      !gate.flags?.includes('framing_invalid') &&
      !gate.flags?.includes('hard_partial') &&
      !gate.flags?.includes('left_side_missing') &&
      !gate.flags?.includes('right_side_missing')
        ? '양팔과 손끝이 잘 보여요'
        : null;
    return {
      badges: ['정면 촬영', '상체+손끝 보이기', '1초 정지'],
      instructions: [
        '정면으로 서서 양팔을 머리 위로 올려주세요',
        '맨 위에서 잠깐 멈춘 뒤 천천히 내려주세요',
        '허리를 과하게 꺾지 말고 길게 뻗어주세요',
      ],
      readinessLabel,
    };
  }

  return { badges: [], instructions: [], readinessLabel: null };
}

/**
 * Retry 상태에서 표시할 사용자 안내 (gate.userGuidance 대체 또는 보완)
 * 우선순위 적용된 1차 메시지 + 선택적 2차
 */
export function getEffectiveRetryGuidance(
  stepId: CameraStepId,
  gate: Pick<ExerciseGateResult, 'failureReasons' | 'guardrail' | 'userGuidance'>
): { primary: string; secondary?: string } {
  const recovery = getRetryRecoveryGuidance(
    stepId,
    gate.failureReasons ?? [],
    gate.guardrail?.flags ?? []
  );
  const existing = gate.userGuidance ?? [];
  const secondary =
    recovery.secondary ?? (existing[0] !== recovery.primary ? existing[0] : existing[1]);
  return {
    primary: recovery.primary,
    secondary: secondary && secondary !== recovery.primary ? secondary : undefined,
  };
}
