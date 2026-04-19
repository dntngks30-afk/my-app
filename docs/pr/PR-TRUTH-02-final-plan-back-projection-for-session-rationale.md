# PR-TRUTH-02 — Final plan back-projection for session rationale

## Parent SSOT

- Parent: `docs/pr/PR-TRUTH-PARENT-SESSION-DISPLAY-AND-GENERATION-ALIGNMENT.md`
- Previous child: `docs/pr/PR-TRUTH-01-map-node-live-truth-hardening.md`

This PR is the second child PR in the session display/generation alignment truth map.

---

## Goal

Stop `session_rationale`, `session_focus_axes`, and display-facing session goal meaning from drifting away from the **final selected session composition** after candidate competition, constraint, ordering, fallback, and audit stages.

This PR owns **generator output meaning reconciliation** only.

It does not own map source hierarchy, onboarding experience semantics, or active-plan/profile mismatch reuse policy.

---

## Locked problem statement

Current first-session meaning is introduced early from:

- public-result/session bridge
- `primary_type` / `result_type`
- `baseline_session_anchor`
- `resolveFirstSessionIntent(...)`
- pre-selection `priority_vector` interpretation

But the final selected session plan is still changed by later stages:

- candidate competition
- constraint engine
- ordering engine
- fallback selection
- plan quality audit

As a result, the persisted meta can still say:

- lower stability / core stability / upper mobility / etc.

while the final `segments` and selected templates may have materially shifted.

This causes user-facing drift between:

- panel `오늘의 목표`
- session rationale text
- map/panel display fields derived from those meta fields
- actual chosen exercise composition

The failure is not only wording quality.
It is **post-selection truth drift**.

---

## Scope

### In scope

- reconcile final display-facing session meaning with final selected plan composition
- add final-plan-aware recomputation or correction for session meta fields
- add observability for intent-vs-final drift
- preserve existing first-session intent as an upstream anchor, not as guaranteed final truth

### Out of scope

- no scoring-core changes
- no public result scoring changes
- no onboarding experience semantics changes
- no active-plan idempotent reuse changes
- no map renderer source-hierarchy changes
- no panel UI redesign
- no pain-mode meaning changes
- no adaptive-engine redesign

---

## Locked truth

### Truth 1 — upstream intent is not final truth by itself

The following are upstream alignment inputs, not guaranteed final output truth:

- `baseline_session_anchor`
- `result_type`
- `primary_type`
- `priority_vector`
- `resolveFirstSessionIntent(...)`
- early `session_rationale`
- early `session_focus_axes`

They remain important anchors, but they must not be treated as final user-facing meaning after the plan has materially changed downstream.

### Truth 2 — final selected composition is the last semantic owner

Once `segments` and `PlanItem`s are finalized, the last semantic owner for display-facing session meaning becomes the **final plan composition**.

Display-facing meta must no longer describe a session the generator did not actually build.

### Truth 3 — rationale/focus/goal fields are output fields, not sacred inputs

The following meta fields must be treated as final output meaning fields and may be reconciled after selection:

- `session_focus_axes`
- `session_rationale`
- `session_goal_code`
- `session_goal_label`
- `session_goal_hint`
- `session_role_code`
- `session_role_label`

This PR does not require all of them to be newly invented from scratch, but it does lock that they may be corrected after final plan materialization.

### Truth 4 — first-session intent still matters

This PR must not erase first-session intent or baseline alignment.

It must preserve upstream intent as:

- alignment anchor
- observability reference
- generation constraint source

But it must stop pretending that early intent alone is the final persisted meaning when downstream composition changed materially.

### Truth 5 — drift must become observable

If the final plan remains strongly aligned, observability should show that.
If the final plan drifted materially, observability should show that too.

Silent drift is no longer acceptable.

---

## Required behavior changes

### A. Introduce final-plan-aware reconciliation step

After final segment/order/constraint work is done, add a reconciliation step that reads the final plan composition and derives a final display-meaning snapshot.

The step may:

- recompute final dominant axes from selected templates
- recompute final session goal family from selected templates
- rewrite or normalize final `session_rationale`
- rewrite or normalize final `session_focus_axes`
- produce drift audit metadata

This step must happen **after** final segment composition is known.

### B. Preserve upstream anchor separately

Keep upstream anchor observability in meta, for example:

- baseline anchor
- first-session intent anchor
- gold path vector
- intent source

But final display-facing fields must represent the final built plan, not only the anchor.

### C. Add drift audit meta

Add additive meta that makes intent-vs-final comparison inspectable.

Expected shape can be additive, e.g.:

```ts
final_alignment_audit?: {
  upstream_focus_axes: string[]
  final_focus_axes: string[]
  upstream_goal_code: string | null
  final_goal_code: string | null
  drift_level: 'none' | 'light' | 'material'
  dominant_template_tags: string[]
}
```

Exact naming can differ, but the semantic purpose is locked.

### D. Keep display contract consumer-facing fields stable

Downstream consumers such as:

- SessionPanel
- plan-summary route
- map node display contract

should continue to read the same field family.

This PR should improve the meaning of those fields, not force a wide consumer rewrite.

---

## Files expected to change

Primary expected files:

- `src/lib/session/plan-generator.ts`
- `src/core/session-rationale.ts` or nearby rationale helper if needed

Possible additive support files:

- `src/lib/session/session-display-contract.ts`
- `src/lib/session/session-display-copy.ts`
- any new helper dedicated to final-plan meaning reconciliation

Possible read-only inspection files:

- `src/lib/session/priority-layer.ts`
- `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts`
- `src/app/api/session/plan-summary/route.ts`

---

## Implementation rules

### Rule 1 — preserve generator selection semantics unless required for reconciliation only

Do not change:

- candidate competition meaning
- constraint engine meaning
- ordering engine meaning
- first-session intent selection semantics
- scoring / pain semantics

This PR is about final meta truth, not selection-policy redesign.

### Rule 2 — additive observability preferred

If you add audit/meta fields, they must be additive and not break existing consumers.

### Rule 3 — keep current display field family

Prefer reconciling these existing fields over inventing a completely new parallel display schema.

### Rule 4 — do not fake perfect alignment

If final composition still only partially aligns with upstream intent, do not write copy that falsely claims a pure anchor-specific session.

The final meaning must be honest about the built plan.

---

## Acceptance criteria

1. Final persisted `session_rationale` is no longer only an early-anchor sentence when final selected composition materially differs.
2. Final `session_focus_axes` better reflect the actual final selected exercise mix.
3. If upstream intent and final composition diverge, the plan meta exposes additive audit/drift information.
4. Existing display consumers continue reading the same field family without contract breakage.
5. No onboarding, scoring, pain, or active-plan reuse semantics are changed in this PR.

---

## Regression risks

### Risk 1 — over-correcting away meaningful first-session anchors

If reconciliation fully replaces anchor meaning, session 1 may lose intended result-aware structure.

Mitigation:

- preserve upstream anchor fields separately
- reconcile final display meaning, do not erase intent observability

### Risk 2 — brittle heuristics from template focus tags

If reconciliation relies too simplistically on selected template tags, final meaning may oscillate or become noisy.

Mitigation:

- use bounded mapping
- prefer dominant/frequency-based aggregation
- keep output vocabulary small and stable

### Risk 3 — downstream consumer drift if field names change

If this PR renames or removes display fields, panel/map regressions can spread.

Mitigation:

- keep existing field family intact
- add audit metadata separately

---

## Done means

This PR is done when the session explanation and the final selected session stop feeling like two different systems talking about the same session.

The user-facing meaning may still be compact.
But it must now be anchored to the plan that was actually built.
