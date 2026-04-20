# PLAN MODE Prompt — Sequential Implementation of P1 -> P4 -> P3 -> P2

Use GPT-5.4 or an equivalently strong reasoning model in PLAN mode.

You are not doing one giant mixed rewrite.
You are doing one session of **sequential implementation** under strict scope control.

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/P4-SQUAT-REGRESSION-HARNESS-HARDENING.md`
6. `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
7. `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`

Then inspect the real current repo paths that those docs imply before editing.

---

## Mission

Implement, in one PLAN-mode run, the following sequence:

**P1 -> P4 -> P3 -> P2**

Meaning:

- P1 first: recover legitimate shallow evidence without touching completion-first authority
- P4 second: harden the regression harness only after P1 truly recovers the fixtures
- P3 third: normalize absurd-pass blockers into an explicit block-only registry
- P2 last: clean up naming and comments to match the landed truth

You must preserve the already-landed completion-first authority freeze.

---

## Non-negotiable product law

For squat only:

- completion-owner truth is the only opener of final pass
- pass-core, shallow assist, closure proof, bridge, and event-cycle are not openers
- absurd-pass registry is block-only
- quality interpretation remains separate from pass/fail truth

At no point in this run may you reopen pass-core-first authority.

---

## Working mode rules

### Rule 1 — Sequential phases only

Treat P1, P4, P3, and P2 as four separate implementation phases in one run.
Do not blend them into one undifferentiated patch.

### Rule 2 — Each phase must have its own checkpoint

After each phase, validate the intended effect before moving to the next phase.
If a phase precondition fails, do not compensate by broadening a later phase.

### Rule 3 — Minimal diff per phase

Prefer narrow targeted edits over broad cleanup.
Do not redesign the stack while in PLAN mode.

### Rule 4 — No hidden scope drift

If a file change belongs to a later phase, do not pull it forward unless strictly required.
If strictly required, document why.

---

## Phase breakdown

# Phase P1 — Legitimate Shallow Evidence Recovery

Goal:
Recover currently conditional legitimate shallow and ultra-low-ROM fixtures by improving canonical shallow evidence formation.

Allowed scope:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- narrow squat helpers directly supporting completion evidence
- focused shallow regression smokes

Forbidden scope in P1:
- no authority-law rewiring
- no final-pass surface redesign
- no semantics consumer rewrites
- no block-only registry normalization yet
- no broad pass-core philosophy reversal

Success condition for P1:
- previously conditional legitimate shallow or ultra-low-ROM fixtures pass cleanly on current head
- no PR-01 illegal state is reintroduced
- no absurd-pass family regresses open

Hard rule:
If a shallow fixture still fails after best-effort P1 work, do not reopen pass shortcuts.

Checkpoint after P1:
- run the relevant shallow and ultra-low-ROM smokes
- verify no `completion false / final pass true` recurrence
- verify recovered passes are explainable through completion-owner truth

# Phase P4 — Regression Harness Hardening

Precondition:
Proceed only if P1 actually restores the currently conditional fixtures on this head.

If P1 does not restore them, do not force P4 by weakening the harness.
Instead stop and report that P4 is blocked by unresolved P1 residuals.

Goal:
Convert temporary conditional proof posture into hard executable regression locks.

Allowed scope:
- `scripts/camera-pr-f-regression-proof-gate.mjs`
- focused squat smokes and fixture assertions

Forbidden scope in P4:
- no algorithm rescue logic
- no authority rewiring
- no semantics changes
- no blocker registry redesign

Success condition for P4:
- previously conditional shallow and ultra-low-ROM fixtures are hard green assertions
- stale conditional markers for those fixtures are no longer accepted
- the proof gate hard-fails on reintroduced illegal authority states

Checkpoint after P4:
- run proof gate
- verify the formerly conditional fixtures are no longer passing only via accepted conditional SKIP

# Phase P3 — Absurd-Pass Registry Normalization

Goal:
Normalize scattered late squat blockers into one explicit block-only registry surface.

Allowed scope:
- `src/lib/camera/auto-progression.ts`
- optional helper like `src/lib/camera/squat/squat-absurd-pass-registry.ts`
- focused blocker smokes only

Forbidden scope in P3:
- no opener rewiring
- no shallow evidence rescue logic
- no semantics consumer changes
- no broad threshold tuning

Success condition for P3:
- known absurd-pass classes are represented explicitly in a normalized registry path
- registry remains block-only
- blocked reasons stay truthful and class-specific
- current absurd-pass protections remain green

Checkpoint after P3:
- run absurd-pass blocker smokes
- verify no registry path grants pass

# Phase P2 — Authority Naming and Comment Cleanup

Goal:
Make the repo describe the landed completion-first model truthfully and consistently.

Allowed scope:
- comments
- helper or type naming where behavior does not change
- deprecated or compat wording clarification
- narrow docs updates required to prevent confusion

Forbidden scope in P2:
- no logic changes
- no threshold changes
- no harness logic changes beyond naming or comment alignment
- no semantics source changes

Success condition for P2:
- comments and major helper descriptions no longer imply pass-core-first opener logic
- legacy compat fields are clearly marked as non-canonical where relevant
- runtime behavior is unchanged

Checkpoint after P2:
- re-run the critical squat proof bundle to verify no behavior changed

---

## Critical global invariants

These must remain true throughout the entire run:

1. completion-owner remains the only opener of final pass
2. `completionTruthPassed === false` and `finalPassEligible === true` never reappears
3. pass-core never becomes a direct opener again
4. absurd-pass registry never becomes a grant path
5. quality interpretation remains separate from pass/fail truth

---

## Stop conditions

Stop the run and report clearly if any of these occur:

1. P1 cannot recover the conditional shallow fixtures without violating authority law
2. P4 would require keeping or broadening conditional SKIP markers instead of retiring them
3. P3 requires opener rewiring to succeed
4. P2 would require behavior change rather than comment or naming cleanup

Do not hide a failed earlier phase by widening a later phase.

---

## Required final output

At the end of the run, provide:

1. Phase-by-phase summary of what changed
2. Exact files changed in each phase
3. Validation run after each phase
4. Which conditional markers were retired, if any
5. Whether P4 was fully completed or blocked by unresolved P1 residuals
6. Residual risks left after the full sequence

---

## One-line lock

Implement P1, then P4, then P3, then P2 in one PLAN-mode session, but keep the phases isolated, never reopen completion-first authority, and never let a later phase compensate for a failed earlier phase.
