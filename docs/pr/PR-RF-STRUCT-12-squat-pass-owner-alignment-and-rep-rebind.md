# PR-RF-STRUCT-12 — Squat Pass-Owner Alignment and Rep Rebind

> This PR follows the current squat camera refactor stream, but unlike the earlier boundary-only PRs, this one is a **targeted correctness fix**.
> The goal is not threshold tuning. The goal is to remove a structural contradiction where the runtime success path can still be blocked by stale or mismatched completion truth even after the current squat rep has already produced legitimate pass evidence.

---

## 1. Core diagnosis

The remaining shallow-squat failure is not a single bug.
It is a split-truth failure with two active chains:

1. **Early ultra-shallow chain**
   - descent-like motion is observed,
   - but the rep's peak ownership never becomes trustworthy,
   - so the rep dies as an early peak-anchor failure.

2. **Late legitimate-rep chain**
   - a later/current rep reaches legitimate pass conditions,
   - but downstream completion/UI still reads a stale or different rep,
   - so final pass stays blocked by a hidden veto.

This means the system currently has both:
- **"did not see the rep correctly"**, and
- **"saw it, but still refused to pass it"**

at the same time.

The true P0 problem is therefore **rep identity / timebase split**, not depth threshold selection.

---

## 2. Problem statement

Current runtime squat pass flow is structurally inconsistent.

- The squat pass path claims a pass-owner/current-rep truth exists upstream.
- But downstream final gate/success opening still depends on `completionSatisfied` as the first hard condition.
- The current auto-progression path shows this directly: squat uses `getSquatProgressionCompletionSatisfied(...)`, then `progressionPassed` and `finalPassBlockedReason` are computed from `completionSatisfied` first, so a stale completion false still blocks pass even if other rep evidence is already present.
- The same file also shows `getSquatProgressionCompletionSatisfied(...)` reconstructing debug timing (`peakAtMs`, `reversalAtMs`, `ascendStartAtMs`, `standingRecoveredAtMs`) by reading `result.debug?.squatCompletionState`, which means stale timestamp carryover there contaminates the downstream gate.

Therefore the system still lets **completion truth behave like the effective owner of final squat pass**, even though the current rep's pass-owner signal may already be valid.

---

## 3. Truth to lock in this PR

### 3.1 Owner law

For squat final progression:

- **current-rep squat pass owner truth** must be singular and readable through one adapter.
- downstream layers may **decorate, log, explain, or downgrade confidence**,
  but they must not silently reinterpret a different rep as the final gating rep.

### 3.2 Rep identity law

For any given sampled frame window, these timestamps must belong to the **same rep identity**:

- `descendStartAtMs`
- `peakAtMs`
- `committedAtMs`
- `reversalAtMs`
- `ascendStartAtMs`
- `standingRecoveredAtMs`

A downstream layer must never combine:
- prior rep peak,
- current rep reversal,
- later rep recovery

into one synthetic success/failure decision.

### 3.3 UI gate law

For squat only:

- the final pass/success gate must open from **current-rep owner truth**,
- not from a stale completion snapshot that belongs to an earlier rep.

Completion remains important, but only if it is **bound to the same rep identity** as the pass owner truth being consumed.

### 3.4 Reset/rebind law

At rep rollover, invalidation, or rep boundary re-entry:

- stale peak / reversal / recovery timestamps must be **hard-reset or explicitly rebound**,
- so downstream readers cannot accidentally inherit a prior rep's peak anchor.

---

## 4. Scope

This PR does exactly two things.

### A. Align final squat gate to current-rep owner truth

Introduce or consolidate a single typed adapter that exposes the **current squat rep pass-owner truth** for downstream use.

This adapter must include, at minimum:
- whether a current rep is legitimately pass-eligible,
- the rep identity / rep window it belongs to,
- the rep-bound timestamps,
- the authoritative blocked reason when not eligible.

Then make the squat final gate path read that adapter instead of implicitly trusting a separately reconstructed completion snapshot as higher truth.

### B. Hard reset / rebind stale completion timestamps at rep boundary

In the squat completion / pass-owner handshake, prevent stale carryover of:
- peak timestamps,
- reversal timestamps,
- committed timestamps,
- recovery timestamps,
- any related rep-bound anchors.

A new rep must either:
- inherit all timing fields from the same current rep, or
- clear them before recomputing.

Mixed-rep timing is forbidden.

---

## 5. Non-goals

This PR must **not** do any of the following.

- No depth threshold retuning.
- No confidence threshold retuning.
- No pass-confirmation stable-frame retuning.
- No capture-quality policy change.
- No readiness/voice/setup/navigation change.
- No score/evidence/quality semantics change.
- No public result or app execution flow work.
- No large rewrite of evaluator math.
- No “fix everything” refactor across unrelated camera modules.

This PR is specifically about:
- owner alignment,
- rep-bound timebase integrity,
- hidden veto removal.

---

## 6. Expected file focus

Exact filenames should follow the repo's current reality, but the effective scope is expected to touch only the minimum necessary squat chain:

- squat pass-owner source module
  - example: `src/lib/camera/squat/pass-core.ts` or equivalent
- squat completion state module
  - example: `src/lib/camera/squat-completion-state.ts`
- squat gate adapter / auto progression consumer
  - example: `src/lib/camera/auto-progression.ts`
- optional typed contract file if needed for shared current-rep owner payload
- optional dev/debug trace mapping only if required to expose the new owner-read fields

No unrelated route/UI files unless a dev-only trace field must be surfaced.

---

## 7. Design requirements

### 7.1 Introduce a single downstream read boundary

