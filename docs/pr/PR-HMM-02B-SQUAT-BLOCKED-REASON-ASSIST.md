# PR-HMM-02B — Squat HMM shadow as blocked-reason assist only

**Branch:** `feat/pr-hmm-02b-squat-blocked-reason-assist`

---

## Why HMM is not the final gate owner

- **completionSatisfied** and **standing_recovered** remain owned by `squat-completion-state.ts` rule/state flow.
- HMM does **not** set `descendConfirmed`, does not bypass standing recovery, and cannot set `completionSatisfied = true` on its own.
- Assist only **clears** an already-computed `completionBlockedReason` when that reason is in an allowlist **and** HMM evidence is strong **and** (for early blockers) post-phase safety gates hold.

---

## Why only blocked-reason assist

False negatives cluster around **early/mid temporal segmentation** (`no_descend`, `descent_span_too_short`, `no_reversal`) while **guarded finalize** (PR-C) already addresses many late failures. HMM is a **temporal segmentation** signal; using it to override recovery/finalize would blur ownership and risk false positives on sway/micro-bend.

---

## Allowed vs disallowed `completionBlockedReason` values

| Assist allowed | Assist disallowed (non-exhaustive) |
|----------------|--------------------------------------|
| `no_descend` | `not_standing_recovered` |
| `descent_span_too_short` | `recovery_hold_too_short` |
| `no_reversal` | `low_rom_standing_finalize_not_satisfied` |
| | `ultra_low_rom_standing_finalize_not_satisfied` |
| | Other recovery/finalize/tail reasons |

`descent_span_too_short`: rule chain has already passed standing recovery and finalize; assist only removes the timing blocker.

`no_descend` / `no_reversal`: assist requires **ascendConfirmed**, **standingRecoveredAtMs**, and **standingRecoveryFinalize.finalizeSatisfied** so HMM cannot open completion without the rule machine having already proven ascent and standing finalize.

---

## Implementation map

| File | Role |
|------|------|
| `src/lib/camera/squat/squat-hmm-assist.ts` | `shouldUseHmmAssistForBlockedReason`, `getHmmAssistDecision`, thresholds |
| `src/lib/camera/squat-completion-state.ts` | Optional `{ hmm }` on `evaluateSquatCompletionState`; apply assist after rule `ruleCompletionBlockedReason`; additive `hmmAssist*` trace fields |
| `src/lib/camera/evaluators/squat.ts` | Decode HMM first; pass into completion state; `highlightedMetrics.hmmAssistEligible` / `hmmAssistApplied` |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` trace only — no pass logic change |
| `scripts/camera-pr-hmm-02b-squat-assist-smoke.mjs` | A/D/E/F: end-to-end `evaluateSquatCompletionState`; B/C: policy module (see below) |

### Smoke note (B / C)

End-to-end fixtures where **`no_descend` or `no_reversal` coincides with `finalizeSatisfied === true`** are rare under current rules (e.g. `insufficient_signal` forces finalize unsatisfied; geometry usually sets `reversalFrame` once standing is approached). B and C therefore assert **`getHmmAssistDecision`** with synthetic context plus a strong HMM decode from a normal cycle fixture. A proves full **`evaluateSquatCompletionState(..., { hmm })`** assist for **`descent_span_too_short`**.

---

## Later PR: calibration

Tune if needed:

- `HMM_MIN_CONFIDENCE` (0.45), `HMM_MIN_EXCURSION` (0.02) vs product shallow-ROM band
- Whether `postGatesOkEarlyAssist` should add `relativeDepthPeak` floor for `no_descend` / `no_reversal`
- Correlation with `completionBlockedReason` assist for **`ascent_recovery_span_too_short`** (currently **not** assisted; add only with SSOT approval)

---

## Acceptance checklist

- [x] `camera-cam27-lowrom-standing-recovery-finalize-smoke.mjs` unchanged behavior
- [x] `camera-pr-hmm-01b-squat-shadow-smoke.mjs` passes
- [x] `camera-pr-hmm-02b-squat-assist-smoke.mjs` passes
- [x] Recovery/finalize blocked reasons never cleared by HMM
- [x] Additive types only; no page/voice/auto-progression contract change
