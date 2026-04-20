# SSOT — Squat Completion-First / Quality-Strict / Veto-Last (2026-04)

> This document is the new parent SSOT for squat pass authority work.
> Its purpose is to end the long-running truth split between completion-state, pass-core, UI gate, shallow assist layers, and downstream semantics.
>
> When any older squat design doc conflicts with this document on final pass authority, this SSOT wins.

---

## 1. Why this SSOT exists

The repo currently contains multiple partially-correct philosophies that do not fully agree with one another.

Examples of the active split:

- some docs and code paths treat `pass-core` as the effective motion owner,
- some docs attempt to re-center `completion owner` as the product truth,
- some consumer layers still derive semantics from `completionTruthPassed`,
- while product gating and latch behavior already consume a frozen final-pass surface,
- and a number of special-case blockers exist as late vetoes for specific false-pass families.

This has produced the recurring failure class:

- completion/history says one thing,
- owner/gate says another,
- final product pass surface says a third thing,
- and the same attempt can look simultaneously like success and failure depending on which layer is read.

That split is no longer allowed.

---

## 2. Locked product philosophy

The squat product philosophy is now locked to:

**Completion-First, Quality-Strict, Veto-Last.**

This means:

1. **Pass should be easy enough for legitimate shallow / low-ROM real reps.**
   - A user does not need an athletic deep squat to be recognized.
   - Legitimate descend -> reversal/equivalent -> recovery cycles may still pass even when low-ROM.

2. **Judgment should remain strict after pass.**
   - A passed rep may still be classified as:
     - `clean_pass`
     - `warning_pass`
     - `low_quality_pass`
   - Success is not the same as high quality.

3. **Absurd pass must never be allowed.**
   - Standing still pass is forbidden.
   - Seated hold pass is forbidden.
   - Setup-motion-contaminated pass is forbidden.
   - Stale prior-rep pass is forbidden.
   - Mixed-rep timestamp pass is forbidden.
   - No-descent / no-reversal / no-recovery pass is forbidden.
   - Single contaminated early-peak false pass is forbidden.

This philosophy is compatible with the product line:

**“Pass easily, judge strictly, but never allow nonsense pass.”**

---

## 3. Canonical authority model

### 3.1 Final product pass truth

For squat only, **movement completed truth** comes from **completion-owner canonical truth**.

No other layer may directly open final pass.

### 3.2 Quality truth

Quality remains separate from pass/fail truth.

Allowed strict interpretation inputs include:

- capture quality
- quality-only warnings
- internal quality tier
- limitations
- symmetry / control / depth limitations

These may downgrade a successful pass to `warning_pass` or `low_quality_pass`, but they may not redefine success as failure.

### 3.3 Assist / forensic truth

The following layers are not final owners:

- `pass-core`
- `official shallow path`
- `shallow bridge`
- `closure proof`
- `event-cycle`
- trace-only owner/readiness/provenance fields

These layers may:

- help completion-owner truth form correctly,
- provide negative veto evidence,
- explain why a rep passed or failed,
- expose debug/forensic information,
- support quality interpretation.

They may **not** directly open final pass.

### 3.4 Veto truth

A late veto layer is allowed, but its role is narrow:

- it may close clearly absurd pass classes,
- it may not invent new pass authority,
- it may not replace completion-owner truth.

---

## 4. Truth hierarchy

The squat stack must now be read in this order.

### L0. Raw capture / valid frame truth
Input frames, body visibility, pass-window source data, baseline candidates.

### L1. Shared motion evidence truth
Shared descent / peak / reversal / recovery evidence that multiple layers may read.
This is evidence, not final product authority.

### L2. Completion-owner truth
Canonical movement-completed truth.
This layer decides whether the current rep is a completed rep.

### L3. Final-pass surface
Product surface used by gate / latch / downstream consumers.
This layer must be derived from L2 plus allowed vetoes.
It must not be opened directly by L1 helpers.

### L4. Quality / severity truth
Strict interpretation layer for successful reps.
Pass may become `clean_pass`, `warning_pass`, or `low_quality_pass`.

### L5. Forensics / history truth
Compatibility/debug fields remain visible but are sink-only.
They may explain, but not own, product pass.

