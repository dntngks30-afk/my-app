# PR-P2 — Squat Authority Naming and Comment Cleanup — Implementation Report

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Design doc: `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
Preceded by (landed):
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/pr/PR-P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION-IMPLEMENTATION-REPORT.md`

## One-line intent

P2 aligns squat comments, helper JSDoc, file-header wording, and trace-facing
field documentation with the landed completion-first authority law so no
reader can accidentally conclude that pass-core, the UI latch, the absurd-pass
registry, `canonicalShallowContractDrovePass`, or any reason label is a
final-pass opener. Runtime behavior is unchanged.

## Scope (what changed / what did not)

### Changed (comment-only / JSDoc-only)

| File | Surface | Clarification |
| --- | --- | --- |
| `src/lib/camera/auto-progression.ts` | `SquatFinalPassTruthSurface` interface header + `motionOwnerSource` field doc | Re-anchored to PR-01 + authority-law resolution; flagged as a **non-opener consumer mirror** and `motionOwnerSource` as sink-only rep-consistency trace (never opener / never gate input). |
| `src/lib/camera/auto-progression.ts` | `readSquatCurrentRepPassTruth` header + inline notes | Renamed in prose as the **rep-consistency diagnostic adapter**, not an opener. Removed misleading phrasing "pass-core truth (primary)" and replaced with explicit trace-only semantics; added explicit pointer to `readSquatPassOwnerTruth` as the canonical opener-truth adapter. |
| `src/lib/camera/auto-progression.ts` | `buildSquatFinalPassTruthSurface` header | Clarified this builder mirrors the opener-law outcome computed by the owner chain upstream (`readSquatPassOwnerTruth` → `enforceSquatOwnerContradictionInvariant` → `getSquatPostOwnerFinalPassBlockedReason` → P3 block-only registry). `motionOwnerSource` explicitly marked sink-only. |
| `src/lib/camera/auto-progression.ts` | `readSquatPassOwnerTruth` header | Promoted the existing PR-01 docblock to the **canonical opener-truth adapter**; made the authority-law position of both inputs (`squatCompletionState` as opener input, `squatPassCore` as non-opener assist / same-rep stale veto) explicit; explicitly classified `completionOwnerReason` as an explanation label (with `pass_core_detected` called out as a formally closed legacy label, smoke-only probe). |
| `src/lib/camera/auto-progression.ts` | `isFinalPassLatched` header | Explicitly labeled as a **final-pass consumer / latch mirror**, not an opener; added the opener-law one-liner; re-described the historical partial-gate compat path as tests-only. |
| `src/lib/camera/auto-progression.ts` | `evaluateExerciseAutoProgress` inline pipeline header (Step A / B / C / D / E) | Re-grounded the pipeline description on PR-01 + P3: Step A is the opener input, Step B is the **sole opener-truth adapter**, Step C/D are non-opener consumer / block-only layers (pointing at the P3 registry), Step E is sink-only trace. |
| `src/lib/camera/auto-progression.ts` | Step A/B/D inline block comments | Reworded "pass-core is the single motion truth" type remarks as "same-rep motion trace input (non-opener)"; rewrote the GUARDRAIL-DECOUPLE-RESET-01 drift note into a Step C/D explanation that names the block-only registry. |
| `src/lib/camera/auto-progression.ts` | `canonicalShallowContractDrovePass` diagnostic comment in Step E | Already truthful before P2; no change needed (already calls out authority-law resolution §4). |
| `src/lib/camera/auto-progression.ts` | `passCoreRepIdentityMismatch` diagnostic comment | Rewrote to explicitly say "diagnostic — never read as a gate input" and "pass-core is not an opener, so a true here does NOT imply any pass authority". |
| `src/lib/camera/auto-progression.ts` | `getSquatProgressionCompletionSatisfied` inline `passCore` note | Rewrote PASS-AUTHORITY-RESET-01 header from "immutable pass truth from pass-core" to "same-rep motion trace input (non-opener) sourced from pass-core" with an explicit pointer to `readSquatPassOwnerTruth` / PR-01 as the real opener. |
| `src/lib/camera/squat/squat-ui-progression-latch-gate.ts` | File-level JSDoc (new) + `computeSquatUiProgressionLatchGate` header | Added a module-level JSDoc calling out the gate as a **non-opener consumer / block-only layer** in the opener law, enumerating its closers, and disclaiming any opener role. Korean header retained but re-anchored to authority-law resolution terms (block-only consumer, UI-layer closers only). |
| `src/lib/camera/squat/squat-progression-contract.ts` | `computeSquatCompletionOwnerTruth` header | Expanded the Korean docblock to spell out the opener law one-liner, name `completionOwnerReason` as an **explanation label only**, and explicitly exclude the closed legacy `pass_core_detected` label from opener authority. |

