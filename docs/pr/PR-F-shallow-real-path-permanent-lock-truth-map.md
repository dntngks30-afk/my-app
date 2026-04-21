# PR-F — Shallow Real-Path Permanent Lock Truth Map

> This document follows these already-landed truths as parents:
>
> - `docs/PASS_AUTHORITY_RESET_SSOT_20260404.md`
> - `docs/pr/PR-RF-STRUCT-11-shallow-squat-safe-pass-truth-map.md`
> - `docs/pr/PR-E-residual-risk-closure-truth-map.md`
> - `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md`
>
> Assumption lock:
>
> - PR-A/B/C/D already froze squat product success at the post-owner final-pass surface and locked the current regression contract.
> - PR-E1/E2/E3 already closed the three blind spots around promotion bookkeeping, success-snapshot storage verification, and setup/framing false-pass families.
> - Latest main is therefore **not missing blind-spot coverage**.
> - **(Pre-landing framing; superseded for E1 representatives by §0.)** The remaining problem was stated as: shallow / ultra-low-ROM real-path fixtures not yet promoted to permanent must-pass because main truth was not yet strong enough to justify promotion. **Current main:** `shallow_92deg` / `ultra_low_rom_92deg` are **`permanent_must_pass`** — §0 and `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.
>
> This PR was the planned next step after PR-E.
>
> It is **not** another bookkeeping PR.
> It is **not** a broad camera retune.
> It is a narrow engine-recovery + permanent-lock promotion PR for shallow real-path truth only.

---

## 0. Current main status (landed)

`shallow_92deg` and `ultra_low_rom_92deg` are **`permanent_must_pass`** in `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`, with the full canonical authority bundle asserted in Matrix A. **`docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`**.

Sections 1–3 below keep the **pre-landing** framing for law and scope history. They must not be read as claiming the E1 representative pair is still conditional on main.

---

## 1. Why this PR exists

The repo already has:

- pass-authority restructuring,
- canonical shallow closure machinery,
- current-rep observability,
- promotion bookkeeping,
- false-pass fixture locks,
- snapshot/storage verification.

**Pre-landing narrative (historical):** the two representative shallow fixtures were still not promoted to permanent must-pass on the head that existed when this map was written.

That described a **half-state** at that time:

- false-pass families are guarded,
- but legitimate shallow / ultra-low-ROM real-path success was not yet treated as permanent truth for the E1 representative rows.

**Current main:** that promotion gap for `shallow_92deg` / `ultra_low_rom_92deg` **is closed** — §0.

Once the blind spots are closed, the remaining work must be:

> **recover real shallow pass without widening non-rep pass, and promote the recovered fixtures to permanent must-pass in the same PR.**

This document exists to define that PR with a hard scope boundary so the repo does not drift back into:

- conditional SKIP limbo,
- owner split,
- reopen-style permissive patching,
- or new false-pass regressions.

---

## 2. One-sentence objective

**Make the existing shallow / ultra-low-ROM representative fixtures pass through the real product path on SSOT main, then promote them from `conditional_until_main_passes` to `permanent_must_pass` in the same PR, without widening pass policy even one step for non-rep motion.**

---

## 3. Exact problem statement

The remaining problem is not broad camera instability.
The remaining problem is not missing regression coverage.
The remaining problem is not result severity or UI wording.

The remaining problem is:

- a legitimate shallow / ultra-low-ROM rep can still fail to open final pass on main,
- even though the repo already contains the correct anti-false-pass laws,
- so promotion cannot yet move from conditional to permanent.

That means the next PR must solve **only** this class of gap:

> **real shallow rep not graduating to permanent pass despite the existing pass-authority and false-pass lock architecture.**

---

## 4. Core laws for this PR

### 4.1 No new pass law

This PR may not create a new product pass definition.

A squat still passes only if the same rep contains:

1. meaningful descent,
2. meaningful reversal / ascent,
3. standing recovery,
4. anti-false-pass integrity,
5. same-rep temporal ownership.

This PR recovers a blocked legitimate shallow rep.
It does not invent a second easier pass class.

### 4.2 Same-rep law

No implementation in this PR may allow pass by combining:

- descent from one rep,
- reversal from another,
- recovery from another,
- or setup/framing movement with a later partial rep.

The shallow fix must remain same-rep only.

### 4.3 No reopen shortcut law

This PR must not solve shallow recovery by reviving or broadening a permissive owner-reopen shortcut.

Forbidden solution class:

- “if shallow enough and some evidence looks close, reopen pass anyway”

Required solution class:

- strengthen the existing real-path authority chain so the legitimate shallow rep is correctly recognized by the current single-authority structure.

### 4.4 Promotion-in-the-same-PR law

This PR is incomplete unless both happen together:

1. the real-path engine actually passes the representative shallow fixtures on main,
2. the registry state is flipped to `permanent_must_pass` in the same PR.

A shallow recovery PR that leaves the fixtures conditional is not accepted.

### 4.5 Never-pass preservation law

Nothing in this PR may weaken the current never-pass families:

- standing only
- descent only
- seated / bottom hold only
- micro-dip / jitter spike
- setup step-back
- frame jump
- camera tilt / framing drift
- unstable bbox / landmark jitter
- cross-rep laundering
- ultra-low short-cycle trajectory false pass
- setup-series-start false pass

---

## 5. What this PR is allowed to solve

This PR may solve only the narrow engine-recovery gap that prevents legitimate shallow fixtures from passing through the existing authority chain.

That means the implementation may adjust only the parts that determine whether a **real shallow rep** is correctly recognized as:

- belonging to the current rep,
- having a valid temporal epoch,
- satisfying legitimate reversal / recovery evidence,
- and reaching the already-defined final pass surface.

Allowed problem classes:

- current-rep epoch / ownership under-recognition,
- shallow temporal anchoring that is still too weak for legitimate reps,
- real-path shallow recognition failing before promotion can occur,
- pass-core and completion-state alignment for legitimate shallow reps,
- narrow authority-chain recovery needed to convert current conditional fixtures into permanent fixtures.

---

## 6. What this PR is forbidden to touch

### Out of scope

- no snapshot/storage redesign
- no new setup/framing fixture family
- no overhead reach work
- no route/page/navigation redesign
- no result severity / retry semantics redesign
- no broad confidence retuning
- no blanket lowering of global anti-false-pass thresholds
- no fixture-only hidden threshold exceptions
- no “pass for tests only” path
- no mocked pass replacing real product pass

### Production layers that must not be redesigned here

- public funnel flow
- page-level navigation ownership
- trace UI rendering
- session/result/business logic outside squat camera pass chain

---

## 7. Canonical target of the fix

The canonical target is not “all shallow motions in general.”
The canonical target is the already-registered representative fixtures that currently define the promotion boundary:

- `shallow_92deg`
- `ultra_low_rom_92deg`

Those are the truth targets.

This PR succeeds only if those fixtures:

1. pass through the real path,
2. satisfy the same post-owner final-pass surface used by product runtime,
3. are promoted to `permanent_must_pass`,
4. and remain compatible with the existing never-pass families.

---

## 8. Required implementation boundary

### 8.1 Primary implementation boundary

The implementation must stay inside the squat pass-authority chain.

Allowed focus zones:

- `src/lib/camera/squat/pass-core.ts`
- `src/lib/camera/squat-completion-state.ts`
- closely related same-rep / temporal-epoch helpers directly used by those files
- the promotion registry / smoke script that flips the recovered fixtures to permanent

### 8.2 Secondary boundary

`src/lib/camera/auto-progression.ts` may be changed only if strictly required to preserve the already-locked final-pass surface for the recovered shallow truth.

That means:

- no new gate layer,
- no new second owner,
- no new fallback semantics,
- no UI-only veto becoming motion truth,
- no broad rewrite.

### 8.3 Explicit ban on broad evaluator rewiring

This PR must not re-open evaluator-wide architecture work.
If a fix requires redesigning multiple camera layers at once, the PR is too broad and must be split.

---

## 9. Required design direction

The fix must follow this direction:

> **Recover legitimate shallow pass by making the existing authority chain recognize the real rep earlier and more reliably, not by weakening what counts as a real rep.**

Concretely, the implementation may:

- strengthen current-rep epoch integrity for shallow reps,
- strengthen real-path shallow temporal anchoring,
- improve same-rep ownership clarity where a legitimate shallow rep is currently lost,
- tighten the bridge between legitimate shallow evidence and final pass truth,

but it may not:

- replace same-rep proof with generic permissive heuristics,
- treat provenance-only evidence as pass authority,
- bypass the final pass chain,
- or demote never-pass protections.

---

## 10. Required regression matrix

### Matrix A — representative shallow recovery

These must pass through the real path:

| Case | Expected |
|---|---|
| `shallow_92deg` | `status='pass'`, `finalPassEligible=true`, no SKIP |
| `ultra_low_rom_92deg` | `status='pass'`, `finalPassEligible=true`, no SKIP |
| both promoted fixtures | `isFinalPassLatched('squat', gate) === true` |
| both promoted fixtures | registry state flipped to `permanent_must_pass` |

### Matrix B — no false-pass reopening

These must remain non-pass:

| Family | Expected |
|---|---|
| standing only | blocked |
| descent only | blocked |
| seated / bottom only | blocked |
| micro-dip / sway / jitter-only | blocked |
| setup step-back | blocked |
| frame jump | blocked |
| unstable bbox / landmark jitter | blocked |
| camera tilt / framing drift | blocked |
| cross-rep stitched motion | blocked |
| ultra-low short-cycle trajectory false pass | blocked |
| setup-series-start false pass | blocked |

### Matrix C — no truth split after recovery

| Case | Expected |
|---|---|
| recovered shallow fixture | pass-core truth, post-owner final pass, and latch all agree |
| recovered shallow fixture | no `conditional` SKIP path remains |
| recovered shallow fixture | no owner contradiction / stale-rep split appears |

### Matrix D — downgrade protection after promotion

| Case | Expected |
|---|---|
| promoted shallow fixture later fails | hard failure, not SKIP |
| promoted shallow fixture hidden from matrix | hard failure |
| promoted shallow fixture silently downgraded | hard failure |

---

## 11. Acceptance criteria

This PR is complete only if all are true:

1. `shallow_92deg` and `ultra_low_rom_92deg` pass on SSOT main through the real product path.
2. Both fixtures are promoted from `conditional_until_main_passes` to `permanent_must_pass` in the same PR.
3. Existing false-pass families remain locked and green.
4. No new pass path or second owner is introduced.
5. No reopen-style permissive shortcut is introduced.
6. `finalPassEligible`, `finalPassBlockedReason`, and `isFinalPassLatched(...)` remain aligned with the already-frozen post-owner final-pass surface.
7. The fix is narrow enough that a reviewer can explain exactly why a legitimate shallow rep now passes without also widening fake motion.

---

## 12. Failure conditions

The PR must be rejected if any of the following is true:

- the fixtures still remain conditional after the code change
- the fixtures pass only through mocked or fixture-only behavior
- any never-pass family reopens
- a permissive reopen shortcut becomes the real pass owner
- a second hidden owner is introduced in evaluator or auto-progression
- promotion happens without true real-path pass
- the implementation needs broad unrelated retuning to stay green

---

## 13. Recommended implementation order inside the PR

1. identify the narrow real-path shallow-loss point inside the existing authority chain
2. repair that point without widening non-rep pass semantics
3. prove the representative shallow fixtures pass through the real path
4. re-run all false-pass and downgrade guards
5. flip both fixtures to `permanent_must_pass`
6. leave no conditional ambiguity behind

---

## 14. Model recommendation

This is a high-risk contract PR.

Recommended workflow:

- Ask / analysis for exact current bottleneck confirmation
- Composer 2.0 for structure/path discovery
- Sonnet 4.6 for final implementation

Reason:

- the change must be narrow,
- same-rep and pass-authority semantics must not drift,
- and the PR must both recover shallow truth and harden permanent promotion in one shot.

---

## 15. One-line lock

**PR-F must make the current representative shallow fixtures pass through the real authority chain and promote them to permanent must-pass in the same PR, while preserving every existing never-pass family and forbidding any new permissive shortcut.**
