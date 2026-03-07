/**
 * Session Phase 계산 (1~4)
 * PR-P1-4: Adaptive phase policy — equal vs front_loaded.
 * total_sessions(기본 16)와 session_number로 Phase 결정.
 */

const TOTAL_SESSIONS_DEFAULT = 16;

export type Phase = 1 | 2 | 3 | 4;

/** [p1, p2, p3, p4] — 각 phase 세션 수. 합계 = totalSessions. */
export type PhaseLengths = readonly [number, number, number, number];

export type PhasePolicyOptions = {
  deepLevel?: number | null;
  safetyMode?: 'none' | 'yellow' | 'red' | null;
  redFlags?: boolean | null;
};

export type PhasePolicy = 'equal' | 'front_loaded';

export type PhasePolicyReason = 'default' | 'deep_level_1' | 'safety_mode' | 'red_flags';

/** totalSessions를 8/12/16/20으로 정규화. 그 외는 clamp. */
export function normalizeTotalSessions(totalSessions: number): number {
  const n = Math.max(1, Math.min(20, Math.floor(totalSessions)));
  if (n <= 8) return 8;
  if (n <= 12) return 12;
  if (n <= 16) return 16;
  return 20;
}

/** adaptive 트리거: level 1 또는 safety_mode 또는 red_flags */
export function isAdaptivePhasePolicy(options: PhasePolicyOptions | null | undefined): boolean {
  if (!options) return false;
  if (options.deepLevel === 1) return true;
  if (options.safetyMode === 'yellow' || options.safetyMode === 'red') return true;
  if (options.redFlags === true) return true;
  return false;
}

/** policy reason 우선순위: red_flags > safety_mode > deep_level_1 > default */
export function resolvePhasePolicyReason(options: PhasePolicyOptions | null | undefined): PhasePolicyReason {
  if (!options) return 'default';
  if (options.redFlags === true) return 'red_flags';
  if (options.safetyMode === 'yellow' || options.safetyMode === 'red') return 'safety_mode';
  if (options.deepLevel === 1) return 'deep_level_1';
  return 'default';
}

/** totalSessions → phase lengths. equal 또는 front_loaded. */
export function resolvePhaseLengths(
  totalSessions: number,
  options?: PhasePolicyOptions | null
): PhaseLengths {
  const total = normalizeTotalSessions(totalSessions);
  const adaptive = isAdaptivePhasePolicy(options);

  if (!adaptive) {
    const per = Math.max(1, Math.floor(total / 4));
    return [per, per, per, total - per * 3] as PhaseLengths;
  }

  // front_loaded: Phase 1에 1세션 추가, Phase 4에서 1세션 감소
  const map: Record<number, PhaseLengths> = {
    8: [3, 2, 2, 1],
    12: [4, 3, 3, 2],
    16: [5, 4, 4, 3],
    20: [6, 5, 5, 4],
  };
  return map[total] ?? [Math.floor(total / 4), Math.floor(total / 4), Math.floor(total / 4), total - 3 * Math.floor(total / 4)];
}

/** phase_lengths + session_number → Phase (1~4) */
export function computePhaseFromLengths(
  phaseLengths: PhaseLengths,
  sessionNumber: number
): Phase {
  if (sessionNumber < 1) return 1;
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    acc += phaseLengths[i];
    if (sessionNumber <= acc) return (i + 1) as Phase;
  }
  return 4;
}

/**
 * session_number → Phase (1~4)
 * phase_lengths가 있으면 사용, 없으면 options 기반 resolve 후 계산.
 * options 없으면 기존 균등 분배 (backward compat).
 */
export function computePhase(
  totalSessions: number,
  sessionNumber: number,
  options?: { phaseLengths?: PhaseLengths | null; policyOptions?: PhasePolicyOptions | null }
): Phase {
  if (sessionNumber < 1) return 1;
  const lengths = options?.phaseLengths ?? resolvePhaseLengths(totalSessions, options?.policyOptions);
  return computePhaseFromLengths(lengths, sessionNumber);
}

/**
 * Phase → 0-based index (0~3)
 */
export function getPhaseIndex(phase: Phase): number {
  return phase - 1;
}
