/**
 * PR-OH-INPUT-STABILITY-02A: smoke tests for overhead accumulation grace vs adaptor fast-fail.
 * Pure logic — no test runner. Call `runOverheadInputStabilitySmoke()`.
 */

import {
  OH_ACCUMULATION_GRACE_MAX_MS,
  OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE,
  computeOverheadRetryFailDeferral,
  isOverheadAccumulationGraceEligible,
} from '../overhead/overhead-input-stability';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

export function runOverheadInputStabilitySmoke(): void {
  // 1) Adaptor / no hook: not grace-eligible
  assert(
    !isOverheadAccumulationGraceEligible(0, 1),
    'hook 0 + guardrail 1 → not eligible (no hook support)'
  );
  assert(
    !isOverheadAccumulationGraceEligible(0, 0),
    'hook 0 + guardrail 0 → not eligible'
  );

  // 2) Hook but no guardrail valid: not eligible
  assert(
    !isOverheadAccumulationGraceEligible(1, 0),
    'hook 1 + guardrail 0 → not eligible'
  );

  // 3) Dual support: eligible
  assert(
    isOverheadAccumulationGraceEligible(1, 1),
    'hook 1 + guardrail 1 → eligible'
  );

  // 4) Defer until max grace
  const t0 = 1000;
  let graceAt: number | null = null;
  let r = computeOverheadRetryFailDeferral({
    graceStartedAtMs: graceAt,
    nowMs: t0,
    readinessValidFrameCount: 1,
  });
  assert(r.deferTerminal === true, 'first tick should defer');
  graceAt = r.graceStartedAtMs;
  assert(graceAt === t0, 'grace start set');

  r = computeOverheadRetryFailDeferral({
    graceStartedAtMs: graceAt,
    nowMs: t0 + OH_ACCUMULATION_GRACE_MAX_MS - 1,
    readinessValidFrameCount: 1,
  });
  assert(r.deferTerminal === true, 'still inside grace max');

  r = computeOverheadRetryFailDeferral({
    graceStartedAtMs: graceAt,
    nowMs: t0 + OH_ACCUMULATION_GRACE_MAX_MS,
    readinessValidFrameCount: 1,
  });
  assert(r.deferTerminal === false, 'at max grace should proceed');

  // 5) Defer ends when readiness target met
  r = computeOverheadRetryFailDeferral({
    graceStartedAtMs: 5000,
    nowMs: 5001,
    readinessValidFrameCount: OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE,
  });
  assert(r.deferTerminal === false, 'readiness target met → proceed immediately');

  // eslint-disable-next-line no-console
  console.log('PR-OH-INPUT-STABILITY-02A smoke: all checks passed');
}
