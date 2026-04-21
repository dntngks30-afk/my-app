# PR-CAM-SQUAT-AUTHORITY-LAW-AMBIGUITY-RESOLUTION-MAP

> **Session type:** docs-only design SSOT.
>
> **Sole output:** this document. No `src/*`, `scripts/*`, tests, harness,
> registry, threshold, runtime, naming, or comment cleanup changes.
>
> **Purpose:** E1 representative promotion has landed, but squat shallow
> authority-law wording still carries an ambiguity around
> `completionTruthPassed`, `completionOwnerPassed`, `pass_core_detected`, and
> final-pass opener semantics. This document maps the ambiguity before any
> implementation PR resolves it.

---

## 1. Purpose / Scope Lock

This document exists to lock a resolution map, not to implement the resolution.

One-line summary:

**E1 promotion 이후에도 남아 있는 squat shallow authority-law ambiguity를, implementation 이전에 state/classification/invariant 단위로 먼저 고정하여 이후 P3/P2가 잘못된 가정 위에서 진행되지 않게 만든다.**

### In scope

- Separate current repo truth from product-law intent.
- Classify the fields:
  - `completionTruthPassed`
  - `completionOwnerPassed`
  - `completionOwnerReason`
  - `canonicalShallowContractDrovePass`
  - `finalPassEligible`
  - `finalPassGranted`
  - `finalPassLatched`
- Preserve the unresolved status of the historical
  `completionOwnerReason === "pass_core_detected"` ambiguity until a dedicated
  authority-law resolution PR.
- Explain why P3 registry normalization and P2 naming/comment cleanup must
  follow authority-law resolution.

### Out of scope

- No implementation prompt.
- No code, smoke, fixture, harness, registry, or proof-gate edit.
- No threshold proposal.
- No pass ownership change.
- No completion semantics change.
- No final-pass opener change.
- No blocker registry implementation.
- No naming/comment cleanup.

---

## 2. Current repo truth snapshot

### CURRENT_IMPLEMENTED

Current main has the E1 representative promotion landed:

- `shallow_92deg` is `permanent_must_pass`.
- `ultra_low_rom_92deg` is `permanent_must_pass`.
- The E1 smoke asserts the full canonical proof bundle:
  - `completionTruthPassed === true`
  - `finalPassEligible === true`
  - `isFinalPassLatched('squat', gate) === true`
  - `canonicalShallowContractDrovePass === true`
  - `canonicalTemporalEpochOrderSatisfied === true`
  - `canonicalShallowContractBlockedReason == null`

The current final-pass path is:

1. `computeSquatCompletionOwnerTruth(...)` reads completion-state fields.
2. `readSquatPassOwnerTruth(...)` reads that completion-owner truth and treats
   pass-core as same-rep stale veto / blocked-reason assist, not as opener.
3. `enforceSquatOwnerContradictionInvariant(...)` fail-closes owner truth if
   completion-state contradicts it.
4. `computeSquatPostOwnerPreLatchGateLayer(...)` builds UI gate, final blocked
   reason, `progressionPassed`, and `squatFinalPassTruth`.
5. `finalPassEligible` mirrors `progressionPassed`, which is true only when
   `finalPassBlockedReason == null`.

Current code search across `src/lib/camera` finds no production assignment that
sets `completionOwnerReason` to `"pass_core_detected"`. The string remains in
comments/diagnostics as a historical or deferred authority-law marker.

Current smokes confirm:

- PR-01 authority-freeze smoke passes and explicitly asserts that
  pass-core-positive evidence without canonical completion-owner truth does not
  open `finalPassGranted`.
- E1 representative smoke passes and asserts both promoted shallow fixtures are
  canonical shallow-contract-driven passes.

### LOCKED_DIRECTION

The product law remains:

- completion-owner truth is the only opener of squat final pass.
- ordering success is a close guard, not pass ownership.
- registry is block-only and never a grant path.
- pass-core is not automatically promoted to canonical opener.
- naming cleanup must not hide unresolved authority-law ambiguity.
- transitional telemetry state and canonical law must not be conflated.