---

## 5. Canonical laws

### Law A — Completion-first opener
`finalPassEligible === true` is legal only when completion-owner truth for the same current rep is true.

### Law B — Quality is not pass authority
A rep may be low-quality and still pass.
Quality fields may never open pass.
Quality fields may never turn a successful pass into `failed`.

### Law C — Assist demotion
`pass-core`, shallow assist, event-cycle, closure proof, and bridge signals are assist/veto/trace only.
They are not product pass owners.

### Law D — Same-rep integrity
The timestamps used to justify a pass must belong to one rep identity.
No synthetic pass/fail decision may mix:

- one rep’s peak,
- another rep’s reversal,
- and another rep’s standing recovery.

### Law E — Absurd-pass fail-close
If absurd-pass registry conditions are met, final pass must fail-close even if other layers produced positive-looking weak evidence.

### Law F — Final surface stability
The repo may keep the existing product surface contract:

- `finalPassEligible`
- `finalPassBlockedReason`
- `squatFinalPassTruth`

But these surfaces must be opened only by completion-owner truth plus allowed veto logic.

---

## 6. Illegal states

The following states are now illegal for squat.

1. `completionOwnerPassed !== true` and `finalPassEligible === true`
2. `completionTruthPassed === false` and `finalPassGranted === true`
3. `completionOwnerReason === 'not_confirmed'` and owner pass true
4. `completionOwnerPassed === true` and owner blocked reason non-null
5. `cycleComplete === false` and final pass true
6. final-pass success described downstream as `failed`
7. standing/seated/setup/stale/mixed-rep pass surviving to final surface
8. assist-only shallow admission reopening final pass without canonical completion-owner truth

---

## 7. Absurd-pass registry

The absurd-pass registry is the late safety wall.
It must stay narrow and explicit.

The registry includes at least these classes:

- standing still / standing recovered without real cycle
- seated hold / seated at pass
- setup-motion-contaminated cycle
- stale prior rep reused as current rep
- mixed-rep timestamp contamination
- contaminated blended early-peak false pass
- no real descent
- no real reversal or ascent-equivalent
- no real recovery after reversal

Registry rules:

- registry may only block,
- registry may not grant,
- registry entries must be explicit and testable,
- registry reasons must surface as truthful blocked reasons.

---

## 8. Design constraints

This SSOT is intentionally optimized for the fastest structural correction with minimal repo destruction.

Therefore:

- keep the current final-pass surface contract if possible,
- do not redesign the full camera stack,
- do not begin with threshold retuning,
- do not rewrite pose-features or pass-window architecture first,
- do not redesign UI, routes, or navigation,
- do not broaden this into overhead or non-squat work.

The first priority is authority correction, not elegance.

---

## 9. What must stay stable

The following product goals remain locked.

1. Legitimate shallow / low-ROM real reps must remain passable.
2. Deep/standard good reps must remain passable.
3. Quality strictness must remain visible after pass.
4. Existing product gate/latch surface should stay stable if possible.
5. Debug payload richness should remain or improve.

---

## 10. Migration strategy

The philosophy should be introduced through a narrow PR sequence, not one giant rewrite.

### Phase 1 — Completion-first authority freeze
Rebind final squat pass authority so only completion-owner truth may open final pass.
Demote pass-core and shallow assist layers from opener to assist/veto/trace roles.

### Phase 2 — Result semantics rebind
Align severity / diagnosis / bundle / snapshot consumers to the new canonical final surface.

### Phase 3 — Absurd-pass veto normalization
Turn scattered late blockers into one explicit absurd-pass registry policy.

### Phase 4 — Regression / illegal-state lock
Add fixture and smoke coverage so the illegal states above cannot silently return.

---

## 11. Supersession rule

When older squat docs disagree on final authority, this document wins.

In particular, future squat work must not reintroduce:

- pass-core-first final opener logic,
- assist-layer reopening of final pass,
- semantics that treat successful final-pass attempts as not completed,
- hidden split-brain between completion history and product outcome.

---

## 12. One-line lock

**For squat, only completion-owner truth may open final pass; quality remains strict and separate; assist layers may explain or veto, but never directly grant success.**