### Not changed (intentionally)

- **`src/lib/camera/squat/squat-absurd-pass-registry.ts`** — authored fresh
  in the landed P3 PR; file header, JSDoc, types, and registry entries
  already use canonical P2 wording ("block-only", "late_final_veto" /
  "upstream_classified_only" stages, explicit "never grants pass"). No
  P2-motivated drift remained. Left untouched to avoid churn.
- **`src/lib/camera/squat/squat-completion-core.ts`** — scanned for the
  `pass_core` / `canonicalShallowContractDrovePass` / opener / legacy /
  compat keywords. Every occurrence found is already couched in
  authority-law-correct terms (§1760–1847: "never opens final pass by
  itself"; §2207–2224: "coexistence deferral — resolved … no production
  assigner, sink-only defensive label"; §3586–3637: "canonical set of
  shallow contract blocker families" + explicit legacy-compat tagging for
  `shallowNormalizedBlockerFamily`). No P2-motivated drift remained.
- **`src/lib/camera/evaluators/squat.ts`** — scanned for opener / owner /
  pass-core wording. All remaining references are about pass-core's narrow
  motion-truth role in the evaluator (same-rep integrity, peak-anchor
  sharing), which is accurate at that layer. No cleanup needed for P2.
- **Smoke scripts** (`camera-pr-01-*`, `camera-pr-e1-*`, `camera-pr-p3-*`,
  `camera-pr-f-*`) — assertion meaning and test names are already truthful
  after PR-01 / P3; no P2 edits necessary.
- **Parent docs** — `P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`,
  `PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`,
  `PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`, and the P3 implementation
  report are all consistent with the wording this PR lands. No wording
  drift required a docs sweep.

### Renames

None. Every change is comment / JSDoc only. This is per design rule 3
("rename only when behavior-preserving is obvious and churn is small").
The risky names (`motionOwnerSource`, `readSquatCurrentRepPassTruth`,
`canonicalShallowContractDrovePass`, `isFinalPassLatched`) are widely
referenced by smokes and downstream consumers; their meaning is now
pinned via JSDoc instead of renaming.

## How legacy / compat field status is made explicit

- **`motionOwnerSource: 'pass_core' | 'completion_state' | 'none'`** —
  field-level JSDoc now explicitly calls it a **sink-only rep-consistency
  adapter trace** and bans gate-input use; interface-level doc links the
  authority-law position.
- **`passCoreRepIdentityMismatch`** — comment now states "sink-only,
  never read as a gate input" and "pass-core is not an opener, so a true
  here does NOT imply any pass authority".
- **`canonicalShallowContractDrovePass`** — existing JSDoc already marked
  it as a "defensive diagnostic guard, not an active separator between
  two live pass paths" and "sink-only — never a gate input" (written in
  the resolution PR). P2 kept the wording; no drift.
- **`completionOwnerReason === 'pass_core_detected'`** — flagged
  consistently across `readSquatPassOwnerTruth`,
  `computeSquatCompletionOwnerTruth`, and
  `enforceSquatOwnerContradictionInvariant` as a **formally closed legacy
  label** with no production assigner in `src/` today; retained only as
  a synthetic probe in PR-01 smoke §5/§6/§10/§11.
- **`finalPassTruthSource: 'post_owner_ui_gate'`** — JSDoc now says
  "identifies which layer produced this mirror"; the interface itself is
  tagged as a **non-opener consumer mirror**.
- **`isFinalPassLatched`** — JSDoc now says "final-pass consumer / latch
  mirror, not an opener"; the tests-only compat path is explicitly
  labeled.
- **`readSquatCurrentRepPassTruth`** — JSDoc now says "rep-consistency
  diagnostic adapter, not a final-pass opener" and points downstream
  consumers at `readSquatPassOwnerTruth` for the opener chain.
- **`readSquatSetupTruthWithCompatFallback`** — name already encodes
  compat status; no drift.
- **`SquatCompletionOwnerStateSlice`** — existing PR-01 wording is
  accurate; `computeSquatCompletionOwnerTruth` header is now explicit
  that this slice is the **canonical opener input**.