### NOT_YET_IMPLEMENTED

A dedicated authority-law resolution PR has not yet formally reconciled:

- whether historical `completionOwnerReason === "pass_core_detected"` should be
  treated as a sanctioned canonical owner reason, a transitional coexistence
  reason, or a latent authority leak;
- whether docs that still discuss `pass_core_detected` as possible owner truth
  should be superseded, narrowed to historical telemetry, or retained as compat
  language for older traces.

---

## 3. Canonical law vs implemented state

### Q1. Current canonical opener law

The canonical opener law is:

> Squat final pass may open only from completion-owner truth for the same current rep, after allowed UI/progression gates and block-only vetoes are clear.

In current field terms:

- `completionOwnerPassed === true` is required, but not sufficient by itself.
- `completionTruthPassed === true` is currently enforced before final pass can
  clear, via the final blocked-reason builder.
- `finalPassEligible === true` means the post-owner final-pass surface is clear.
- `finalPassGranted === true` mirrors the same final-pass surface inside
  `squatFinalPassTruth`.
- `finalPassLatched === true` / `isFinalPassLatched('squat', gate) === true`
  consumes that final-pass surface, not a separate opener.

Therefore the current repo reads "completion-owner truth only opens final pass"
as:

```text
completionTruthPassed
AND completionOwnerPassed
AND ui/progression gate clear
AND block-only vetoes clear
=> finalPassEligible / finalPassGranted / final latch may be true
```

This is stricter than older telemetry framing where `pass_core_detected` could
appear to satisfy owner truth while `completionTruthPassed` remained false.

### Q2. Meaning of `completionTruthPassed`

`completionTruthPassed` currently means:

> completion-state pass truth: `completionSatisfied === true` and
> `completionPassReason` is present and not `not_confirmed`.

For promoted shallow representatives it is also the practical signal that the
canonical shallow contract actually closed, because the E1 smoke requires it
together with `canonicalShallowContractDrovePass === true`.

It should not be renamed or described as merely "one random sub-truth" before
authority-law resolution. In current code it is a required completion-state
truth input for final pass. The unresolved ambiguity is historical/documentary:
older docs asked whether it was only canonical-shallow-contract-specific while
`completionOwnerPassed` could be broader.

### Q3. Meaning of `completionOwnerPassed`

`completionOwnerPassed` currently means:

> the owner adapter accepted completion-state truth as the current rep's
> completed movement owner, after checking completion-state fields and after
> contradiction invariants are applied.

It is not a standalone compat aggregate that may ignore completion truth. Current
final-pass logic re-checks `completionTruthPassed`, `completionBlockedReason`,
and `cycleComplete` before clearing final pass.

Field-level contract:

- `completionOwnerPassed === true` is necessary for final pass.
- `completionOwnerPassed === true` is not sufficient if completion truth,
  cycle completion, UI gate, or block-only vetoes fail.
- Any owner pass contradicted by completion-state must fail closed.

### Q4. Layer of `completionOwnerReason === "pass_core_detected"`

This document does not force the final implementation decision, but current
repo evidence separates three possible interpretations:

| Interpretation | Status in current repo | Follow-up implication |
|---|---|---|
| A. sanctioned canonical owner reason | Not supported by current `src` production assignment search; current smokes assert pass-core-positive / completion-false does not open final pass. | If chosen, a future PR must explicitly amend PR-01 law and explain why `completionTruthPassed` is not required for this reason. |
| B. transitional coexistence reason | Plausible only for older telemetry/docs or compatibility traces; current code keeps comments/diagnostics that mention the coexistence deferral. | If retained, a future PR must mark it as compat/historical and prevent it from being read as opener law. |
| C. latent authority leak requiring closure | The older design SSOT explicitly deferred this possibility; current code appears to have closed the opener path but not all wording. | If confirmed, the authority-law PR should formally ban it as canonical opener and update stale docs/comments without changing current behavior. |

Current design classification: **B/C unresolved at the documentation-law layer,
but not an active opener in current code truth.**

---

