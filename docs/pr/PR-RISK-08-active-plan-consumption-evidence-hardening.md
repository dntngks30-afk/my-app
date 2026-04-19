# PR-RISK-08 — Active plan consumption evidence hardening

## Parent SSOT

- Parent: `docs/pr/PR-RESIDUAL-RISK-CLOSURE-SESSION-DISPLAY-ALIGNMENT.md`
- Previous residual child: `docs/pr/PR-RISK-07-axis-tag-mapping-ssot-deduplication.md`
- Related primary child: `docs/pr/PR-TRUTH-04-active-plan-profile-mismatch-guard.md`

This PR is the third residual-risk closure PR after the main PR-TRUTH-01~05 sequence.

---

## Goal

Harden the safety gate for session-1 profile-mismatch regeneration so that the system can better distinguish:

- a truly untouched draft plan,
- a draft plan that already has meaningful user-consumption evidence,
- a plan that should still be reused despite profile mismatch.

This PR owns **consumption-evidence hardening for safe regeneration** only.

It does not change onboarding semantics, scoring semantics, or the existence of the profile-mismatch guard itself.

---

## Locked problem statement

PR-TRUTH-04 introduced a conservative and correct first-session mismatch guard using:

- generation-side profile snapshot,
- current profile truth,
- safe-regeneration gating.

But the current safe-regeneration gate still leans mainly on:

- `status === 'draft'`
- empty `exercise_logs`

That is already good enough for the current product state,
but it is thinner than ideal if other forms of plan consumption evidence exist or appear later, such as:

- started-at or other started markers,
- progress-save evidence,
- draft/player-side engagement evidence,
- completion-adjacent artifacts,
- future additive consumption traces.

The failure is not current breakage.
It is **insufficient evidence depth in a safety-critical reuse/regeneration decision**.

---

## Scope

### In scope

- harden safe-regeneration checks for session 1 active-plan/profile mismatch
- define a clearer concept of “meaningfully consumed” vs “safe to regenerate”
- use existing evidence sources where available
- add observability for why regeneration was blocked or allowed

### Out of scope

- no change to mismatch detection semantics themselves
- no onboarding UI changes
- no map/panel display changes
- no scoring or pain semantic changes
- no broader later-session regeneration redesign
- no destructive cleanup of already-started plans

---

## Locked truth

### Truth 1 — safety remains conservative

The system should continue to prefer reuse over risky regeneration when evidence is ambiguous.

### Truth 2 — logs-only is no longer enough as the conceptual model

`exercise_logs` may remain an important evidence source,
but it must no longer be the only meaningful signal considered by the safe-regeneration gate.

### Truth 3 — session 1 only

This PR remains strictly about session-1 profile mismatch regeneration hardening.
It must not sprawl into generic plan lifecycle redesign.

### Truth 4 — evidence hierarchy matters

The safe-regeneration gate should distinguish among at least:

- no evidence / untouched draft
- weak evidence / ambiguous engagement
- strong evidence / meaningful user consumption

Regeneration should only happen under the first category, or under another equally safe category explicitly defined in code.

### Truth 5 — observability must explain the decision

The system should be able to say whether reuse happened because of:

- no mismatch,
- snapshot absence,
- strong consumption evidence,
- ambiguous evidence,
- other explicit blocking reasons.

---

## Required behavior changes

### A. Expand consumption evidence inputs

The safe-regeneration guard should inspect more than `exercise_logs`, using whatever reliable existing fields are available in the active plan row / related progress state.

Expected evidence candidates include, where present in the current system:

- status beyond `draft`
- started markers / timestamps
- progress-save evidence
- completion-related evidence
- plan-consumption traces stored alongside the plan

The exact final set depends on what the repo actually stores today.

### B. Define a stricter helper for “safe to regenerate”

Move toward an explicit helper that answers something like:

- `isSafeSession1ProfileMismatchRegen(...)`

based on a broader evidence read, not logs-only.

### C. Preserve backward-compatible conservatism

If evidence is missing, partial, or ambiguous, prefer reuse.
Do not become more aggressive just because more signals were introduced.

### D. Improve decision observability

Expose clearer internal reason codes / meta such as:

- no_consumption_evidence
- progress_evidence_present
- started_marker_present
- ambiguous_consumption_evidence
- regen_blocked_due_to_consumption_evidence

Exact names may differ, but the semantic distinction should be clear.

---

## Files expected to change

Primary expected files:

- `src/app/api/session/create/_lib/progress-gate.ts`
- `src/app/api/session/create/_lib/types.ts`

Possible additive support files:

- `src/app/api/session/create/_lib/response-assembly.ts`
- any helper file that already reads active plan / progress consumption evidence

Possible read-only inspection files:

- `src/lib/session/client.ts`
- session progress / save-progress related routes if needed only for understanding evidence shape

---

## Implementation rules

### Rule 1 — conservative by default

When uncertain, reuse the active plan.
This is a hard safety rule.

### Rule 2 — no destructive overwrite of meaningful work

If there is credible evidence that the user already engaged with the plan, regeneration must not silently replace it.

### Rule 3 — evidence hardening, not policy expansion

Do not turn this into a generic plan-state machine redesign.
Stay focused on making the existing safety decision better grounded.

### Rule 4 — keep external API stable unless minimal additive detail is useful

Prefer internal logs/meta over broad response-contract expansion.
If additive response detail is included, keep it minimal and clearly scoped.

---

## Acceptance criteria

1. The safe-regeneration guard for session-1 mismatch uses more than logs-only as its conceptual evidence basis.
2. Ambiguous or strong consumption evidence blocks regeneration conservatively.
3. Truly untouched draft plans can still regenerate when mismatch exists.
4. Observability clearly distinguishes why regeneration was blocked or allowed.
5. No onboarding, scoring, map, or broader later-session semantics are changed.

---

## Regression risks

### Risk 1 — over-blocking regeneration

If the gate becomes too strict, legitimate profile-mismatch refresh may stop happening.

Mitigation:

- separate strong evidence from missing evidence,
- keep no-evidence draft path open.

### Risk 2 — reading evidence that is not actually authoritative

If a weak signal is treated as strong proof of consumption, reuse could become overly sticky.

Mitigation:

- prefer grounded existing fields,
- classify ambiguous evidence conservatively.

### Risk 3 — scope creep into generic lifecycle redesign

If too many states are introduced, the PR can become larger than intended.

Mitigation:

- focus only on the mismatch regeneration safety decision.

---

## Done means

This PR is done when the session-1 profile mismatch guard bases regeneration safety on a stronger, more explicit notion of user-consumption evidence than logs-only, while still remaining conservative and backward-compatible.
