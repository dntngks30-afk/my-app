# PR-P3 — Squat Absurd-Pass Registry Normalization (Implementation Report)

> **PR scope lock:** P3 — squat absurd-pass registry normalization only.
> No opener-law change, no threshold change, no timing/epoch/shallow/arming
> change, no P2 naming/comment sweep, no non-squat work, no proof-gate
> skip-marker expansion.
>
> **Parent SSOT:** `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`.
>
> **Direct parent:** `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`.
>
> **Authority-law parent (already landed):**
> `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`,
> `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`.

---

## 1. One-line intent

**Normalize the three scattered late final-pass vetoes in
`auto-progression.ts` into one explicit, auditable, block-only registry
surface, and catalogue the remaining known absurd-pass families already
fail-closed by upstream layers, while preserving the current runtime
behavior bit-for-bit.**

## 2. What landed

### 2.1 New registry surface

- `src/lib/camera/squat/squat-absurd-pass-registry.ts` (new).
  - Three blocked-reason constants (moved from `auto-progression.ts`):
    - `SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON`
    - `SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON`
    - `SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON`
  - Three predicate functions (moved unchanged, same signatures as before):
    - `shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass`
    - `shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass`
    - `shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass`
  - Stable family id union `SquatAbsurdPassFamilyId`.
  - `SquatAbsurdPassRegistryEntry` shape:
    `{ familyId, stage: 'late_final_veto', blockedReason, description, predicate }`.
    Intentionally carries no `grant` / `allow` / `open` field.
  - `SQUAT_ACTIVE_ABSURD_PASS_REGISTRY` — the three entries in
    production veto order.
  - `evaluateSquatAbsurdPassRegistry({ stepId, squatCompletionState,
    squatCycleDebug })` — single runtime evaluator. Return type is
    `SquatAbsurdPassRegistryVerdict | null`. The verdict type has no
    grant / allow / open variant; it is either `null` (no block) or
    `{ familyId, blockedReason }` (close the final-pass surface).
  - `SquatUpstreamClassifiedAbsurdPassFamily` type +
    `SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES` inventory — the
    eight upstream-classified families from the P3 SSOT list (standing
    still, seated hold / still seated, setup-motion contaminated,
    stale prior rep, mixed-rep contamination, no real descent, no real
    reversal, no real recovery). Each inventory entry is stage
    `'upstream_classified_only'` and carries no `predicate` — this is
    a read-only audit surface, not a runtime closer.

### 2.2 `auto-progression.ts` — thin wiring only

- Added import from the new registry module for the three constants,
  the evaluator, and the three predicates.
- Re-exported the three predicate functions verbatim so smokes and
  external callers that import them from `auto-progression` continue
  to work without change.
- Rewrote `applySquatFinalBlockerVetoLayer` into a thin wrapper: it
  now calls `evaluateSquatAbsurdPassRegistry` once, and on verdict
  maps to `{ uiProgressionAllowed: false, uiProgressionBlockedReason:
  verdict.blockedReason }`. The three-branch `if`-chain was deleted.
- Removed the now-duplicated blocked-reason constants, the three
  predicate function bodies, and the
  `squatEventCycleNotesIndicateSeriesStartContamination` helper from
  `auto-progression.ts` — they live in the registry file now.
- `stampSquatFinalPassTimingBlockedReason(...)` continues to read the
  three re-exported / imported constants unchanged.
- No change to: `readSquatPassOwnerTruth`,
  `enforceSquatOwnerContradictionInvariant`,
  `getSquatPostOwnerFinalPassBlockedReason`,
  `computeSquatPostOwnerPreLatchGateLayer`, `isFinalPassLatched`,
  thresholds, shallow/ultra-low policy code, timing/epoch/arming
  logic, non-squat code, or `canonicalShallowContractDrovePass`.

### 2.3 New P3 smoke