## 4. Ambiguity surface map

The ambiguity is not that current E1 shallow representatives lack proof. They
now pass through canonical proof.

The ambiguity is the remaining wording gap between:

- older shallow source SSOT language that deferred whether
  `pass_core_detected` was sanctioned owner reason or latent leak;
- current code comments that say the shortcut is removed;
- diagnostics that still preserve the string as a comparison marker;
- P2 cleanup pressure to rename/comment-clean before the law is explicitly
  resolved.

### Mismatch surfaces

1. `completionTruthPassed` can be read two ways in old docs:
   - canonical completion-state truth required for final pass;
   - narrower shallow-contract truth that may differ from broader owner truth.

2. `completionOwnerPassed` can be misread two ways:
   - canonical owner truth after completion-state invariants;
   - lifted aggregate that may absorb pass-core as owner.

3. `pass_core_detected` can be misread three ways:
   - a legitimate owner reason;
   - a temporary coexistence / telemetry reason;
   - a leak that must be closed.

4. `canonicalShallowContractDrovePass` can be misused:
   - intended: diagnostic separator for canonical shallow passes vs assist-ish
     historical paths;
   - forbidden: a new opener or replacement for final pass law.

5. `finalPassEligible`, `finalPassGranted`, and final latch can be conflated:
   - intended: same final-pass product surface at different packaging/latch
     layers;
   - forbidden: treating latch as an independent authority source.

---

## 5. State classification table

### Table A - State classification matrix

| field | current observed role | canonical intended role | ambiguity | may open final pass? | follow-up owner |
|---|---|---|---|---|---|
| `completionTruthPassed` | Completion-state truth computed from `completionSatisfied` + valid `completionPassReason`; asserted true for E1 representatives. | Required completion-state truth for current-rep completion. | Older docs sometimes frame it as narrower canonical-shallow-contract truth rather than broader owner truth. | No by itself; required precondition only. | Authority-law resolution PR |
| `completionOwnerPassed` | Completion-owner adapter result after completion-state owner rules; contradiction invariant may revoke it. | Necessary owner truth before final pass. | Could be misread as lifted aggregate that may absorb pass-core. | No by itself; only one required opener-layer input. | Authority-law resolution PR |
| `completionOwnerReason` | Current code derives from completion pass reason or explicit shallow owner reasons; no current production assignment to `pass_core_detected` found. | Explains why owner passed; must not bypass completion truth. | Historical `pass_core_detected` deferral remains in docs/comments. | No. Reason labels never open pass. | Authority-law resolution PR, then P2 |
| `canonicalShallowContractDrovePass` | Sink-only diagnostic; true for E1 representatives when canonical shallow contract drove pass. | Observability separator between canonical shallow pass and historical/assist-ish paths. | Could be mistaken for a gate input. | No. Explicitly sink-only. | Authority-law resolution PR preserves, P2 clarifies |
| `finalPassEligible` | Product gate output; mirrors `progressionPassed` and final blocked-reason clear state. | Primary product final-pass eligibility surface. | Must not be treated as proof of which upstream owner path won. | It is the final surface, not an upstream opener. | Authority-law resolution PR |
| `finalPassGranted` | `squatFinalPassTruth` mirror of final blocked-reason clear state. | Diagnostic/final truth surface aligned with `finalPassEligible`. | Could be read apart from gate if diagnostics drift. | It reports final grant; does not independently open. | Authority-law resolution PR / PR-F proof gate |
| `finalPassLatched` / `isFinalPassLatched` | Latch consumer of final-pass surface; E1 asserts true for representatives. | Progression latch after final surface clears. | Risk of treating latch as alternate opener. | No; consumes final surface. | Authority-law resolution PR, P2 wording |

### Illegal / unresolved state classification

### Q5. Illegal state legal status

