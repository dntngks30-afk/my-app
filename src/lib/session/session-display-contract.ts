/**
 * PR1 — Display contract: bounded vocabulary + pure seed helpers for map/panel alignment.
 * No resolver hierarchy here; safe pass-through + deterministic fallback only.
 */

export type SessionDisplayContract = {
  session_role_code?: string;
  session_role_label?: string;
  session_goal_code?: string;
  session_goal_label?: string;
  session_goal_hint?: string;
};

const ROLE_ORDER = [
  'ADAPT',
  'ALIGN',
  'STABILIZE',
  'MOBILIZE',
  'BALANCE',
  'INTEGRATE',
  'RECOVER',
] as const;

const ROLE_LABEL: Record<(typeof ROLE_ORDER)[number], string> = {
  ADAPT: '적응',
  ALIGN: '정렬',
  STABILIZE: '안정',
  MOBILIZE: '확장',
  BALANCE: '균형',
  INTEGRATE: '통합',
  RECOVER: '회복',
};

const GOAL_ORDER = [
  'FULL_BODY_PRIME',
  'BREATH_ALIGNMENT',
  'CORE_STABILITY',
  'LOWER_STABILITY',
  'LOWER_MOBILITY',
  'UPPER_MOBILITY',
  'ASYMMETRY_BALANCE',
  'RECOVERY_RELIEF',
] as const;

const GOAL_LABEL: Record<(typeof GOAL_ORDER)[number], string> = {
  FULL_BODY_PRIME: '전신 준비',
  BREATH_ALIGNMENT: '호흡 정렬',
  CORE_STABILITY: '코어 안정성',
  LOWER_STABILITY: '하체 안정성',
  LOWER_MOBILITY: '하체 가동성',
  UPPER_MOBILITY: '상체 가동성',
  ASYMMETRY_BALANCE: '좌우 균형',
  RECOVERY_RELIEF: '부담 완화 회복',
};

/** Same bounded line as label for subtitle seed (PR1). */
const GOAL_HINT: Record<(typeof GOAL_ORDER)[number], string> = { ...GOAL_LABEL };

const FOCUS_AXIS_TO_GOAL: Partial<Record<string, (typeof GOAL_ORDER)[number]>> = {
  lower_stability: 'LOWER_STABILITY',
  lower_mobility: 'LOWER_MOBILITY',
  upper_mobility: 'UPPER_MOBILITY',
  trunk_control: 'CORE_STABILITY',
  asymmetry: 'ASYMMETRY_BALANCE',
  deconditioned: 'RECOVERY_RELIEF',
};

const PRIORITY_KEY_TO_GOAL: Partial<Record<string, (typeof GOAL_ORDER)[number]>> = {
  lower_stability: 'LOWER_STABILITY',
  lower_mobility: 'LOWER_MOBILITY',
  upper_mobility: 'UPPER_MOBILITY',
  trunk_control: 'CORE_STABILITY',
  asymmetry: 'ASYMMETRY_BALANCE',
  deconditioned: 'RECOVERY_RELIEF',
};

function topPriorityKey(pv: Record<string, number> | null | undefined): string | null {
  if (!pv || typeof pv !== 'object') return null;
  let bestK: string | null = null;
  let bestV = -Infinity;
  for (const [k, v] of Object.entries(pv)) {
    if (typeof v === 'number' && v > bestV) {
      bestV = v;
      bestK = k;
    }
  }
  return bestK;
}

function pickGoalCodeFromAxesAndPriority(meta: {
  session_focus_axes?: string[];
  priority_vector?: Record<string, number>;
  focus?: string[];
}): (typeof GOAL_ORDER)[number] {
  const firstAxis = meta.session_focus_axes?.[0];
  if (firstAxis && FOCUS_AXIS_TO_GOAL[firstAxis]) {
    return FOCUS_AXIS_TO_GOAL[firstAxis]!;
  }
  const pk = topPriorityKey(meta.priority_vector);
  if (pk && PRIORITY_KEY_TO_GOAL[pk]) {
    return PRIORITY_KEY_TO_GOAL[pk]!;
  }
  const f0 = meta.focus?.[0];
  if (f0 && FOCUS_AXIS_TO_GOAL[f0]) {
    return FOCUS_AXIS_TO_GOAL[f0]!;
  }
  return 'FULL_BODY_PRIME';
}

