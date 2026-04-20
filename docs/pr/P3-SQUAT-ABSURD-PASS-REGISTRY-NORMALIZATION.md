# P3 — Squat Absurd-Pass Registry Normalization

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on: PR-01 authority freeze already landed

P3 exists because the repo currently blocks several absurd-pass families, but the blocker logic is still scattered and philosophically under-specified.

## One-line purpose

Normalize the scattered late squat blockers into one explicit absurd-pass registry that can only block, never grant, while preserving completion-first authority.

## Locked truth

1. Registry is block-only.
It may close final pass for explicit absurd-pass families, but it may never open pass.

2. Registry does not replace the opener.
Completion-owner truth is still the only opener.
The registry is a late safety wall, not a second owner.

3. Registry entries must be explicit and class-specific.
Do not hide multiple absurd-pass families behind one vague generic blocker when a more truthful class-specific reason is available.

## Initial registry inventory

At minimum, normalize these families:
- standing still
- seated hold or still seated at pass
- setup-motion contaminated cycle
- stale prior rep reused as current rep
- mixed-rep timestamp contamination
- contaminated blended early peak false pass
- no real descent
- no real reversal or ascent-equivalent
- no real recovery after reversal

## Scope

In scope:
- extraction or normalization of squat absurd-pass blocker policy
- explicit registry shape or helper surface
- truthful blocked reason preservation
- narrow smokes proving registry behavior remains block-only

Expected file focus:
- `src/lib/camera/auto-progression.ts`
- optional helper such as `src/lib/camera/squat/squat-absurd-pass-registry.ts`
- focused squat blocker smokes only

Out of scope:
- no opener rewiring
- no shallow evidence rescue logic
- no semantics consumer changes
- no broad threshold tuning
- no non-squat work

## Required design rules

Rule 1 — Registry must be explicit.
The absurd-pass classes should be readable and auditable as one normalized policy surface.

Rule 2 — Registry must stay block-only.
No registry entry may grant pass or act like an alternate owner.

Rule 3 — Registry must preserve truthful reasons.
If a specific absurd-pass class is known, the blocked reason should keep that specificity.

Rule 4 — Registry must not broaden into authority rollback.
Normalization is allowed. Reopening pass shortcuts is not.

## Acceptance criteria

1. The known absurd-pass families are represented explicitly in the normalized registry path.
2. The registry acts only as a closer, never as an opener.
3. Current absurd-pass protections remain green after normalization.
4. The code is easier to audit than the pre-normalized scattered blocker state.

## One-line lock

P3 normalizes squat absurd-pass blocking into one explicit block-only registry while preserving completion-first authority and truthful blocker reasons.
