# Prompt — P1 Calibration Study / Fixture Representativeness Session

Use GPT-5.4 or an equivalently strong reasoning model.

This session is **read-only calibration study only**.
It is **not** an implementation session.
It is **not** a recovery session.
It is **not** a P4/P3/P2 session.

The goal is to empirically resolve the Branch A decision by comparing real shallow recordings against the current synthetic fixture under the current engine, with zero runtime code changes.

---

## Required reading order

Read these files first and treat them as binding:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/P1-DIAGNOSIS-SHALLOW-FIXTURES.md`
6. `docs/pr/P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md`
7. `docs/pr/P1-FOLLOWON-CLASSIFICATION-DECISION.md`

Then inspect the current repo only as needed for read-only measurement.

---

## Mission

Produce one comparison decision document that answers this narrow question:

**Does the current synthetic shallow fixture materially misrepresent real shallow motion as consumed by the current engine?**

Recommended output path:
- `docs/pr/P1-CALIBRATION-STUDY-RESULT.md`

Only one docs file should remain as the session artifact.
Any temporary capture scripts must be deleted before the session ends.

---

## Absolute scope lock

### Forbidden
- no `src/*` changes
- no committed `scripts/*` changes
- no threshold changes
- no engine changes
- no authority changes
- no proof gate changes
- no blocker changes
- no fixture value changes in this session
- no P4/P3/P2 work
- no runtime commits other than the single docs artifact if your environment writes directly

### Allowed
- read-only measurement
- temporary ad-hoc local capture scripts that are deleted before finish
- extraction of real shallow recording telemetry or archived traces
- one final docs report in `docs/pr/*`

If you want to patch runtime code, stop. That is out of scope.

---

## Non-negotiable product law

Preserve these truths while studying:

1. completion-owner truth is the only opener of final pass
2. pass-core / assist / bridge / closure proof / event-cycle are not openers
3. absurd-pass registry is block-only
4. threshold relaxation is forbidden
5. quality truth is separate from pass truth

This study must not recommend any next step that violates those laws.

---

## Required data collection

You must compare at least:
- the synthetic `shallow_92deg` fixture
- the synthetic `ultra_low_rom_92deg` fixture
- at least 2 real shallow recordings with approximately 92° peak depth

If 2 valid real recordings are unavailable, stop and produce a data-collection blocker report instead of guessing.

---

## Required comparison table

For each real recording and each synthetic fixture, collect the same fields in one normalized table:

- `kneeAngleAvg` trajectory
- `squatDepthProxy` trajectory
- `squatDepthProxyBlended` trajectory
- first `phaseHint === 'descent'` timestamp
- `sharedDescentTruth.descentStartAtMs`
- first frame meeting `relDepth >= 0.003` (k=0.15 floor)
- `effectiveDescentStartFrame.timestampMs`
- `peakAtMs`
- `reversalAtMs`
- `standingRecoveredAtMs`
- `cycleDurationMs`
- `canonicalShallowContractBlockedReason`
- final `gate.status`
- final `finalPassBlockedReason`

You must compare them using the current engine exactly as-is.
No parameter changes allowed.

---

## Required decision rule

### Confirm Branch A only if:
At least one real shallow recording shows that the current engine forms earlier legitimate descent evidence than the synthetic fixture in the critical early window, such that the synthetic fixture is clearly the abnormal element.

### Falsify Branch A and escalate to Branch B only if:
Real shallow recordings also fail under the current engine with materially the same timing shape and blocker profile, showing that the current source family is insufficient even on realistic input.

### Do not use “maybe both” as the default answer.
You must either confirm Branch A, falsify Branch A, or stop because real recordings were unavailable or unusable.

---

## Required output structure

Your final docs report must contain:

1. Scope and data sources
2. Real recording selection criteria
3. Synthetic fixture measurement recap
4. Real vs synthetic comparison table
5. Earliest descent evidence comparison
6. Contract blocker comparison
7. Branch A confirmation or falsification
8. Exact next session recommendation
9. Hard prohibitions for the next session

---

## Exact next-step recommendation rules

If Branch A is confirmed:
- recommend a **fixture re-derivation design session only**
- do not recommend product-code implementation yet
- state that the next work is to rebuild the shallow synthetic fixture from realistic real-recording geometry or trace-derived landmarks
- keep P4/P3/P2 blocked until that fixture re-derivation branch is completed and revalidated

If Branch A is falsified:
- recommend a **new authority-safe descent source design session only**
- explicitly require a new SSOT and absurd-pass proof bundle
- state that this is not a small P1 patch continuation
- keep P4/P3/P2 blocked until that new design branch is resolved

If recordings are unavailable or inconclusive:
- produce a data-collection blocker report only
- forbid P4/P3/P2 and forbid code changes until valid recordings are obtained

---

## Hard prohibitions for the next session section

Your report must explicitly prohibit the following unless separately re-authorized:
- threshold relaxation
- pass-core opener revival
- authority shortcut reopening
- fake phaseHint injection into fixtures
- unrealistic landmark manipulation that only hides the failure class
- advancing to P4/P3/P2 before the calibration branch is empirically resolved
- expanding PR-F ALLOWED_SKIP_MARKERS as a substitute for recovery

---

## Final lock

This is a read-only fixture representativeness study. Compare real shallow recordings to the current synthetic fixtures under the unchanged engine, then decide whether Branch A is confirmed or falsified, and block all unrelated follow-up work until that empirical decision is made.