# PR-SQUAT-V2-02 Runtime Owner Swap

## 1. PR purpose

This PR swaps the runtime owner for squat camera progression from the legacy squat completion/pass chain to `SquatMotionEvidenceEngineV2`.

The goal is not to improve the legacy engine. The goal is to make the simpler V2 motion-evidence contract the production owner for squat progression.

## 2. Changed runtime owner

CURRENT_IMPLEMENTED:

- Squat evaluator computes `evaluateSquatMotionEvidenceV2(frames)`.
- The decision is exposed as `debug.squatMotionEvidenceV2`.
- `evaluateExerciseAutoProgress('squat', ...)` consumes `debug.squatMotionEvidenceV2.usableMotionEvidence`.
- `gate.finalPassEligible` for squat is now derived from V2 `usableMotionEvidence`.
- `gate.squatMotionEvidenceV2` exposes the same decision as a sink-only runtime trace field.

## 3. Previous owner vs new owner

Previous runtime authority:

- legacy `squatCompletionState.completionSatisfied`
- legacy completion owner truth / `completionPassReason`
- legacy post-owner UI gate / final blocker layer
- legacy pass-core and shallow cycle labels as part of the final progression path

New runtime authority:

- `SquatMotionEvidenceDecisionV2.usableMotionEvidence`

Legacy fields remain for quality, diagnostics, trace comparison, and compatibility only.

## 4. Evaluator exposure

`src/lib/camera/evaluators/squat.ts` now attaches:

```ts
debug.squatMotionEvidenceV2
```

The field is computed from the pose feature frames and does not read legacy `completionSatisfied`, `finalPassEligible`, `completionBlockedReason`, or pass-core output.

## 5. Auto-progression consumption

The squat auto-progression branch consumes exactly:

```ts
evaluatorResult.debug?.squatMotionEvidenceV2?.usableMotionEvidence
```

It maps this to:

- `progressionPassed`
- `completionSatisfied`
- `finalPassEligible`
- `finalPassBlockedReason`

## 6. Final blocker cannot flip V2 pass

The legacy post-owner gate and final blocker layer can still exist as diagnostic/compat trace, but squat runtime pass no longer reads their pass/fail output.

Therefore:

- V2 `usableMotionEvidence=true` is not turned into false by legacy final blockers.
- V2 `usableMotionEvidence=false` is not turned into true by fallback pass logic.

## 7. Page latch behavior

The squat page was not rewritten. It continues to consume `isFinalPassLatched(STEP_ID, gate)`.

For production squat gates, `isFinalPassLatched` reads `gate.finalPassEligible`. Since `finalPassEligible` is now produced from V2 `usableMotionEvidence`, the page latch consumes the already-computed owner decision and does not recompute squat completion.

Trace field:

```ts
squatCycleDebug.pageLatchDecision = {
  consumer: 'isFinalPassLatched',
  sourceField: 'gate.finalPassEligible',
  recomputesSquatCompletion: false,
}
```

## 8. Legacy debug/compat

Legacy pass-core, completion-state, shallow-cycle labels, quality caps, and UI gate fields remain visible as debug/compat only.

Trace separation added:

- `v2RuntimeOwnerDecision`
- `legacyQualityOrCompat`
- `autoProgressionDecision`
- `pageLatchDecision`

## 9. Changed files

- `src/lib/camera/evaluators/types.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/auto-progression.ts`
- `scripts/camera-squat-v2-00-golden-trace-harness.mjs`
- `docs/pr/PR-SQUAT-V2-02-RUNTIME-OWNER-SWAP.md`

No overhead reach evaluator, camera page rewrite, `/app/home`, `/app/checkin`, `/app/profile`, AppShell, SessionPanelV2, ExercisePlayerModal, auth, payment, onboarding, or session execution changes were made.

## 10. Acceptance commands and results

Passed:

```bash
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
# 120 passed, 0 failed

npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
# STRICT: all required contracts satisfied.

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
# --strict: all V2 results match expected.
```

Additional checks:

```bash
npm run typecheck
# not available: Missing script "typecheck"

npx tsc --noEmit
# did not complete cleanly due existing repo-wide TypeScript errors outside this PR scope

npm run lint
# repo script invokes `next lint`; current Next CLI reports invalid project directory `...\\lint`
```

## 11. Real-device verification checklist

- valid shallow squat passes naturally
- valid deep squat passes without long bottom hold or repeated slow rise
- standing only does not pass
- seated / bottom hold does not pass
- incomplete return does not pass
- arm-only / upper-body-only movement does not pass

## 12. Remaining work

PR6: Legacy Quality Analyzer Demotion.
