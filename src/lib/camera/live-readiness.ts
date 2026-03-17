import { useEffect, useRef, useState } from 'react';
import type { CameraGuideTone } from './auto-progression';
import type { StepGuardrailResult } from './guardrails';

export type LiveReadinessState = 'not_ready' | 'ready' | 'success';

export interface LiveReadinessInput {
  success: boolean;
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags' | 'debug'>;
  framingHint?: string | null;
}

export interface LiveReadinessSummary {
  state: LiveReadinessState;
  blockers: {
    severeFramingInvalid: boolean;
    landmarkPresenceEnough: boolean;
    fullBodyVisibleEnough: boolean;
    minimalFramesReady: boolean;
  };
  framingHint: string | null;
  activeBlockers: string[];
  inputs: {
    validFrameCount: number;
    visibleJointsRatio: number;
    criticalJointsAvailability: number;
  };
}

export interface StabilizedLiveReadiness {
  stableState: LiveReadinessState;
  smoothingApplied: boolean;
}

const MIN_READY_VALID_FRAMES = 2;
const MIN_READY_VISIBLE_JOINTS_RATIO = 0.35;
const MIN_READY_CRITICAL_AVAILABILITY = 0.3;
const READY_ENTER_DELAY_MS = 60;
const NOT_READY_EXIT_DELAY_MS = 120;

export function getLiveReadinessSummary(input: LiveReadinessInput): LiveReadinessSummary {
  const {
    validFrameCount,
    visibleJointsRatio,
    criticalJointsAvailability,
  } = input.guardrail.debug;

  if (input.success) {
    return {
      state: 'success',
      blockers: {
        severeFramingInvalid: false,
        landmarkPresenceEnough: true,
        fullBodyVisibleEnough: true,
        minimalFramesReady: true,
      },
      framingHint: input.framingHint ?? null,
      activeBlockers: [],
      inputs: {
        validFrameCount,
        visibleJointsRatio,
        criticalJointsAvailability,
      },
    };
  }

  const blockers = {
    severeFramingInvalid: Boolean(input.framingHint),
    landmarkPresenceEnough: criticalJointsAvailability >= MIN_READY_CRITICAL_AVAILABILITY,
    fullBodyVisibleEnough: visibleJointsRatio >= MIN_READY_VISIBLE_JOINTS_RATIO,
    minimalFramesReady: validFrameCount >= MIN_READY_VALID_FRAMES,
  };

  const activeBlockers: string[] = [];
  if (blockers.severeFramingInvalid) activeBlockers.push(input.framingHint ?? 'framing_invalid');
  if (!blockers.minimalFramesReady) activeBlockers.push('valid_frames_too_few');
  if (!blockers.fullBodyVisibleEnough) activeBlockers.push('visible_landmarks_too_low');
  if (!blockers.landmarkPresenceEnough) activeBlockers.push('critical_landmarks_too_low');

  return {
    state: activeBlockers.length > 0 ? 'not_ready' : 'ready',
    blockers,
    framingHint: input.framingHint ?? null,
    activeBlockers,
    inputs: {
      validFrameCount,
      visibleJointsRatio,
      criticalJointsAvailability,
    },
  };
}

export function getLiveReadinessState(input: LiveReadinessInput): LiveReadinessState {
  return getLiveReadinessSummary(input).state;
}

export function useStabilizedLiveReadiness(
  rawState: LiveReadinessState
): StabilizedLiveReadiness {
  const [stableState, setStableState] = useState<LiveReadinessState>(rawState);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (rawState === stableState) {
      return;
    }

    if (rawState === 'success') {
      setStableState('success');
      return;
    }

    // Keep readiness permissive, but absorb single-frame noise before repainting red/white.
    const delayMs = rawState === 'ready' ? READY_ENTER_DELAY_MS : NOT_READY_EXIT_DELAY_MS;
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setStableState(rawState);
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [rawState, stableState]);

  return {
    stableState,
    smoothingApplied: stableState !== rawState,
  };
}

export function getPrimaryReadinessBlocker(
  summary: LiveReadinessSummary
): string | null {
  return summary.activeBlockers[0] ?? null;
}

export function getGuideToneFromLiveReadiness(
  readiness: LiveReadinessState
): CameraGuideTone {
  if (readiness === 'success') return 'success';
  if (readiness === 'ready') return 'neutral';
  return 'warning';
}
