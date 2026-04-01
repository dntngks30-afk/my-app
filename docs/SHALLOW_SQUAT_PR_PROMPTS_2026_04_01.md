# MOVE RE — SHALLOW SQUAT RECOVERY PR PROMPTS

These prompts are aligned to `SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`.
Use them in order.

---

## PR-1 — SHALLOW TRUTH OBSERVABILITY ALIGNMENT

Implement **PR-1 only** from the shallow squat SSOT.

### Goal
Add observability and invariant trace fields for shallow squat truth alignment.
Do **not** change pass thresholds, policy, finalize rules, or event promotion behavior.

### Allowed files only
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/auto-progression.ts`
- `docs/pr/PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01.md`

### Forbidden
- No threshold changes
- No ultra-low policy changes
- No standing finalize logic changes
- No event-cycle promotion changes
- No non-listed file edits

### Required changes
1. Add explicit trace/debug fields distinguishing:
   - top-level observation reversal truth
   - authoritative completion reversal truth
   - provenance-only reversal evidence
2. Add mismatch observability for:
   - top-level reversal vs completion reversal
   - top-level recovery vs completion recovery
   - shallow admission vs shallow closure
3. Surface one deterministic stage label for shallow attempts:
   - admission stage
   - reversal stage
   - policy stage
   - standing finalize stage
   - closed

### Acceptance
- Existing pass/fail behavior should remain unchanged
- Contradictory shallow truth states become explicit in debug output
- No new squat pass introduced

---

## PR-2 — SHALLOW CONTRACT AUTHORITY SEPARATION

Implement **PR-2 only** from the shallow squat SSOT.

### Goal
Narrow and isolate the shallow contract in completion flow without changing ultra-low policy yet.

### Allowed files only
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-reversal-confirmation.ts`
- `docs/pr/PR-SHALLOW-CONTRACT-AUTHORITY-02.md`

### Forbidden
- No ultra-low policy change
- No event-cycle promotion relaxation
- No auto-progression final gate change
- No arming algorithm rewrite
- No non-listed file edits

### Required changes
1. Make shallow contract checkpoints explicit in code structure:
   - shallow admission
   - shallow reversal satisfaction
   - shallow closure proof
   - shallow policy blocker
   - shallow standing finalize blocker
2. Ensure a shallow admitted attempt cannot drift across multiple unrelated blocker families without an explicit stage label.
3. Keep behavior narrow; do not broaden to deep/standard flow.

### Acceptance
For a shallow admitted attempt, debug/trace must resolve to exactly one stage outcome:
- blocked at reversal stage
- blocked at policy stage
- blocked at standing finalize stage
- shallow closed

---

## PR-3 — ULTRA-LOW-ROM POLICY LOCK

Implement **PR-3 only** from the shallow squat SSOT.

### Goal
Freeze ultra-low ROM as non-passable for now, but fail it deterministically as policy-blocked.

### Allowed files only
- `src/lib/camera/squat-completion-state.ts`
- `docs/pr/PR-ULTRA-LOW-ROM-POLICY-LOCK-03.md`

### Forbidden
- No low-ROM finalize tuning
- No event-cycle promotion tuning
- No auto-progression changes
- No non-listed file edits

### Required changes
1. Add or refine a dedicated policy-stage outcome for ultra-low ROM.
2. Prevent ultra-low attempts from oscillating among `no_reversal`, `ultra_low_rom_not_allowed`, and finalize blockers when policy is the real terminal reason.
3. Keep ultra-low visible in observability, but explicitly non-passable.

### Acceptance
- Ultra-low failures terminate as policy-blocked when appropriate
- No ultra-low pass introduced
- No low-ROM behavior change intended in this PR

---

## PR-4 — LOW-ROM STANDING FINALIZE REWORK

Implement **PR-4 only** from the shallow squat SSOT.

### Goal
Let meaningful shallow/low-ROM attempts close through low-ROM finalize without reopening false positives.

### Allowed files only
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/pose-features.ts` only if strictly necessary for finalize-evidence alignment
- `docs/pr/PR-LOW-ROM-STANDING-FINALIZE-REWORK-04.md`

### Forbidden
- No ultra-low policy change
- No event-cycle ownership change
- No global confidence/latch changes
- No non-listed file edits

### Required changes
1. Make low-ROM standing finalize explicitly separate from standard standing finalize.
2. Reuse existing signals as much as possible:
   - recovery return continuity
   - recovery drop ratio
   - existing timing relations
3. Do not allow standing sway / seated hold / single spike to pass.

### Acceptance
A shallow/low-ROM attempt should be able to close only when:
- descend is real
- reversal is real
- recovery toward standing is real
- low-ROM finalize proof is satisfied

Negative FP cases must still fail.

---

## PR-5 — SHALLOW CLOSURE DECOUPLE FROM EVENT PROMOTION

Implement **PR-5 only** from the shallow squat SSOT.

### Goal
Reduce shallow closure dependence on event-cycle promotion.

### Allowed files only
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-event-cycle.ts`
- `docs/pr/PR-SHALLOW-CLOSURE-DECOUPLE-EVENT-05.md`

### Forbidden
- No ultra-low policy change
- No low-ROM standing finalize tuning
- No global confidence/latch changes
- No non-listed file edits

### Required changes
1. Make explicit whether shallow closure needs event promotion.
2. If shallow closure proof is already satisfied, do not let event-promotion weakness remain the sole blocker.
3. Keep event-cycle diagnostic/supportive unless explicitly needed.

### Acceptance
For shallow admitted, non-ultra-low attempts:
- event-cycle weakness alone must not override already-satisfied shallow closure proof
- no new standing/seated/jitter pass may appear

---

## PR-6 — REGRESSION MATRIX LOCK

Implement **PR-6 only** from the shallow squat SSOT.

### Goal
Freeze the shallow bottleneck families in fixtures and regression checks.

### Allowed files only
- squat-related test/smoke/fixture files only
- `docs/pr/PR-SHALLOW-REGRESSION-MATRIX-06.md`

### Forbidden
- No logic tuning outside test/fixture scope
- No non-listed file edits

### Required fixture families
1. shallow observed but `not_armed`
2. shallow admitted, reversal evidence present, ultra-low policy blocked
3. low-ROM/shallow standard, reversal present, `not_standing_recovered`
4. low-ROM/shallow standard, reversal + recovery present, `low_rom_standing_finalize_not_satisfied`
5. negative FP: standing / seated hold / jitter must not pass

### Required assertions
- no contradictory reversal/recovery truth fields
- no silent blocker-family drift
- no pass for negative FP fixtures
- expected blocker family remains stable per fixture

### Acceptance
- Regression pack exists and runs for all five families
- Future PRs can be evaluated against these locked families