## Behavior preservation proof

| Layer | Verification |
| --- | --- |
| Opener law | `readSquatPassOwnerTruth`, `enforceSquatOwnerContradictionInvariant`, `getSquatPostOwnerFinalPassBlockedReason`, `computeSquatCompletionOwnerTruth` — function bodies unchanged. |
| Block-only registry | `applySquatFinalBlockerVetoLayer` + `evaluateSquatAbsurdPassRegistry` + `SQUAT_ACTIVE_ABSURD_PASS_REGISTRY` order — unchanged. |
| UI gate | `computeSquatUiProgressionLatchGate` body, closer order, blocked reasons — unchanged. |
| Latch mirror | `isFinalPassLatched` body unchanged. |
| Trace adapter | `readSquatCurrentRepPassTruth` body unchanged; only JSDoc + inline commentary rewritten. |
| Pipeline | `evaluateExerciseAutoProgress` Step A/B/C/D/E execution order, branch logic, and emitted fields — unchanged. |
| Smokes | All 12 PR-F proof-gate scripts green, including `camera-pr-01-squat-completion-first-authority-freeze-smoke` and `camera-pr-p3-squat-absurd-pass-registry-normalization-smoke`. |
| Lint | No new lint errors in any touched file. |

Evidence:

- `npx tsx scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs` → 25/25 passed.
- `npx tsx scripts/camera-pr-p3-squat-absurd-pass-registry-normalization-smoke.mjs` → 25/25 passed.
- `node scripts/camera-pr-f-regression-proof-gate.mjs` → all 12 required scripts executed, no unexplained SKIP, zero failures. Individual totals inside PR-F include:
  - PR-E1 promotion registry: 52/52.
  - PR-D regression harness: 69/69.
  - Ultra-shallow no-early-pass: all green.
  - Blended-early-peak lock: 18/18.
  - PR-6 ultra-low-policy: 33/33.
  - PR-01 authority freeze: 25/25.
  - PR-P3 absurd-pass registry: 25/25.

## Misconceptions explicitly closed by P2

After this PR, the following mis-reads are no longer possible from a
plain reading of the file headers, helper JSDoc, or field comments:

1. "`motionOwnerSource` is the real motion-pass owner." — closed; it is
   documented as a sink-only rep-consistency trace.
2. "`readSquatCurrentRepPassTruth` is the final-pass gate boundary." —
   closed; it is documented as a diagnostic adapter and downstream
   readers are pointed at `readSquatPassOwnerTruth`.
3. "`isFinalPassLatched` independently decides pass." — closed; it is
   documented as a latch mirror of the post-owner + UI gate outcome.
4. "`canonicalShallowContractDrovePass` is a gate input." — already
   closed by the authority-law resolution PR, preserved in P2.
5. "`completionOwnerReason` can act as an opener (e.g., the legacy
   `pass_core_detected` label)." — closed in three headers
   (`readSquatPassOwnerTruth`, `computeSquatCompletionOwnerTruth`,
   `enforceSquatOwnerContradictionInvariant`) with consistent language.
6. "The UI latch gate is an alternate owner." — closed; module-level
   JSDoc on `squat-ui-progression-latch-gate.ts` now names it a
   non-opener consumer / block-only layer.
7. "The P3 registry can grant pass under some condition." — already
   closed in the P3 file header (landed last PR); P2 did not need
   additional wording there.

## Why this is P2 and not PR-01 / P3 / authority-law

- PR-01 locked the opener law (completion-owner truth is the sole
  opener). Runtime contract.
- The authority-law resolution PR closed the
  `completionOwnerReason === 'pass_core_detected'` ambiguity
  (Interpretation C: no production assigner, smoke-only probe). Runtime
  contract.
- P3 normalized the scattered late absurd-pass blockers into one
  block-only registry surface. Runtime contract (behavior-preserving but
  structural).
- **P2 is the final, behavior-preserving wording pass.** It does not
  change any runtime logic, threshold, opener, blocker, closer, late
  veto order, blocked reason string, reason-string semantics, smoke
  assertion, proof-gate skip policy, or non-squat file. It only rewrites
  JSDoc and inline comments so the repo describes the already-landed
  authority model truthfully.

## Remaining follow-on step (one line)

Squat camera authority / blocker / wording axis is now closed; next
natural work is non-squat (e.g., overhead-reach) alignment or camera
consumer-surface audits, not further squat authority rework.
