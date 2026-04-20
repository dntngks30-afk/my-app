# P1 — Squat Legitimate Shallow Evidence Recovery

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on: `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`

P1 exists after PR-01.

PR-01 correctly blocked absurd pass reopeners, but it left one accepted residual risk:
- some legitimate shallow and ultra-low-ROM fixtures still do not reach canonical completion-owner truth on current main.

P1 is the recovery PR for that residual risk.

## One-line purpose

Recover legitimate shallow and ultra-low-ROM evidence so canonical completion-owner truth can pass real low-ROM reps again, without changing completion-first authority or reopening absurd pass.

## Locked truth

1. Authority remains frozen.
- completion-owner is still the only opener
- pass-core remains non-opener assist, veto, and trace
- final-pass surface remains completion-first

2. Recovery means evidence formation, not opener reopening.
A shallow legitimate rep must recover because completion-owner truth becomes satisfied through better same-rep shallow evidence formation.
It must not recover because pass-core or assist layers directly reopen final pass.

3. Absurd-pass classes remain blocked.
Standing, seated, setup-contaminated, stale, mixed-rep, and contaminated early-peak classes must remain blocked.

## Scope

In scope:
- shallow, low-ROM, and ultra-low-ROM evidence formation that feeds canonical completion-owner truth
- same-rep shallow evidence continuity
- narrow upstream completion evidence fixes needed to satisfy legitimate shallow fixtures
- narrow smoke updates proving legitimate shallow recovery without absurd-pass reopeners

Expected file focus:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- optional narrow squat helpers directly supporting completion evidence
- focused shallow regression smokes only

Out of scope:
- no authority-law rewiring
- no final-pass surface redesign
- no semantics consumer rewrite
- no broad pass-core philosophy reversal
- no pose-feature system redesign
- no cross-movement work
- no UI or route changes

## Required design rules

Rule 1 — Completion-owner must stay canonical.
Every recovered shallow success must still satisfy the completion-owner chain.

Rule 2 — Recovery must be same-rep truthful.
Do not recover shallow success by mixing prior peak, later reversal, and later recovery across rep boundaries.

Rule 3 — Recovery must be evidence-based.
Allowed directions include better shallow reversal or recovery continuity capture, better low-ROM standing finalize truth when the same rep truly closes, and better same-rep shallow ticket or closure proof formation when already product-legitimate.
Forbidden directions include direct final-pass reopen shortcuts, assist-only promotion to success, and weakening absurd-pass blockers.

Rule 4 — Conditional markers must be retired only by real recovery.
The target is to remove conditional skip dependence by making the legitimate shallow fixtures truly pass on current head.

## Acceptance criteria

1. The currently conditional legitimate shallow and ultra-low-ROM fixtures pass cleanly on current head.
2. No PR-01 illegal authority state is reintroduced.
3. No absurd-pass family regresses open.
4. Recovered shallow success is explainable through completion-owner truth, not split-brain shortcut behavior.
5. The proof gate no longer needs temporary conditional markers for the recovered fixtures.

## Residual risk policy

If a shallow fixture still fails after best-effort evidence recovery, do not broaden into authority rollback. Document the exact upstream evidence gap instead of reopening pass shortcuts.

## One-line lock

P1 restores legitimate shallow success by improving canonical shallow evidence formation, never by weakening the completion-first authority law.
