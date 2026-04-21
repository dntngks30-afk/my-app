# P4 — Squat Regression Harness Hardening

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on: P1 successful shallow recovery on current head

**Current main note:** the two E1 shallow representatives (`shallow_92deg`, `ultra_low_rom_92deg`) are **`permanent_must_pass`** with executable proof — `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`. P4’s “retire conditional tolerance” rule still governs any **other** conditional surfaces until explicitly converted.

P4 exists to remove temporary conditional tolerance once P1 has restored legitimate shallow fixtures.

## One-line purpose

Convert the current conditional shallow proof posture into hard executable regression locks so the same authority split and shallow regressions cannot silently return.

## Locked truth

1. P4 is not an algorithm PR.
It does not rescue shallow motion and does not rewire authority.
It only hardens executable proof.

2. Conditional skip is temporary.
Markers such as `conditional_until_main_passes`, `shallow fixture not passing on this main`, and `ultra-low-ROM fixture not passing on this main` described **older** tolerance for conditional representative skips. **Current main:** the PR-F proof gate recognizes **only** `no PR-D broadening` as an explained `SKIP` marker (`scripts/camera-pr-f-regression-proof-gate.mjs`), and the two E1 shallow representatives are **`permanent_must_pass`** — `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.
After P1, conditional posture for recovered fixtures must be retired or converted to hard assertions.

3. Harness must assert cross-layer illegal states directly.
Not just pass/fail snapshots, but the precise illegal authority combinations must be locked.

## Scope

In scope:
- proof gate hardening
- smoke and fixture tightening
- conversion of accepted conditional skip paths into hard assertions after P1 success
- direct lock of cross-layer illegal states

Expected file focus:
- `scripts/camera-pr-f-regression-proof-gate.mjs`
- focused squat smokes and fixtures only
- optional narrow docs updates if needed

Out of scope:
- no authority-law changes
- no shallow evidence rescue logic
- no semantics rewiring
- no veto registry redesign
- no UI or route work

## Required design rules

Rule 1 — No unexplained tolerance.
After P1, conditional markers for the recovered fixtures must not remain accepted silently.

Rule 2 — Illegal states must be asserted directly.
At minimum, assert:
- completion-owner false with final pass true
- completion truth false with final pass true
- final-pass success serialized as failure
- absurd-pass family surviving to final surface
- assist-only shallow signals reopening pass without canonical completion-owner truth

Rule 3 — Positive paths must stay green.
Good shallow and good standard or deep reps must remain executable green proofs.

## Acceptance criteria

1. Previously conditional shallow and ultra-low-ROM fixtures are now hard green assertions.
2. Bare or stale conditional skip markers are no longer accepted for those fixtures.
3. The proof gate fails on reintroduced illegal authority states.
4. The harness distinguishes real regressions from documented non-goals without hiding failures.

## One-line lock

P4 turns the post-P1 squat proof bundle into a hard executable regression wall that no longer relies on temporary conditional shallow skips.
