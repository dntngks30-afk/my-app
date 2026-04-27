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
      return {
        primary: '정면을 본 채 조금 떨어져 서 주세요 — 팔을 올려도 손목이 잘리지 않게',
        secondary: '머리 위·양옆에 여유가 있게 프레임을 맞춰 주세요',
      };
    }
    return { primary: '전신이 화면 안에 들어오게 서 주세요' };
  }

  if (hasAny(all, FRAMING_FLAGS)) {
    if (hasAny(all, ['left_side_missing', 'right_side_missing'])) {
      return stepId === 'overhead-reach'
        ? {
            primary: '머리부터 발끝까지 보이게 해 주세요',
            secondary: '팔을 머리 옆으로 올렸을 때도 손끝이 화면에 남게 거리를 조절해 주세요',
          }
        : { primary: '머리부터 발끝까지 보이게 해 주세요' };
    }
    if (gate.guardrail?.captureQuality === 'invalid') {
      return stepId === 'overhead-reach'
        ? {
            primary: '조금 뒤로 가 주세요',
            secondary: '양팔을 세워 올릴 공간이 화면 안에 들어오게 해 주세요',
          }
        : { primary: '조금 뒤로 가 주세요', secondary: '몸이 화면 안에서 더 크게 보이게 해 주세요' };
    }
    return stepId === 'overhead-reach'
      ? {
          primary: '전신이 보이도록 다시 맞춰 주세요',
          secondary: '정면을 유지하고, 맨 위에서 얼굴과 손목이 함께 보이게 해 주세요',
        }
      : { primary: '전신이 보이도록 다시 맞춰 주세요' };
  }

  if (hasAny(all, UNSTABLE_FLAGS)) {
    return { primary: '카메라를 고정하고 천천히 움직여주세요' };
  }

  if (
    gate.progressionState === 'insufficient_signal' ||
    hasAny(all, ['insufficient_signal', 'valid_frames_too_few'])
  ) {
    return stepId === 'overhead-reach'
      ? {
          primary: '조금만 더 유지해 주세요',
          secondary: '맨 위에서 손과 얼굴이 함께 보이게 유지해 주세요',
        }
      : { primary: '조금만 더 유지해 주세요' };
  }

  if (stepId === 'squat') {
    return { primary: '정면을 보고 준비해 주세요', secondary: '앉았다 일어나는 동작을 천천히 보여주세요' };
  }
  if (stepId === 'overhead-reach') {
    return {
      primary: '정면을 본 채 양팔을 머리 옆으로 세워 올려 주세요',
      secondary: '앞으로만 밀어 올리지 말고, 맨 위에서 얼굴과 손목이 함께 보이게 잠깐 멈춰 주세요',
    };
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
      return stepId === 'overhead-reach'
        ? {
            primary: '머리부터 발끝까지 보이게 해주세요',
            secondary: '한 걸음 뒤로 서서 손목이 잘리지 않게, 맨 위에서 얼굴과 손이 함께 보이게 해 주세요',
          }
        : { primary: '머리부터 발끝까지 보이게 해주세요' };
    }
    if (
      failureReasons.includes('left_side_missing') ||
      failureReasons.includes('right_side_missing')
    ) {
      return stepId === 'overhead-reach'
        ? {
            primary: '조금 더 가까이 와주세요',
            secondary: '전신이 들어오되, 팔을 머리 옆으로 올렸을 때 손이 화면에 남게 거리를 조절해 주세요',
          }
        : { primary: '조금 더 가까이 와주세요', secondary: '전신이 화면 안에 들어오게 맞춰 주세요' };
    }
    if (failureReasons.includes('hard_partial')) {
      return stepId === 'overhead-reach'
        ? {
            primary: '손목까지 화면에 들어오게 해 주세요',
            secondary: '정면을 본 채 양팔을 머리 옆으로 세워 올려 주세요',
          }
        : { primary: '손끝까지 보이게 해 주세요' };
    }
    if (
      failureReasons.includes('capture_quality_invalid') ||
      failureReasons.includes('capture_quality_low')
    ) {
      return stepId === 'overhead-reach'
        ? {
            primary: '몸이 화면 안에서 더 크게 보이게 해주세요',
            secondary: '너무 가깝지 않게 해서, 맨 위 자세에서 손과 얼굴이 함께 보이게 해 주세요',
          }
        : { primary: '몸이 화면 안에서 더 크게 보이게 해주세요' };
    }
    return stepId === 'overhead-reach'
      ? {
          primary: '전신이 보이도록 다시 맞춰 주세요',
          secondary: '정면·거리를 맞추고 양팔은 머리 옆으로 올려 카메라에 보이게 해 주세요',
        }
      : { primary: '전신이 보이도록 다시 맞춰 주세요' };
  }

  if (hasAny(all, UNSTABLE_FLAGS)) {
    return stepId === 'overhead-reach'
      ? {
          primary: '카메라를 고정하고 천천히 움직여주세요',
          secondary: '맨 위에서 손과 얼굴이 흔들리지 않게 잠깐 멈춰 주세요',
        }
      : { primary: '카메라를 고정하고 천천히 움직여주세요' };
  }

  if (failureReasons.includes('insufficient_signal') || flags.includes('valid_frames_too_few')) {
    return stepId === 'overhead-reach'
      ? {
          primary: '한 번 더 천천히 해주세요',
          secondary: '정면을 유지하고, 맨 위에서 손목이 얼굴 위쪽으로 보이게 잠깐 멈춰 주세요',
        }
      : { primary: '한 번 더 천천히 해주세요' };
  }

  if (flags.includes('hold_too_short')) {
    if (stepId === 'overhead-reach') {
      return {
        primary: '맨 위에서 잠깐 멈춰주세요',
        secondary: '손과 얼굴이 함께 화면에 보이는 상태로 유지해 주세요',
      };
    }
    return { primary: '한 번 더 천천히 해주세요' };
  }

  if (failureReasons.includes('rep_incomplete')) {
    if (stepId === 'squat') {
      return { primary: '조금 더 앉았다가 다시 올라와주세요' };
    }
    if (stepId === 'overhead-reach') {
      return {
        primary: '한 걸음 뒤로 서서 양팔을 머리 옆으로 끝까지 세워 올려 주세요',
        secondary: '정면을 본 채 맨 위에서 손목이 얼굴 위로 보이게 잠깐 멈춰 주세요',
      };
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
    return stepId === 'overhead-reach'
      ? {
          primary: '자세를 잠깐 고정한 뒤 다시 해주세요',
          secondary: '정면·거리를 유지하고 손과 얼굴이 동시에 잘 보이게 해 주세요',
        }
      : { primary: '자세를 잠깐 고정한 뒤 다시 해주세요' };
  }

  if (flags.includes('landmark_confidence_low')) {
    return stepId === 'overhead-reach'
      ? {
          primary: '조명을 조금 더 밝게 해주세요',
          secondary: '손목과 얼굴 윤곽이 카메라에 선명히 보이게 해 주세요',
        }
      : { primary: '조명을 조금 더 밝게 해주세요' };
  }

  return stepId === 'overhead-reach'
    ? {
        primary: '조금 더 안정적으로 해주세요',
        secondary: '뒤로 한 걸음, 정면, 머리 옆으로 팔을 올려 손과 얼굴이 함께 보이게 해 주세요',
      }
    : { primary: '조금 더 안정적으로 해주세요' };
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
        ? '촬영 거리와 정면이 맞으면 준비 완료예요'
        : null;
    return {
      badges: ['정면·거리', '머리 옆 팔', '손+얼굴', '맨 위 정지'],
      instructions: [
        '정면을 본 채 조금 떨어져 서서, 팔을 올려도 손목이 잘리지 않게 해 주세요',
        '양팔은 앞으로 밀지 말고 머리 양옆으로 세워 올려 주세요',
        '맨 위에서 얼굴·머리와 양 손목이 화면에 함께 보이게 잠깐 멈춰 주세요',
        '천천히 내릴 때도 전신이 프레임 안에 남도록 유지해 주세요',
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
  gate: Pick<ExerciseGateResult, 'failureReasons' | 'userGuidance'> & {
    /** Retry copy only consumes `flags`; full StepGuardrailResult is accepted. */
    guardrail?: Pick<ExerciseGateResult['guardrail'], 'flags'> | ExerciseGateResult['guardrail'] | null;
  }
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
