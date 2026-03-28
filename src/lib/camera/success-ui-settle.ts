/**
 * PR-CAM-SUCCESS-UI-SETTLE-01: 페이지(UI) 레이어 성공 래치 전용 settle — auto-progression truth 와 분리.
 * `isFinalPassLatched` / completion 임계와 무관하게, 얕은 경로만 짧게 디바운스한다.
 */

/** settle 정책에 쓰는 completion pass reason 분류 */
export type SuccessUiSettlePathKind =
  | 'low_rom_shallow'
  | 'standard_cycle'
  | 'other';

/** low / ultra shallow event-cycle 계열 — 320ms page-local settle */
export const SUCCESS_UI_SETTLE_MS_SHALLOW = 320;

export function classifySuccessUiSettlePath(
  completionPassReason: string | null | undefined
): SuccessUiSettlePathKind {
  if (
    completionPassReason === 'low_rom_event_cycle' ||
    completionPassReason === 'low_rom_cycle'
  ) {
    return 'low_rom_shallow';
  }
  if (
    completionPassReason === 'ultra_low_rom_event_cycle' ||
    completionPassReason === 'ultra_low_rom_cycle'
  ) {
    return 'low_rom_shallow';
  }
  if (completionPassReason === 'standard_cycle') {
    return 'standard_cycle';
  }
  return 'other';
}

export function getSuccessUiSettleDurationMs(kind: SuccessUiSettlePathKind): number {
  if (kind === 'low_rom_shallow') return SUCCESS_UI_SETTLE_MS_SHALLOW;
  return 0;
}

/** 진단·스냅샷용 문자열 */
export function successUiSettlePathLabel(kind: SuccessUiSettlePathKind): string {
  if (kind === 'low_rom_shallow') return 'low_rom_shallow';
  if (kind === 'standard_cycle') return 'standard_cycle';
  return 'other';
}

/**
 * passReady(= finalPassLatched) 동안 후보 시각을 유지하고, 경로별 settle 시간 충족 시 UI 래치 허용.
 * passReady 가 false 가 되면 후보 리셋.
 */
export type SuccessUiSettleCandidateState = {
  candidateStartedAtMs: number;
  kind: SuccessUiSettlePathKind;
};

export function updateSuccessUiSettleCandidate(input: {
  passReady: boolean;
  completionPassReason: string | null | undefined;
  nowMs: number;
  prev: SuccessUiSettleCandidateState | null;
}): {
  next: SuccessUiSettleCandidateState | null;
  shouldLatchUiNow: boolean;
  settleMsUsed: number;
  settlePathLabel: string;
  candidateStartedAtMs: number | null;
  candidateStartedAtIso: string | null;
} {
  const kind = classifySuccessUiSettlePath(input.completionPassReason);
  const settleMs = getSuccessUiSettleDurationMs(kind);
  const settlePathLabel = successUiSettlePathLabel(kind);

  if (!input.passReady) {
    return {
      next: null,
      shouldLatchUiNow: false,
      settleMsUsed: settleMs,
      settlePathLabel,
      candidateStartedAtMs: null,
      candidateStartedAtIso: null,
    };
  }

  const prev = input.prev;
  const needNewCandidate = prev == null || prev.kind !== kind;

  const candidateStartedAtMs = needNewCandidate ? input.nowMs : prev.candidateStartedAtMs;
  const next: SuccessUiSettleCandidateState = {
    candidateStartedAtMs,
    kind,
  };

  const elapsed = input.nowMs - candidateStartedAtMs;
  const shouldLatchUiNow = elapsed >= settleMs;

  return {
    next,
    shouldLatchUiNow,
    settleMsUsed: settleMs,
    settlePathLabel,
    candidateStartedAtMs,
    candidateStartedAtIso: new Date(candidateStartedAtMs).toISOString(),
  };
}