- `scripts/camera-pr-p3-squat-absurd-pass-registry-normalization-smoke.mjs`.
  25/25 assertions, covering:
  - §1 registry shape (three entries, production order preserved,
    every entry `stage === 'late_final_veto'`, every entry has a
    predicate and non-empty blocked reason, entry blocked reasons
    match exported constants);
  - §2 registry is block-only (no exported symbol named
    `grant`/`allow`/`open*`, no entry key named
    `grant`/`allow`/`open*`, evaluator returns `null` on empty state);
  - §3 registry predicate parity with the legacy compat exports for
    each of the three families;
  - §4 the registry fires end-to-end through
    `computeSquatPostOwnerPreLatchGateLayer` and produces the same
    blocked-reason string at the same layer;
  - §5 clean path: registry returns `null` and
    `progressionPassed === true` with `finalPassBlockedReason == null`;
  - §6 non-squat stepId: registry is a no-op;
  - §7 passive upstream-classified family inventory covers the P3
    SSOT list, every entry is `'upstream_classified_only'` with no
    predicate, and no family id overlaps with the active registry;
  - §8 PR-01 illegal states remain locked after P3 normalization
    (`completionTruthPassed === false` with synthetic
    `pass_core_detected` owner still cannot open final pass;
    `cycleComplete === false` still cannot open final pass).

### 2.4 PR-F proof gate

- `scripts/camera-pr-f-regression-proof-gate.mjs` now runs the P3
  smoke as script 12/12 in group `p3/absurd-pass-registry`. No
  `ALLOWED_SKIP_MARKERS` change. No other script altered.

---

## 3. Active late blocker registry (normalized)

| # | familyId | stage | blockedReason | original predicate |
|---|---|---|---|---|
| 1 | `ultra_low_trajectory_rescue_short_cycle` | `late_final_veto` | `minimum_cycle_duration_not_met:ultra_low_trajectory` | `shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass` |
| 2 | `ultra_low_setup_series_start_false_pass` | `late_final_veto` | `setup_series_start_false_pass` | `shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass` |
| 3 | `blended_early_peak_contaminated_false_pass` | `late_final_veto` | `contaminated_blended_early_peak_false_pass` | `shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass` |

Production veto order is preserved (1 → 2 → 3), identical to the old
three-branch `applySquatFinalBlockerVetoLayer` body.

---

## 4. Passive upstream-classified family inventory

| familyId | closed by | representative blocked reasons |
|---|---|---|
| `standing_still` | `evaluateSquatCompletionState`, `computeSquatCompletionOwnerTruth`, `getSquatPostOwnerFinalPassBlockedReason` | `completion_not_satisfied`, `not_standing_recovered`, `cycle_not_complete`, `completion_truth_not_passed` |
| `seated_hold_or_still_seated_at_pass` | `evaluateSquatCompletionState`, `computeSquatCompletionOwnerTruth` | `not_standing_recovered`, `cycle_not_complete` |
| `setup_motion_contaminated_cycle` | `computeSquatUiProgressionLatchGate`, `evaluateSquatCompletionState:setupMotionBlocked` | `setup_motion_blocked` |
| `stale_prior_rep_reused_as_current_rep` | `readSquatPassOwnerTruth` | `pass_core_stale_rep` |
| `mixed_rep_timestamp_contamination` | `evaluateSquatCompletionState`, `enforceSquatOwnerContradictionInvariant` | `owner_contradiction:cycle_not_complete`, `owner_contradiction:completion_truth_not_passed` |
| `no_real_descent` | `evaluateSquatCompletionState`, `shallow-completion-contract` | `completion_not_satisfied`, `completion_reason_not_confirmed` |
| `no_real_reversal_or_ascent_equivalent` | `evaluateSquatCompletionState`, `shallow-completion-contract` | `completion_not_satisfied`, `completion_reason_not_confirmed` |
| `no_real_recovery_after_reversal` | `computeSquatCompletionOwnerTruth` | `not_standing_recovered` |

These entries are **read-only inventory**. They do not register any
runtime predicate. This separation is explicit on purpose: this PR
normalizes, it does not invent new late blockers for families already
closed upstream.

---

## 5. Behavior preservation

The change is a pure extraction / wiring refactor.

- The three predicate function bodies are byte-identical to the
  pre-P3 versions in `auto-progression.ts`.
- The three blocked-reason constants are byte-identical.
- `applySquatFinalBlockerVetoLayer` evaluates the same three families
  in the same order and returns the same
  `{ uiProgressionAllowed: false, uiProgressionBlockedReason }` shape.
