# PR-E1 — Shallow representative `permanent_must_pass` landed (status lock)

> **Document type:** SSOT status lock for **current main** shallow representative promotion and proof posture.
>
> **This document does not change runtime, thresholds, authority law, pass ownership, fixture geometry, or completion/close-guard semantics.** It records what is already enforced in executable proof on main.

---

## 1. What landed

On current main, `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` holds **both** representative shallow fixtures in **`permanent_must_pass`**:

- `shallow_92deg`
- `ultra_low_rom_92deg`

SKIP is forbidden for these entries. Downgrade to conditional skip without a deliberate, separately justified PR is inconsistent with the harness contract.

The smoke’s representative authority bundle hard-asserts, for each fixture when the engine passes:

1. `completionTruthPassed === true`
2. `finalPassEligible === true`
3. `isFinalPassLatched('squat', gate) === true`
4. `canonicalShallowContractDrovePass === true`
5. `canonicalTemporalEpochOrderSatisfied === true` (and the paired epoch-order blocked-reason field is clear)
6. `canonicalShallowContractBlockedReason == null` (debug and completion-state surfaces agree where both are present)

The script header comment in that file states the same six-bit contract explicitly; this document mirrors that executable source of truth.

---

## 2. Why this phase is verification / registry promotion, not runtime broadening

The landed work **locks** already-demonstrated real-path behavior into:

- a **machine-readable promotion registry** consumed by the E1 smoke, and
- **non-optional** Matrix A assertions for the two representatives.

It does **not** restate a new pass policy for non-representative motion. PR-F still runs the mandatory bundle; widening shallow “ease” outside the existing law remains out of scope for this status lock.

---

## 3. PR-F proof gate posture (current main)

`scripts/camera-pr-f-regression-proof-gate.mjs` runs the mandatory proof bundle in fixed order and hard-fails on missing scripts, non-zero exits, or **unexplained** `SKIP` lines.

**Allowed explicit skip marker (sole):** `no PR-D broadening`

Representative conditional skip strings are **not** an accepted blanket class in this gate: any `SKIP` line must match that allowlist or the gate fails. This is stricter than an older posture where representative-conditional skips could be treated as explained.

---

## 4. `canonicalTemporalEpochOrderSatisfied` is close-guard truth, not pass ownership

Product law unchanged:

- **Completion-owner truth** opens final pass.
- **Ordering success** (`canonicalTemporalEpochOrderSatisfied` and related epoch-order machinery) is consumed as **close-order / guard** input so shallow close does not proceed on impossible temporal order. It does **not** replace completion-owner pass ownership.

---

## 5. What this docs-only alignment explicitly does **not** do

Documentation updates under this status-lock narrative do **not**:

- change runtime evaluator behavior;
- change thresholds or timing constants;
- rewrite authority law or PR-01 freeze semantics;
- redefine pass ownership or who may open final pass;
- change fixture knee-angle sequences or fixture meaning;
- expand PR-F skip markers beyond the allowlist in the proof-gate script;
- normalize P3 registry or perform P2 naming cleanup.

---

## 6. Remaining follow-on priorities (out of scope here)

1. **Authority-law ambiguity cleanup** — reconcile naming and comments so owner chains stay unambiguous without weakening freeze semantics.
2. **P3** — absurd-pass / registry normalization as authorized by its SSOT.
3. **P2** — authority naming and comment cleanup as authorized by its SSOT.

---

## 7. Supersedes stale handoff phrases

The following descriptions are **obsolete for current main** and must not be copied into new handoffs:

- “Next step is verification-first” for E1 representative promotion (promotion is already landed).
- “Registry is still `conditional_until_main_passes` for the two representatives” (both are `permanent_must_pass`).

Older reports that state conditional registry or representative conditional SKIP in PR-F remain **historical** records of an earlier head unless they carry an explicit supersession banner pointing here.

---

## 8. Related reading

- `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md` — promotion-state contract (states and meanings).
- `docs/pr/PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1.md` — post-landed handoff (next room priorities).
- `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md` — **historical** blocked report; superseded for registry state.
- `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` — executable registry and assertions.
- `scripts/camera-pr-f-regression-proof-gate.mjs` — mandatory bundle and SKIP allowlist.
