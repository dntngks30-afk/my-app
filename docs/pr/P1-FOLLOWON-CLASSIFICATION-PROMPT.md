# Prompt — P1 Follow-on Classification Session

Use GPT-5.4 or an equivalently strong reasoning model.

This session is **classification-only**.
It is **not** an implementation session.
It is **not** a recovery session.
It is **not** a P4/P3/P2 session.

You must determine which branch is the correct next move after the failed P1 recovery attempt:

- **Branch A — fixture calibration problem**
- **Branch B — product needs a new authority-safe descent source**

You must not blur these together.
You must choose one primary branch, or explicitly prove that current evidence is still insufficient to choose.

---

## Required reading order

Read these first and treat them as binding context:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/P1-DIAGNOSIS-SHALLOW-FIXTURES.md`
6. `docs/pr/P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md`

Then inspect the real current repo only as needed for diagnosis.

---

## Mission

Produce a **read-only decision document** that answers one narrow question:

**Why did P1 fail, and what is the correct next design branch: fixture calibration or a new authority-safe descent source?**

The output of this session must be a single docs file only.

Recommended output path:
- `docs/pr/P1-FOLLOWON-CLASSIFICATION-DECISION.md`

If that path already exists, replace it only if you are improving it deliberately and explicitly.

---

## Absolute scope lock

This session must not modify runtime behavior.

### Forbidden
- no `src/*` changes
- no `scripts/*` changes
- no threshold changes
- no mock changes
- no fixture value changes
- no authority-law changes
- no proof gate changes
- no blocker changes
- no naming cleanup
- no P4/P3/P2 work
- no commits other than the single decision doc if your environment writes directly

### Allowed
- reading repo files
- comparing diagnosis documents
- tracing where the failed assumptions came from
- writing one decision doc in `docs/pr/*`

If you find yourself wanting to patch code, stop. That is out of scope.

---

## Non-negotiable product law

You must preserve these truths while reasoning:

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow assist / bridge / closure proof / event-cycle are not openers
3. absurd-pass registry is block-only
4. threshold relaxation is forbidden in this classification session
5. quality truth is separate from pass truth

Any next-step recommendation that violates those laws is invalid.

---

## What must be classified

You must decide whether the failed P1 recovery is primarily caused by one of these:

### Branch A — Fixture calibration problem
Meaning:
- the synthetic shallow fixture shape is not representative of real shallow motion as consumed by the current authority-safe signal pipeline
- the mock produces an unrealistically flat early descent gradient
- the engine may be behaving correctly against the signal it actually receives
- the right next step is fixture/mock calibration, not product descent-source expansion

### Branch B — New authority-safe descent source needed
Meaning:
- even realistic shallow motion, when consumed by the current pipeline, does not provide an authority-safe early descent signal soon enough
- the current descent evidence family is structurally insufficient for legitimate shallow reps
- the right next step is a new descent-source design PR with full absurd-pass proof and split-brain guards

### Optional Branch C — Evidence still insufficient
Allowed only if you can clearly prove why Branch A vs B cannot yet be distinguished.
This is a last resort, not a default escape hatch.

---

## Required reasoning method

You must ground the decision in the actual diagnosis evidence.
At minimum, analyze all of the following:

1. Why Lever A failed even at the spec-approved lower edge
2. Why Lever B succeeded only on the anti-ordering gap but did not recover cycle duration
3. Whether the failed fixture’s early shallow descent is realistic relative to the current signal family
4. Whether the current signal family could, in principle, detect legitimate shallow descent without threshold relaxation
5. Whether the observed blocker is fundamentally about fixture shape or about source-family insufficiency

Do not hand-wave with “maybe both.”
You must rank the branches.

---

## Required decision standard

Choose **Branch A** only if the evidence strongly indicates that the fixture shape is the abnormal element and the product pipeline is not yet proven insufficient on realistic shallow motion.

Choose **Branch B** only if the evidence strongly indicates that even realistic shallow motion would remain structurally invisible or too-late under the current authority-safe source family.

Choose **Branch C** only if you can name the exact missing evidence needed to distinguish A vs B and why the current record cannot support either branch.

---

## Required output structure

Your decision doc must contain these sections exactly or very close to them:

1. **Scope and stop condition recap**
2. **What P1 proved**
3. **What P1 did not prove**
4. **Branch A case**
5. **Branch B case**
6. **Primary classification decision**
7. **Why the rejected branch is not the next move**
8. **Exact next session recommendation**
9. **Hard prohibitions for the next session**

---

## Exact next-session recommendation requirements

If you choose Branch A:
- recommend a fixture calibration design session only
- do not recommend product-code implementation yet
- define what must be compared between real shallow motion and synthetic fixture motion
- state that P4/P3/P2 remain blocked until this classification branch is resolved

If you choose Branch B:
- recommend a new descent-source design session only
- explicitly require a new SSOT and absurd-pass proof bundle
- state that this is not a small P1 patch continuation
- state that P4/P3/P2 remain blocked until this branch is resolved

If you choose Branch C:
- define the exact evidence collection session needed next
- forbid P4/P3/P2 and forbid code changes until that evidence is collected

---

## Hard prohibitions for the next session section

Your doc must explicitly prohibit the following for the next step unless separately re-authorized:
- threshold relaxation
- pass-core opener revival
- authority shortcut reopening
- fixture-side cheat that merely hides the failure class
- advancing to P4/P3/P2 before the classification branch is resolved

---

## Final lock

This is a docs-only classification session. Decide whether the failed P1 path points next to fixture calibration or to a new authority-safe descent source, and produce one decision doc that blocks all unrelated follow-up work until that decision is made.