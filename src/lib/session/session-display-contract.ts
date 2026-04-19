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
  for (const ax of meta.session_focus_axes ?? []) {
    if (ax && FOCUS_AXIS_TO_GOAL[ax]) {
      return FOCUS_AXIS_TO_GOAL[ax]!;
    }
  }
  const pk = topPriorityKey(meta.priority_vector);
  if (pk && PRIORITY_KEY_TO_GOAL[pk]) {
    return PRIORITY_KEY_TO_GOAL[pk]!;
  }
  for (const f of meta.focus ?? []) {
    if (f && FOCUS_AXIS_TO_GOAL[f]) {
      return FOCUS_AXIS_TO_GOAL[f]!;
    }
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
 * Read-time legacy normalization (no DB write). Bounded vocabulary only.
 * Uses primary_type, result_type, constraint_flags, phase, session_number when axes/priority are thin.
 */
export function deriveLegacySessionDisplayContract(
  meta: Record<string, unknown> | null | undefined
): Required<SessionDisplayContract> {
  const m = meta && typeof meta === 'object' ? meta : {};

  const pain =
    m.pain_mode === 'caution' || m.pain_mode === 'protected'
      ? (m.pain_mode as 'caution' | 'protected')
      : undefined;

  if (pain) {
    const roleCode: (typeof ROLE_ORDER)[number] = 'RECOVER';
    const goalCode: (typeof GOAL_ORDER)[number] = 'RECOVERY_RELIEF';
    return {
      session_role_code: roleCode,
      session_role_label: ROLE_LABEL[roleCode],
      session_goal_code: goalCode,
      session_goal_label: GOAL_LABEL[goalCode],
      session_goal_hint: GOAL_HINT[goalCode],
    };
  }

  const primaryType = typeof m.primary_type === 'string' ? m.primary_type : undefined;
  const resultType = typeof m.result_type === 'string' ? m.result_type : undefined;
  const cf = m.constraint_flags;
  const firstGuard = Boolean(
    cf &&
      typeof cf === 'object' &&
      (cf as { first_session_guardrail_applied?: boolean }).first_session_guardrail_applied === true
  );
  const recoveryMode = Boolean(
    cf &&
      typeof cf === 'object' &&
      (cf as { recovery_mode_applied?: boolean }).recovery_mode_applied === true
  );
  const phase = typeof m.phase === 'number' && Number.isFinite(m.phase) ? Math.floor(m.phase) : undefined;
  const sessionNum =
    typeof m.session_number === 'number' && Number.isFinite(m.session_number)
      ? Math.floor(m.session_number)
      : undefined;

  const goalFromHeuristics = pickGoalCodeFromLegacySignals(primaryType, resultType);
  const goalCode: (typeof GOAL_ORDER)[number] =
    goalFromHeuristics ?? pickGoalCodeFromAxesAndPriority(m as Parameters<typeof pickGoalCodeFromAxesAndPriority>[0]);

  const roleCode: (typeof ROLE_ORDER)[number] = pickRoleCodeFromLegacySignals(
    primaryType,
    resultType,
    phase,
    sessionNum,
    firstGuard,
    recoveryMode
  );

  return {
    session_role_code: roleCode,
    session_role_label: ROLE_LABEL[roleCode],
    session_goal_code: goalCode,
    session_goal_label: GOAL_LABEL[goalCode],
    session_goal_hint: GOAL_HINT[goalCode],
  };
}

function pickGoalCodeFromLegacySignals(
  primaryType: string | undefined,
  resultType: string | undefined
): (typeof GOAL_ORDER)[number] | null {
  if (primaryType) {
    const g = goalFromPrimaryType(primaryType);
    if (g) return g;
  }
  if (resultType) {
    const g = goalFromResultType(resultType);
    if (g) return g;
  }
  return null;
}

function goalFromPrimaryType(p: string): (typeof GOAL_ORDER)[number] | null {
  switch (p) {
    case 'LOWER_INSTABILITY':
      return 'LOWER_STABILITY';
    case 'CORE_CONTROL_DEFICIT':
      return 'CORE_STABILITY';
    case 'UPPER_IMMOBILITY':
      return 'UPPER_MOBILITY';
    case 'LOWER_MOBILITY_RESTRICTION':
      return 'LOWER_MOBILITY';
    case 'DECONDITIONED':
      return 'RECOVERY_RELIEF';
    case 'STABLE':
      return null;
    default:
      return null;
  }
}

function goalFromResultType(r: string): (typeof GOAL_ORDER)[number] | null {
  switch (r) {
    case 'NECK-SHOULDER':
    case 'UPPER-LIMB':
      return 'UPPER_MOBILITY';
    case 'LUMBO-PELVIS':
      return 'CORE_STABILITY';
    case 'LOWER-LIMB':
      return 'LOWER_STABILITY';
    case 'DECONDITIONED':
      return 'RECOVERY_RELIEF';
    case 'STABLE':
      return null;
    default:
      return null;
  }
}

function pickRoleCodeFromLegacySignals(
  primaryType: string | undefined,
  resultType: string | undefined,
  phase: number | undefined,
  sessionNum: number | undefined,
  firstGuard: boolean,
  recoveryMode: boolean
): (typeof ROLE_ORDER)[number] {
  if (primaryType === 'STABLE' || resultType === 'STABLE') {
    if (firstGuard) return 'ADAPT';
    if (recoveryMode) return 'INTEGRATE';
  }
  if (primaryType === 'DECONDITIONED' || resultType === 'DECONDITIONED') {
    return 'RECOVER';
  }
  if (primaryType === 'CORE_CONTROL_DEFICIT') return 'STABILIZE';
  if (primaryType === 'LOWER_INSTABILITY') return 'STABILIZE';
  if (primaryType === 'UPPER_IMMOBILITY') return 'MOBILIZE';
  if (primaryType === 'LOWER_MOBILITY_RESTRICTION') return 'MOBILIZE';
  if (primaryType === 'STABLE' && typeof sessionNum === 'number') {
    if (sessionNum >= 16) return 'INTEGRATE';
    if (sessionNum <= 3) return 'ADAPT';
  }
  return pickRoleCodeFromPhaseAndPain(phase, undefined);
}

function isBoundedRoleCode(code: string | undefined): code is (typeof ROLE_ORDER)[number] {
  return !!code && (ROLE_ORDER as readonly string[]).includes(code);
}
function isBoundedGoalCode(code: string | undefined): code is (typeof GOAL_ORDER)[number] {
  return !!code && (GOAL_ORDER as readonly string[]).includes(code);
}

/**
 * Explicit field wins per key; missing keys filled from deriveLegacySessionDisplayContract (read-time only).
 * If only a bounded code is explicit, label/hint follow the same vocabulary maps before falling back to derived.
 */
export function resolveSessionDisplayContract(
  meta: Record<string, unknown> | null | undefined
): SessionDisplayContract {
  const extracted = extractSessionDisplayFields(meta);
  const derived = deriveLegacySessionDisplayContract(meta);

  const roleCode = extracted.session_role_code ?? derived.session_role_code;
  const goalCode = extracted.session_goal_code ?? derived.session_goal_code;

  return {
    session_role_code: roleCode,
    session_role_label:
      extracted.session_role_label ??
      (isBoundedRoleCode(roleCode) ? ROLE_LABEL[roleCode] : derived.session_role_label),
    session_goal_code: goalCode,
    session_goal_label:
      extracted.session_goal_label ??
      (isBoundedGoalCode(goalCode) ? GOAL_LABEL[goalCode] : derived.session_goal_label),
    session_goal_hint:
      extracted.session_goal_hint ??
      (isBoundedGoalCode(goalCode) ? GOAL_HINT[goalCode] : derived.session_goal_hint),
  };
}

/**
 * Bounded deterministic seed from existing meta (axes, pain, focus, priority, optional phase).
 * Side-effect free. Delegates to legacy read-time derivation (same family as resolve / batch hydration).
 */
export function buildSessionDisplaySeedFromMeta(meta: {
  session_focus_axes?: string[];
  priority_vector?: Record<string, number>;
  pain_mode?: 'none' | 'caution' | 'protected';
  focus?: string[];
  session_rationale?: string | null;
  phase?: number;
} | null | undefined): SessionDisplayContract {
  return deriveLegacySessionDisplayContract((meta ?? {}) as Record<string, unknown>);
}

/** Bootstrap-only: phase + focus_axes + implicit pain from constraint flags (conservative). */
export function buildSessionDisplaySeedFromBootstrap(input: {
  phase: number;
  focus_axes: string[];
  constraint_flags: string[];
}): SessionDisplayContract {
  const painGate = input.constraint_flags.includes('pain_gate_applied');
  const pain: 'caution' | 'protected' | undefined = painGate ? 'caution' : undefined;
  const fakeMeta: Record<string, unknown> = {
    session_focus_axes: input.focus_axes,
    phase: input.phase,
    pain_mode: pain,
  };
  return deriveLegacySessionDisplayContract(fakeMeta);
}
