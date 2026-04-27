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
    /** 발목이 화면 하단부에 있는지 (전신 포함 여부 rough 체크) */
    ankleVisibleInFrame: boolean;
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
const MIN_READY_VALID_FRAMES = 8;
const MIN_READY_VISIBLE_JOINTS_RATIO = 0.70;
const MIN_READY_CRITICAL_AVAILABILITY = 0.65;
const READY_ENTER_DELAY_MS = 300;

/** PR-IOS-LOW-FPS-SUFFICIENCY-NORMALIZE-02: sparse-but-good readiness exception. */
const LOW_FPS_READINESS_MIN_FRAMES = 5;
const LOW_FPS_READINESS_MIN_WINDOW_MS = 650;

/**
 * PR-IOS-LOW-FPS-SUFFICIENCY-NORMALIZE-02
 * Returns true when a sparse-but-good capture should satisfy the minimal-frames gate.
 * Never rescues framing errors, poor visibility, poor critical availability, or ankle failures.
 * Does not change any other blocker (severeFramingInvalid / fullBodyVisibleEnough /
 * landmarkPresenceEnough / ankleVisibleInFrame) — only minimalFramesReady.
 */
function isLowFpsButReadableReadiness(
  validFrameCount: number,
  visibleJointsRatio: number,
  criticalJointsAvailability: number,
  framingHint: string | null | undefined,
  ankleVisibleInFrame: boolean,
  debug: LiveReadinessInput['guardrail']['debug'],
): boolean {
  if (validFrameCount >= MIN_READY_VALID_FRAMES) return false;
  if (validFrameCount < LOW_FPS_READINESS_MIN_FRAMES) return false;
  if (framingHint) return false;
  if (!ankleVisibleInFrame) return false;
  if (visibleJointsRatio < MIN_READY_VISIBLE_JOINTS_RATIO) return false;
  if (criticalJointsAvailability < MIN_READY_CRITICAL_AVAILABILITY) return false;
  const startMs = debug?.selectedWindowStartMs;
  const endMs = debug?.selectedWindowEndMs;
  if (typeof startMs !== 'number' || typeof endMs !== 'number') return false;
  return endMs - startMs >= LOW_FPS_READINESS_MIN_WINDOW_MS;
}

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
        ankleVisibleInFrame: true,
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
        ankleVisibleInFrame: false,
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

  /**
   * 전신 포함 여부 rough 체크:
   * - ankleYMean 이 null(발목 미감지) → 화면에 전신이 없음 → 블로킹
   * - ankleYMean >= 0.55 → 발목이 화면 하단 45% 안에 있음 → 통과
   * - ankleYMean 필드 자체가 undefined(이전 debug 구조) → 체크 스킵(블로킹 안함)
   *
   * 0.55 는 Rough 기준이므로 사용자가 완벽하게 서있지 않아도 통과 가능.
   */
  const ankleYMean = debug && 'ankleYMean' in debug ? debug.ankleYMean : undefined;
  const ankleVisibleInFrame: boolean =
    ankleYMean === undefined
      ? true // 필드 없으면 체크 스킵
      : ankleYMean !== null && ankleYMean >= 0.55;

  const blockers = {
    severeFramingInvalid: Boolean(input.framingHint),
    landmarkPresenceEnough: criticalJointsAvailability >= MIN_READY_CRITICAL_AVAILABILITY,
    fullBodyVisibleEnough: visibleJointsRatio >= MIN_READY_VISIBLE_JOINTS_RATIO,
    minimalFramesReady:
      validFrameCount >= MIN_READY_VALID_FRAMES ||
      isLowFpsButReadableReadiness(
        validFrameCount,
        visibleJointsRatio,
        criticalJointsAvailability,
        input.framingHint,
        ankleVisibleInFrame,
        debug,
      ),
    ankleVisibleInFrame,
  };

  const activeBlockers: string[] = [];
  if (blockers.severeFramingInvalid) activeBlockers.push(input.framingHint ?? 'framing_invalid');
  if (!blockers.minimalFramesReady) activeBlockers.push('valid_frames_too_few');
  if (!blockers.fullBodyVisibleEnough) activeBlockers.push('visible_landmarks_too_low');
  if (!blockers.landmarkPresenceEnough) activeBlockers.push('critical_landmarks_too_low');
  if (!blockers.ankleVisibleInFrame) activeBlockers.push('ankle_not_in_frame');

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
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current !== null) {
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
      if (timeoutRef.current !== null) {
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