| state combination | classification | reason |
|---|---|---|
| `completionTruthPassed === false` + `finalPassGranted === true` | **absolute illegal in current law** | PR-01 smoke asserts this fails closed, including a synthetic `pass_core_detected` owner case. |
| `completionOwnerPassed !== true` + `finalPassEligible === true` | **absolute illegal** | Final gate requires owner truth; PR-01 smoke asserts owner-not-passed cannot progress. |
| `completionOwnerReason === "pass_core_detected"` + final pass true | **authority-law unresolved state** | Current code does not appear to produce it, but older docs deferred whether it is sanctioned, transitional, or leak. Any future occurrence must be escalated before P3/P2. |
| `canonicalShallowContractDrovePass === false` + final pass true | **transitional tolerated telemetry state only outside promoted shallow reps; forbidden as proof for E1 representatives** | Non-shallow or standard passes may not be "canonical shallow contract drove pass." For promoted shallow representatives, E1 requires it true. If shallow final pass is true with this false, authority-law must classify it before cleanup. |

---

## 6. Invariant table

### Q6. Observability / diagnostics that must remain

Before authority-law implementation starts, these diagnostic surfaces and proof
obligations must remain intact:

- `completionTruthPassed`, `completionOwnerPassed`,
  `completionOwnerReason`, and `completionOwnerBlockedReason`;
- `canonicalShallowContractDrovePass`;
- `canonicalTemporalEpochOrderSatisfied` and
  `canonicalTemporalEpochOrderBlockedReason`;
- `squatFinalPassTruth.finalPassGranted` and paired blocked reason;
- `finalPassEligible` and `isFinalPassLatched('squat', gate)` checks;
- PR-01 authority-freeze smoke assertions for owner contradiction,
  completion-false/final-pass-true, and pass-core-only non-opener cases;
- E1 representative smoke assertions for the six-bit canonical shallow bundle;
- PR-F proof gate posture that forbids unexplained SKIP.

| invariant | classification | proof / diagnostic obligation |
|---|---|---|
| `completionOwnerPassed !== true -> finalPassEligible !== true` | absolute | PR-01 smoke must remain green. |
| `completionTruthPassed !== true -> finalPassGranted !== true` | absolute under current law | PR-01 smoke must remain green; no `pass_core_detected` exception may bypass it. |
| `completionOwnerReason === 'not_confirmed' -> completionOwnerPassed !== true` | absolute | Owner contradiction invariant must revoke pass. |
| `completionOwnerPassed === true -> completionOwnerBlockedReason == null` | absolute | Owner contradiction invariant must revoke pass if blocked reason exists. |
| `cycleComplete !== true -> final pass false` | absolute | PR-01 smoke must preserve cycle-complete contradiction closure. |
| `canonicalTemporalEpochOrderSatisfied === true` is close guard only | absolute | E1 smoke may assert it, but no PR may use it as owner truth. |
| Absurd-pass registry is block-only | absolute | P3 must normalize blockers without adding grant path. |
| `canonicalShallowContractDrovePass` is sink-only | absolute | Keep as diagnostic/proof field, never gate input. |
| `pass_core_detected` is not automatically canonical opener | absolute until authority-law explicitly says otherwise | Any future PR that wants otherwise must supersede this resolution map and PR-01 law. |
| Naming cleanup cannot resolve law by wording alone | absolute | P2 waits until authority-law PR classifies `pass_core_detected`. |

---

## 7. Allowed interpretations and what each would imply

### Interpretation A - `pass_core_detected` is sanctioned canonical owner reason

This is not supported by current code truth, but remains a logically possible
future decision only if a higher authority-law PR explicitly chooses it.

Implications:

- `completionTruthPassed` would have to be redefined as narrower than
  completion-owner truth.
- PR-01 illegal state wording would need amendment.
- Smokes that currently fail-close `completionTruthPassed === false` +
  final pass true would need a deliberate, documented exception.
- P3 cannot run first, because registry normalization might encode the wrong
  opener precondition.
- P2 cannot run first, because cleanup could falsely bless a broader owner.

### Interpretation B - `pass_core_detected` is transitional coexistence reason

This is plausible for older telemetry and historical docs.

Implications:

- Current runtime can keep fail-closing it as opener while diagnostics preserve
  the term for replay/compat explanation.
