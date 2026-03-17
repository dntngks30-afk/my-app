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

/** WHITE requires all of these; fallback is RED when uncertain or any blocker. */
const MIN_READY_VALID_FRAMES = 4;
const MIN_READY_VISIBLE_JOINTS_RATIO = 0.42;
const MIN_READY_CRITICAL_AVAILABILITY = 0.38;
const READY_ENTER_DELAY_MS = 60;

function isReadinessInputValid(debug: LiveReadinessInput['guardrail']['debug']): boolean {
  if (!debug) return false;
  const v = debug.validFrameCount;
  const vis = debug.visibleJointsRatio;
  const crit = debug.criticalJointsAvailability;
  return (
    typeof v === 'number' &&
    !Number.isNaN(v) &&
    typeof vis === 'number' &&
    !Number.isNaN(vis) &&
    typeof crit === 'number' &&
    !Number.isNaN(crit)
  );
}

export function getLiveReadinessSummary(input: LiveReadinessInput): LiveReadinessSummary {
  const debug = input.guardrail?.debug;
  const validFrameCount = debug?.validFrameCount ?? 0;
  const visibleJointsRatio = debug?.visibleJointsRatio ?? 0;
  const criticalJointsAvailability = debug?.criticalJointsAvailability ?? 0;

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

  /** Default to RED when uncertain: missing/invalid debug data. */
  if (!isReadinessInputValid(debug)) {
    return {
      state: 'not_ready',
      blockers: {
        severeFramingInvalid: Boolean(input.framingHint),
        landmarkPresenceEnough: false,
        fullBodyVisibleEnough: false,
        minimalFramesReady: false,
      },
      framingHint: input.framingHint ?? null,
      activeBlockers: ['readiness_uncertain'],
      inputs: {
        validFrameCount,
        visibleJointsRatio,
        criticalJointsAvailability,
      },
    };
  }

  /** Explicit RED blockers: any of these -> not_ready. */
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

  /** WHITE only when ALL minimum framing readiness conditions are satisfied. Else RED. */
  const state: LiveReadinessState =
    activeBlockers.length === 0 ? 'ready' : 'not_ready';

  return {
    state,
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

    /** RED applies immediately when blockers appear; no sticky-white. */
    if (rawState === 'not_ready') {
      setStableState('not_ready');
      return;
    }

    /** WHITE: small delay to absorb single-frame noise before repainting. */
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setStableState(rawState);
    }, READY_ENTER_DELAY_MS);

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
