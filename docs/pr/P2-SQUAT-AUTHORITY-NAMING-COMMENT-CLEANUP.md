# P2 — Squat Authority Naming and Comment Cleanup

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on: PR-01 and any direct follow-up authority work already landed

P2 is deliberately last.
It exists to remove naming and comment drift after the functional authority and regression work is complete.

## One-line purpose

Align squat comments, helper names, and trace-facing wording with the completion-first authority model so future work cannot accidentally read outdated pass-core-first philosophy from stale names or docs.

## Locked truth

1. P2 is cleanup-only.
No behavior change is allowed.
No threshold change is allowed.
No opener, blocker, or semantics logic change is allowed.

2. Naming must reflect current truth.
If code comments, helper descriptions, or trace labels still imply that pass-core is the final opener, they must be corrected to the current completion-first model.

3. Legacy fields may remain, but their status must be explicit.
Deprecated or compat fields may stay if needed, but comments must state that they are sink-only, legacy, or not canonical authority.

## Scope

In scope:
- comment cleanup
- helper or type naming cleanup where behavior is unchanged
- deprecated or compat wording clarification
- trace-surface wording normalization where behavior is unchanged
- narrow docs updates required to prevent future confusion

Expected file focus:
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/evaluators/squat.ts`
- narrow squat helper files with outdated authority comments
- docs directly describing squat authority if clearly stale

Out of scope:
- no logic changes
- no threshold changes
- no harness changes beyond name or comment alignment
- no semantics source changes
- no UI or route work

## Required design rules

Rule 1 — Behavior-preserving only.
If a rename would cause non-trivial runtime or test churn, prefer comment clarification over risky code movement.

Rule 2 — Canonical wording must be explicit.
Comments should clearly distinguish:
- canonical opener truth
- block-only registry truth
- quality interpretation truth
- sink-only or legacy compatibility fields

Rule 3 — Do not hide history.
It is acceptable to note that some fields or names are legacy. Do not rewrite history in a way that makes debugging harder.

## Acceptance criteria

1. No comment or helper wording materially contradicts the completion-first authority model.
2. Legacy compat fields are clearly described as non-canonical where relevant.
3. The cleanup does not change runtime behavior.
4. Future implementers can read the file headers and major helper comments without being misled about who opens final pass.

## One-line lock

P2 is a behavior-preserving naming and comment cleanup pass that makes the repo describe the current completion-first squat authority model truthfully and consistently.