function pickRoleCodeFromPhaseAndPain(
  phase: number | undefined,
  pain: 'none' | 'caution' | 'protected' | undefined
): (typeof ROLE_ORDER)[number] {
  if (pain === 'protected' || pain === 'caution') {
    return 'RECOVER';
  }
  const p = typeof phase === 'number' && Number.isFinite(phase) ? Math.max(1, Math.min(4, Math.floor(phase))) : 1;
  const map: Record<number, (typeof ROLE_ORDER)[number]> = {
    1: 'ADAPT',
    2: 'ALIGN',
    3: 'STABILIZE',
    4: 'MOBILIZE',
  };
  return map[p] ?? 'STABILIZE';
}

function isDisplayFieldKey(k: string): k is keyof SessionDisplayContract {
  return (
    k === 'session_role_code' ||
    k === 'session_role_label' ||
    k === 'session_goal_code' ||
    k === 'session_goal_label' ||
    k === 'session_goal_hint'
  );
}

export function extractSessionDisplayFields(
  meta: Record<string, unknown> | null | undefined
): Partial<SessionDisplayContract> {
  if (!meta || typeof meta !== 'object') return {};
  const out: Partial<SessionDisplayContract> = {};
  for (const k of Object.keys(meta)) {
    if (!isDisplayFieldKey(k)) continue;
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) {
      out[k] = v.trim();
    }
  }
  return out;
}

/**
 * Bounded deterministic seed from existing meta (axes, pain, focus, priority, optional phase).
 * Side-effect free.
 */
export function buildSessionDisplaySeedFromMeta(meta: {
  session_focus_axes?: string[];
  priority_vector?: Record<string, number>;
  pain_mode?: 'none' | 'caution' | 'protected';
  focus?: string[];
  session_rationale?: string | null;
  phase?: number;
} | null | undefined): SessionDisplayContract {
  const m = meta ?? {};
  const pain = m.pain_mode === 'caution' || m.pain_mode === 'protected' ? m.pain_mode : undefined;
  let goalCode = pickGoalCodeFromAxesAndPriority(m);
  if (pain) {
    goalCode = 'RECOVERY_RELIEF';
  }
  const roleCode = pickRoleCodeFromPhaseAndPain(m.phase, pain);

  return {
    session_role_code: roleCode,
    session_role_label: ROLE_LABEL[roleCode],
    session_goal_code: goalCode,
    session_goal_label: GOAL_LABEL[goalCode],
    session_goal_hint: GOAL_HINT[goalCode],
  };
}

/** Bootstrap-only: phase + focus_axes + implicit pain from constraint flags (conservative). */
export function buildSessionDisplaySeedFromBootstrap(input: {
  phase: number;
  focus_axes: string[];
  constraint_flags: string[];
}): SessionDisplayContract {
  const painGate = input.constraint_flags.includes('pain_gate_applied');
  const pain: 'caution' | 'protected' | undefined = painGate ? 'caution' : undefined;
  const fakeMeta = {
    session_focus_axes: input.focus_axes,
    phase: input.phase,
    pain_mode: pain,
  };
  return buildSessionDisplaySeedFromMeta(fakeMeta);
}

/**
 * Pass-through wins over seed: existing non-empty contract fields override fallback.
 */
export function resolveSessionDisplayContract(
  meta: Record<string, unknown> | null | undefined
): SessionDisplayContract {
  const extracted = extractSessionDisplayFields(meta);
  const seed = buildSessionDisplaySeedFromMeta(meta as Parameters<typeof buildSessionDisplaySeedFromMeta>[0]);
  return {
    ...seed,
    ...extracted,
  };
}
