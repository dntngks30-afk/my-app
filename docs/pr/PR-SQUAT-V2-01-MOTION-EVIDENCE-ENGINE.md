# PR-SQUAT-V2-01 — Motion Evidence Engine

> PR3: add `SquatMotionEvidenceEngineV2` in parallel. No runtime owner swap.

## 1. Purpose

This PR adds a standalone, pure `SquatMotionEvidenceEngineV2` candidate for squat camera motion evidence. It exists in parallel with the current runtime stack and is locked by a synthetic smoke script.

## 2. V2 Pass Meaning

`usableMotionEvidence=true` means:

```txt
usable lower-body flexion/extension motion evidence acquired
```

It does not mean perfect squat form, medical assessment, precise rep scoring, or deep-ROM certification.

## 3. Down -> Up -> Return Contract

V2 pass requires all of these inside the same motion window:

1. body visible enough
2. not setup/readiness phase
3. lower-body motion dominant
4. meaningful descent
5. reversal / upward motion after descent
6. near-start return
7. short stability after return
8. same-rep ownership
9. not micro bounce
10. not upper-body-only

The engine returns one decision object with `usableMotionEvidence`, `motionPattern`, `romBand`, `blockReason`, evidence booleans, and metrics.

## 4. Shallow / Deep Pass Criteria

Shallow and deep use the same sequence contract:

```txt
meaningful descent -> reversal -> near-start return
```

`romBand='shallow'` can pass. `romBand='deep'` can pass. ROM band is quality/interpretation, not progression authority. Shallow pass may include `qualityWarnings: ['low_rom']`, but that warning does not block pass.

## 5. Fail Criteria Locked

The synthetic smoke locks:

- standing only -> `standing_only`, `no_meaningful_descent`
- seated only / bottom hold -> `bottom_hold`, `no_return_to_start`
- setup/readiness small alignment only -> `setup_only`, `setup_phase_only`
- arm movement only -> `upper_body_only`, `lower_body_motion_not_dominant`
- upper body sway only -> `upper_body_only`, `lower_body_motion_not_dominant`
- descent only -> `descent_only`, `no_reversal`
- bottom hold only -> `bottom_hold`, `no_return_to_start`
- incomplete return -> `incomplete_return`, `incomplete_return`
- micro bounce -> `micro`, `micro_bounce`
- noisy mixed movement without same-rep ownership -> `same_rep_ownership_failed`
- lower body not visible / low body visibility -> `body_not_visible`

## 6. Changed Files

- `src/lib/camera/squat/squat-motion-evidence-v2.types.ts`
- `src/lib/camera/squat/squat-motion-evidence-v2.ts`
- `scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs`
- `docs/pr/PR-SQUAT-V2-01-MOTION-EVIDENCE-ENGINE.md`

## 7. Runtime Wiring Evidence

No runtime files were modified. This PR does not edit evaluator wiring, auto-progression, page latch/navigation, camera routes, pass-core, completion-state, or squat-completion-core.

The only executable addition is a synthetic script that imports the new V2 pure function directly:

```bash
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
```

## 8. Legacy Pass Authority

V2 does not import or reference:

- `pass-core`
- `squat-completion-core`
- `squat-completion-state`
- legacy `blockedReason`
- legacy `completionSatisfied`
- legacy `finalPassEligible`
- `official_shallow_cycle`

Existing legacy runtime authority is preserved for now because PR3 is parallel-only. Runtime owner swap remains PR5.

## 9. Smoke Cases And Result

Synthetic smoke cases:

PASS expected:

1. valid shallow down -> up -> near-start return
2. valid deep down -> up -> near-start return
3. valid shallow with short duration but clear order
4. valid shallow with `low_rom` warning

FAIL expected:

1. standing only
2. seated only
3. setup/readiness small alignment motion only
4. arm movement only
5. upper body sway only
6. descent only
7. bottom hold only
8. incomplete return
9. micro bounce
10. noisy mixed movement without same-rep ownership
11. lower body not visible
12. body visibility too low

Result:

```txt
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
120 passed, 0 failed
```

## 10. Remaining Work

- PR4: shadow compare V2 against golden real-device traces without runtime behavior change.
- PR5: runtime owner swap, where evaluator/auto-progression consume `usableMotionEvidence` as the squat progression owner.

## 11. Non-goals

- No runtime owner swap.
- No auto-progression wiring.
- No page latch/navigation changes.
- No camera route changes.
- No pass-core, completion-state, or squat-completion-core changes.
- No shallow promotion patch.
- No quality warning as pass blocker.
- No overhead reach changes.
- No auth/payment/onboarding/session execution changes.
