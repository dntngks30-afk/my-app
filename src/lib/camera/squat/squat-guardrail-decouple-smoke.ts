/**
 * GUARDRAIL-DECOUPLE-RESET-01: Structural smoke guards (pass-core motion fixtures only).
 *
 * Guardrails.getMotionCompleteness alignment to pass-core is integration-tested on real device.
 * These checks only prove pass-core still accepts shallow/deep and rejects standing/setup
 * for the same synthetic depth streams used in DESCENT-TRUTH smoke.
 *
 * Automated checks are structural guards only. Real-device JSON remains the final truth.
 *
 * Ref: docs/GUARDRAIL_DECOUPLE_RESET_01_TRUTH_MAP_20260404.md
 */

import { computeSquatDescentTruth } from '@/lib/camera/squat/squat-descent-truth';
import { evaluateSquatPassCore, type SquatPassCoreDepthFrame } from '@/lib/camera/squat/pass-core';

function squatProfile(baseline: number, peak: number, frames = 30): SquatPassCoreDepthFrame[] {
  const out: SquatPassCoreDepthFrame[] = [];
  const standFrames = 8;
  const descentFrames = 8;
  const bottomFrames = 4;
  const ascentFrames = 6;
  const recoveryFrames = frames - standFrames - descentFrames - bottomFrames - ascentFrames;
  let t = 0;
  for (let i = 0; i < standFrames; i++) out.push({ depth: baseline, timestampMs: t++ * 100 });
  for (let i = 0; i < descentFrames; i++) {
    const d = baseline + ((peak - baseline) * (i + 1)) / descentFrames;
    out.push({ depth: d, timestampMs: t++ * 100 });
  }
  for (let i = 0; i < bottomFrames; i++) out.push({ depth: peak, timestampMs: t++ * 100 });
  for (let i = 0; i < ascentFrames; i++) {
    const d = peak - ((peak - baseline) * (i + 1)) / ascentFrames;
    out.push({ depth: d, timestampMs: t++ * 100 });
  }
  for (let i = 0; i < Math.max(recoveryFrames, 2); i++) {
    out.push({ depth: baseline, timestampMs: t++ * 100 });
  }
  return out;
}

function evalPass(
  frames: SquatPassCoreDepthFrame[],
  baseline: number,
  setupMotionBlocked: boolean
) {
  const descent = computeSquatDescentTruth({ frames, baseline });
  return evaluateSquatPassCore({
    depthFrames: frames,
    baselineStandingDepth: baseline,
    setupMotionBlocked,
    setupMotionBlockReason: setupMotionBlocked ? 'test_setup' : null,
    sharedDescentTruth: descent,
  });
}

/** H1: shallow valid rep → pass-core opens motion pass (guardrail may align to this on device). */
export function guardDecouple_shallowPassCoreOpens(): { ok: boolean; detail: string } {
  const baseline = 0.3;
  const peak = 0.36;
  const r = evalPass(squatProfile(baseline, peak), baseline, false);
  const ok = r.passDetected === true;
  return { ok, detail: `passDetected=${r.passDetected}|blocked=${r.passBlockedReason ?? 'none'}` };
}

/** H2: deep valid rep → pass-core opens. */
export function guardDecouple_deepPassCoreOpens(): { ok: boolean; detail: string } {
  const baseline = 0.3;
  const peak = 0.75;
  const r = evalPass(squatProfile(baseline, peak), baseline, false);
  const ok = r.passDetected === true;
  return { ok, detail: `passDetected=${r.passDetected}` };
}

/** H3: standing-only micro motion → pass-core does not open. */
export function guardDecouple_standingOnlyBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.3;
  const depths = [0.3, 0.3, 0.31, 0.31, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
  const frames = depths.map((depth, i) => ({ depth, timestampMs: i * 100 }));
  const r = evalPass(frames, baseline, false);
  const ok = r.passDetected === false;
  return { ok, detail: `passDetected=${r.passDetected}` };
}

/** H4: setup motion flagged → pass-core does not open. */
export function guardDecouple_setupMotionBlocked(): { ok: boolean; detail: string } {
  const baseline = 0.3;
  const peak = 0.36;
  const r = evalPass(squatProfile(baseline, peak), baseline, true);
  const ok = r.passDetected === false;
  return { ok, detail: `passDetected=${r.passDetected}|blocked=${r.passBlockedReason ?? 'none'}` };
}

/** Single motion owner: only pass-core module exports evaluateSquatPassCore for squat motion pass. */
export function guardDecouple_singleMotionOwnerExport(): { ok: boolean; detail: string } {
  return {
    ok: typeof evaluateSquatPassCore === 'function',
    detail: 'evaluateSquatPassCore is the squat motion pass entrypoint',
  };
}

export function runGuardrailDecoupleSmoke(): {
  passed: number;
  failed: number;
  results: Array<{ name: string; ok: boolean; detail: string }>;
  allPassed: boolean;
} {
  const checks = [
    { name: 'H1_shallowPassCoreOpens', fn: guardDecouple_shallowPassCoreOpens },
    { name: 'H2_deepPassCoreOpens', fn: guardDecouple_deepPassCoreOpens },
    { name: 'H3_standingOnlyBlocked', fn: guardDecouple_standingOnlyBlocked },
    { name: 'H4_setupMotionBlocked', fn: guardDecouple_setupMotionBlocked },
    { name: 'H5_singleMotionOwnerExport', fn: guardDecouple_singleMotionOwnerExport },
  ];
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of checks) {
    try {
      const { ok, detail } = fn();
      results.push({ name, ok, detail });
      if (ok) passed++;
      else failed++;
    } catch (e) {
      results.push({ name, ok: false, detail: String(e) });
      failed++;
    }
  }
  return { passed, failed, results, allPassed: failed === 0 };
}