Create one typed read function for squat final gating, conceptually like:

- `readSquatCurrentRepPassTruth(...)`
- or `readSquatPassOwnerTruth(...)`

It must return a **single rep-bound object**, not ad hoc booleans gathered from multiple stale sources.

Recommended shape:

```ts
interface SquatPassOwnerTruth {
  repId: string | number | null;
  passEligible: boolean;
  blockedReason: string | null;
  currentPhase: 'idle' | 'armed' | 'descending' | 'committed' | 'ascending' | 'standing_recovered';
  descendStartAtMs?: number;
  peakAtMs?: number;
  committedAtMs?: number;
  reversalAtMs?: number;
  ascendStartAtMs?: number;
  standingRecoveredAtMs?: number;
  evidenceLabel?: 'standard' | 'low_rom' | 'ultra_low_rom' | 'insufficient_signal';
  completionMachinePhase?: string;
}
```

Field names can differ, but the contract must preserve these meanings.

### 7.2 Squat gate must consume the adapter, not rebuild truth from scattered fields

Inside `auto-progression.ts` squat path:

- stop treating `completionSatisfied` alone as the first and decisive owner condition,
- read the owner adapter once,
- derive squat final pass eligibility from that adapter + existing non-squat generic conditions,
- keep the rest of the non-owner chain intact.

In practice this means:
- for squat, `finalPassBlockedReason` must report the owner adapter's blocked reason when owner truth is not satisfied,
- not a generic stale `completion_not_satisfied` if the real issue is rep mismatch or stale anchor carryover.

### 7.3 Completion state must clear stale rep timing at rollover

Wherever the squat state machine transitions into a new attempt / new rep / invalidated rep:

- clear old `peakAtMs`, `reversalAtMs`, `committedAtMs`, `standingRecoveredAtMs`, and equivalent timing fields,
- or explicitly rebind them to the newly created current rep context.

No field from a prior rep may remain readable as if it belongs to the new rep.

### 7.4 Preserve observability

Current debug payload is useful and must remain useful.

Do not remove existing debug fields unless strictly necessary.
Instead:
- keep old fields if possible,
- add a narrow owner-read trace block if needed,
- make rep mismatch visible rather than implicit.

Suggested additive debug block:

```ts
squatOwnerRead?: {
  repId: string | number | null;
  ownerPassEligible: boolean;
  ownerBlockedReason: string | null;
  timestampsConsistent: boolean;
  reboundAtRepBoundary: boolean;
}
```

---

## 8. Behavioral intent

This PR is **behavior-corrective**, not purely structural.

The intended change is:

1. A legitimate shallow/current rep must no longer be blocked merely because downstream completion/UI is still reading stale timing from an earlier rep.
2. Early ultra-shallow reps must fail for the true current reason, not for mixed-rep garbage state.
3. Final squat pass must become explainable as one coherent current-rep decision.

This is not a loosening PR.
It is a **same-rep truth alignment PR**.

---

## 9. Acceptance criteria

### A. No mixed-rep timestamp payload

In squat debug traces, the active rep used for pass/fail must never show:
- previous-rep `peakAtMs` mixed with current-rep `reversalAtMs`, or
- same-frame collapsed synthetic values caused by stale carryover.

### B. Squat final gate uses current-rep owner truth

When the current rep owner truth is satisfied:
- squat final gate must not remain blocked solely because a stale completion snapshot from another rep still says false.

### C. Blocked reason becomes truthful

When squat is blocked:
- the blocked reason should point to the current rep owner's actual failure reason,
- not a generic downstream veto that hides the real mismatch.

### D. No threshold drift

Existing thresholds and non-owner pass policies must remain unchanged.

### E. Existing successful standard/deep squat path stays green

A known standard/deep successful rep must still pass.

---

## 10. Regression proof checklist

Minimum validation set:

1. **deep/standard success unchanged**
   - known good standard rep still passes.

2. **late-current-rep stale-veto removal**
   - reproduce a case where current rep owner truth is satisfied after earlier stale state existed.
   - confirm final gate passes.

3. **early ultra-shallow still blocks for truthful reason**
   - no accidental standing/noise pass.
   - blocked reason points to current rep issue.

4. **rep rollover reset proof**
   - start one incomplete rep, then begin another rep.
   - confirm old peak/reversal timestamps are not reused.

5. **diagnostic trace proof**
   - verify owner-read / rep-bound trace fields move coherently with the same rep.

---

## 11. Residual risks

This PR will not fully solve every shallow failure if the earliest peak-anchor acquisition logic itself is still too fragile.

After this PR, any remaining shallow miss should become far easier to diagnose, because the hidden veto and mixed-rep timing contamination will be gone.

So the expected outcome is:
- either shallow pass now works where legitimate current-rep truth already existed,
- or the remaining failure collapses to the true upstream peak-anchor issue.

That is acceptable and desirable.

---

## 12. Follow-up PRs

Only after this PR lands and real-device logs confirm same-rep alignment should follow-up work proceed.

### Follow-up A
Ultra-shallow early peak anchor integrity
- stabilize early rep peak ownership without reopening standing false positives.

### Follow-up B
Collapsed turning-point cleanup
- if any same-frame peak/reversal collapse remains after rep rebind, isolate the turning-point contract itself.

### Follow-up C
Event-cycle veto cleanup
- only if event-cycle still acts as a downstream hidden veto after owner alignment.

---

## 13. One-line lock

The purpose of this PR is:

**Make squat final pass consume one current rep truth, and make rep-bound timestamps impossible to inherit from a different rep.**