- `stampSquatFinalPassTimingBlockedReason` continues to read the same
  three blocked-reason constants (now re-imported) and maps them to
  the same `finalPassTimingBlockedReason` strings.
- Smoke parity is proven by the P3 smoke §3 and §4, and by PR-F
  running every other squat smoke that previously touched these
  families with no regression:
  - 12/12 PR-F proof-gate scripts green;
  - `camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
    25/25;
  - `camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` 52/52;
  - `camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs`
    18/18;
  - `camera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke.mjs`
    and `camera-squat-ultra-shallow-live-regression-01-smoke.mjs`
    consume the legacy predicate names via the compat re-exports —
    both continue to pass inside PR-F.

---

## 6. Invariants / smokes locked

- **Block-only surface.** Registry module exports no
  `grant`/`allow`/`open*` symbol and entries carry no such keys.
  Evaluator return type admits only `null` or a close verdict. Proved
  by P3 smoke §2.
- **Class-specific reasons preserved.** Each of the three families
  keeps its original blocked-reason string. Proved by P3 smoke §1f,
  §3, §4.
- **Production veto order preserved.** Proved by P3 smoke §1b and
  end-to-end parity in §4.
- **Upstream-classified inventory is passive.** Proved by P3 smoke
  §7 (every entry is `'upstream_classified_only'` and carries no
  predicate; no overlap with the active registry).
- **PR-01 illegal states remain locked.** Proved by P3 smoke §8 and
  by the PR-01 smoke running unchanged inside PR-F as script 11/12.
- **E1 representative promotion remains intact.** Proved by PR-F
  script 1/12 (E1 registry smoke 52/52) and by PR-D harness script
  2/12.

---

## 7. What this PR did not change

- No opener-law change. The law
  `completionTruthPassed AND completionOwnerPassed AND gates clear =>
  finalPassEligible / finalPassGranted / finalPassLatched` stands.
- No threshold change.
- No shallow detection, timing, epoch, or arming change.
- No pass/fail semantics change.
- No new opener or grant path.
- No promotion of `canonicalShallowContractDrovePass` to a gate input.
- No change to `pass_core_detected` classification — it remains the
  formally closed legacy label from PR-CAM-SQUAT-AUTHORITY-LAW-
  RESOLUTION §4.
- No non-squat change.
- No `ALLOWED_SKIP_MARKERS` expansion in the PR-F proof gate.
- No P2 naming/comment sweep; the three legacy predicate names are
  retained by re-export.

---

## 8. Acceptance evidence

All PR-F proof-gate scripts green on current branch:

- 1/12 `camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` — 52/52
- 2/12 `camera-pr-d-squat-regression-harness-smoke.mjs` — 69/69
- 3/12 `camera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke.mjs`
- 4/12 `camera-pr-core-pass-reason-align-01-smoke.mjs`
- 5/12 `camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs`
- 6/12 `camera-pr-squat-trajectory-rescue-owner-separation-01-smoke.mjs`
- 7/12 `camera-e1b-peak-anchor-contamination-smoke.mjs` — 23/23
- 8/12 `camera-e1c-authoritative-reversal-chain-smoke.mjs` — 23/23
- 9/12 `camera-pr6-ultra-low-policy-smoke.mjs` — 33/33
- 10/12 `camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs` — 18/18
- 11/12 `camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs` — 25/25
- 12/12 `camera-pr-p3-squat-absurd-pass-registry-normalization-smoke.mjs` — 25/25 (**new**)

No lint errors on the edited / new files.

---

## 9. Follow-on order

1. **This PR — P3 absurd-pass registry normalization** (landed).
2. **P2 authority naming/comment cleanup**
   (`docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`) —
   behavior-preserving cleanup. With the opener law (PR-CAM-SQUAT-
   AUTHORITY-LAW-RESOLUTION) and the blocker surface (this PR)
   settled, P2 can safely rename legacy wording, retire compat
   comments, and normalize trace labels without relitigating either
   the opener law or the blocker registry.

---

## 10. Related reading

- `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
- `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
- `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`
- `docs/pr/PR-F-shallow-real-path-permanent-lock-truth-map.md`
- `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