- The authority-law PR should mark the reason as transitional or historical,
  not canonical.
- P3 may proceed afterward with no grant path.
- P2 may then clean wording to say the reason is compat/historical and
  non-opener.

### Interpretation C - `pass_core_detected` is latent authority leak

This matches the stricter PR-01 philosophy and appears closest to current code
behavior, because comments state the shortcut is removed and smokes enforce that
pass-core-positive/completion-false cannot open final pass.

Implications:

- Authority-law PR should formally close the ambiguity and supersede stale
  source-SSOT deferral language.
- Any future telemetry showing this state with final pass true is a regression.
- P3 runs after that closure and normalizes only blockers.
- P2 runs last and removes misleading wording without changing behavior.

---

## 8. What this design does **not** resolve

This document does not decide A vs B vs C as implementation law.

It locks only the decision boundary:

- Current code truth does not treat `pass_core_detected` as an active final-pass
  opener.
- Older docs/comments still preserve a deferred authority-law ambiguity.
- A dedicated authority-law resolution PR must classify that ambiguity before
  P3 registry normalization and P2 cleanup.

This document also does not:

- change thresholds;
- retune shallow detection;
- change pass ownership;
- change final-pass opener logic;
- add or normalize registry implementation;
- clean names/comments;
- create implementation instructions.

---

## 9. Follow-up PR split recommendation

### Table B - Follow-up PR split

| PR | purpose | allowed scope | forbidden scope | dependency | why it must come in this order |
|---|---|---|---|---|---|
| Authority-law resolution PR | Classify `pass_core_detected` as sanctioned, transitional, or leak; align `completionTruthPassed` vs `completionOwnerPassed` law. | Docs and, only if explicitly authorized later, narrow invariant/diagnostic updates. | No threshold tuning, no P3 registry, no P2 cleanup sweep. | This document. | P3 and P2 need a settled opener law before they can safely normalize blockers or wording. |
| P3 absurd-pass registry normalization PR | Normalize scattered blockers into explicit block-only registry. | Block-only registry shape, truthful blocked reasons, focused blocker smokes. | No opener rewiring, no completion semantics changes, no pass-core promotion. | Authority-law resolution PR. | Registry must know what it may block; it must not accidentally encode unresolved opener assumptions. |
| P2 authority naming/comment cleanup PR | Behavior-preserving cleanup of names/comments/trace wording. | Comments, helper naming where safe, deprecated/compat wording. | No runtime behavior change, no threshold change, no harness logic change, no law decision by wording. | Authority-law resolution PR, then P3 if P3 changes names/surfaces. | Cleanup before law resolution can launder ambiguity into misleading "truthy" names. |

### P3 before authority-law: allowed vs blocked

### Q7. Why P3 and P2 must follow authority-law

Allowed before authority-law only as read-only planning:

- inventory existing blocker families;
- identify current blocked reasons;
- draft a block-only registry shape without committing code.

Blocked until authority-law resolution:

- implementing the registry;
- changing final blocked-reason precedence;
- deciding whether any `pass_core_detected`-related state is blocker, owner,
  or compat telemetry.

### P2 before authority-law: dangerous names/comments

Do not clean up or rename these before authority-law resolution:

- comments describing `pass_core_detected`;
- `completionTruthPassed` wording;
- `completionOwnerPassed` wording;
- `canonicalShallowContractDrovePass` wording;
- "ownerSource: pass_core" comments in current-rep diagnostics;
- final-pass surface comments that could imply latch or pass-core opens pass.

---

## 10. Final lock

The next implementation-bearing work must not treat this document as permission
to resolve authority law opportunistically.

Locked principles:

1. Ordering success is a close guard, not pass ownership.
2. Registry is block-only and not a grant path.
3. Pass-core is not automatically promoted to canonical opener.
4. Naming cleanup is not a way to cover unresolved authority-law ambiguity.
5. Transitional telemetry state and canonical law must not be confused.

Recommended next order:

1. Authority-law resolution PR.
2. P3 absurd-pass registry normalization PR.
3. P2 authority naming/comment cleanup PR.
