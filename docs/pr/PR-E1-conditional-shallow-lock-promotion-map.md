# PR-E1 — Conditional Shallow Lock Promotion Map

> This document follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent truth map and `docs/pr/PR-E-residual-risk-closure-truth-map.md` as the direct parent SSOT.
>
> Assumption lock:
>
> - PR-A froze squat product success truth at the post-owner final-pass surface.
> - PR-B rebound severity/result semantics to that frozen truth.
> - PR-C normalized final-pass semantics source selection and mismatch visibility.
> - PR-D locked the current squat truth contract with regression harnesses.
> - PR-E identified one remaining shallow/ultra-low-ROM blind spot: the current lock can remain in SKIP indefinitely unless promotion ownership is made explicit and enforceable.
>
> This PR closes **only** that promotion-ownership blind spot.
>
> It does **not** make shallow easier.
> It does **not** retune thresholds.
> It does **not** convert non-passing fixtures into passing fixtures.
>
> It introduces a machine-enforced promotion-state map so shallow/ultra-low-ROM fixtures cannot live forever in an undefined SKIP state once main truth is known.

---

## 0. Current main snapshot (landed)

In `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`, **`shallow_92deg`** and **`ultra_low_rom_92deg`** are **`permanent_must_pass`**, with Matrix A asserting the full canonical shallow authority bundle documented in that script’s header. One-page narrative: **`docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`**.

Sections below define the promotion **contract** (`conditional_until_main_passes` vs `permanent_must_pass` semantics). They are not invalidated by the snapshot; other fixtures may still use conditional state when lawfully registered.

---

## 1. Why this PR exists

Current PR-D behavior is intentionally conservative.

For shallow and ultra-low-ROM families:

- if current main already passes the real-path fixture, the lock can assert it
- if current main does not pass it, the harness may SKIP instead of broadening truth

That protective rule is correct.

But one blind spot remains:

- nothing forces a fixture to graduate from conditional SKIP into permanent must-pass once main truth is established

So a future branch can keep the fixture in practical limbo:

- not broadening pass policy,
- but also never fully locking the recovered truth.

This PR exists to remove that ambiguity.

---

## 2. Core law

> **Promotion state must be machine-readable and test-enforced. Comment-only state is forbidden.**

This is the most important implementation lock in this PR.

A comment, README note, or inline prose is not enough.
The harness must be able to mechanically decide whether a fixture is allowed to SKIP or required to hard-fail on regression.

---

## 3. Scope

### In scope

- Introduce an explicit promotion-state contract for shallow/ultra-low-ROM lock ownership.
- Represent fixture promotion state in a machine-readable form.
- Make the regression harness consume that state.
- Preserve the current protective rule against accidental policy widening.
- Document the promotion contract in this SSOT.

### Out of scope

- No threshold changes.
- No evaluator changes.
- No new pass path.
- No conversion of failing shallow fixtures into passing ones.
- No success semantics redesign.
- No setup/framing false-pass fixture expansion.
- No snapshot storage-path work.

---

## 4. Parent truth that must remain frozen

### 4.1 PR-D’s non-widening rule remains correct

This PR must preserve the rule:

- do not broaden shallow or ultra-low-ROM pass policy just to make a regression test green

### 4.2 Shallow promotion is ownership work, not engine work

This PR must not pretend to fix a shallow engine bug by changing fixture metadata.

If main does not truly pass a fixture yet, that fixture may remain conditional.
But that conditional state must be explicit, stable, and machine-enforced.

### 4.3 Once promoted, promotion cannot silently roll back

A fixture that has been promoted to permanent must-pass may not silently fall back to SKIP on a future branch.

That is the core invariant this PR introduces.

---

## 5. Actual problem to solve

The actual problem is not “how do we make shallow pass?”
The actual problem is:

> **How do we prevent shallow/ultra-low-ROM truth from staying in permanent ambiguity after the engine truth becomes known?**

Today the answer is incomplete because SKIP is conditional but not promotion-owned.

This PR must turn that into an explicit state machine.

---

## 6. Canonical promotion contract

Each target shallow/ultra-low-ROM fixture must have a machine-readable promotion state.

Recommended minimal states:

- `conditional_until_main_passes`
- `permanent_must_pass`

Optional extra state only if truly necessary:

- `retired` or equivalent, **but only** if the fixture is being intentionally removed and the PR explicitly justifies that removal

No other vague states should be introduced.

---

## 7. Required behavior by state

### 7.1 `conditional_until_main_passes`

Meaning:

- current SSOT main does not yet guarantee this fixture as a must-pass lock
- the harness may allow SKIP
- but only for this explicit state

Required behavior:

- SKIP reason must be deterministic and explicit
- the fixture may not masquerade as must-pass
- the fixture may not silently disappear from the matrix

### 7.2 `permanent_must_pass`

Meaning:

- current SSOT main truth has already validated this fixture as a real-path must-pass
- from now on the harness must fail if the fixture no longer passes

Required behavior:

- SKIP is forbidden
- branch regression must fail loudly
- no fallback to comment-based ambiguity

---

## 8. Required implementation shape

### 8.1 Machine-readable registry is mandatory

The promotion contract must live in a machine-readable fixture registry or equivalent structured map.

Examples of acceptable forms:

- exported object/array in a script-side fixture registry file
- structured JSON-like config consumed by the smoke script
- explicit inline data structure inside the smoke script itself

Examples of forbidden forms:

- prose comment only
- markdown note only
- hard-coded hidden branch inside the harness with no explicit fixture state data

### 8.2 Registry must be per fixture, not per family blob

Each shallow/ultra-low-ROM fixture must have its own state entry.

Forbidden:

- one shared boolean for all shallow fixtures
- one vague “low ROM state” flag with no per-fixture identity

### 8.3 Promotion must occur in the same PR that proves real main truth

When an engine PR genuinely restores a shallow/ultra-low-ROM fixture on SSOT main, that same PR must:

1. prove the real-path fixture passes
2. flip the registry state to `permanent_must_pass`
3. make future regression fail if it falls back

Promotion may not be deferred indefinitely.

### 8.4 Downgrade protection must be explicit

If a fixture is already `permanent_must_pass`, the harness must reject behavior equivalent to:

- “still SKIP for now”
- “temporarily ignore”
- “pass only on some environments”

unless the PR explicitly changes fixture status with a documented reason and reviewed approval.

---

## 9. Forbidden fixes

The following are forbidden:

- lowering thresholds only to graduate the fixture
- changing fixture geometry to make it easier while pretending truth stayed the same
- mocked pass replacing real-path pass for promotion
- comment-only promotion state
- silently downgrading a promoted fixture back to conditional/SKIP
- removing a fixture from the matrix to avoid promotion bookkeeping

---

## 10. Files allowed

Allowed implementation files:

- existing squat regression smoke under `scripts/` extended to consume promotion state, or
- a narrow helper registry file under `scripts/` or another clearly test-only location
- `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md`

Optional read-only imports used by the harness:

- current PR-D smoke script(s)
- existing shallow/ultra-low-ROM fixture builders already used by the repo

### Production files forbidden in this PR

- `src/lib/camera/auto-progression.ts`
- evaluator files
- route/page/UI files
- semantics/result-severity logic
- snapshot storage logic

If an engine change is needed to make a fixture truly pass, that belongs in a separate engine PR or in the same PR only if that PR is explicitly an engine recovery PR. This SSOT itself is for promotion ownership, not engine widening.

---

## 11. Required regression matrix

### Matrix A — conditional fixture behavior

| Case | Expected |
|---|---|
| fixture state = conditional_until_main_passes | explicit conditional path allowed |
| fixture state = conditional_until_main_passes | SKIP allowed only with stable explicit reason |
| fixture state = conditional_until_main_passes | fixture still present in matrix |

### Matrix B — permanent fixture behavior

| Case | Expected |
|---|---|
| fixture state = permanent_must_pass | SKIP forbidden |
| fixture state = permanent_must_pass | regression fails if pass disappears |
| fixture state = permanent_must_pass | fixture remains individually visible |

### Matrix C — downgrade protection

| Case | Expected |
|---|---|
| already-promoted fixture later returns SKIP | hard failure |
| promoted fixture later hidden/removed without explicit status change | hard failure or explicit documented break |

---

## 12. Acceptance criteria

This PR is complete only when all are true:

1. shallow/ultra-low-ROM target fixtures have machine-readable promotion states
2. conditional vs permanent behavior is test-enforced, not comment-enforced
3. promoted fixtures can no longer silently fall back to SKIP
4. no threshold or engine semantics changed in the promotion bookkeeping itself
5. fixture identity stays visible and reviewable

---

## 13. Residual risks intentionally left out

This PR does not solve:

- the actual engine bug that may still prevent a shallow fixture from passing today
- success snapshot storage-path lock
- setup/framing false-pass fixture lock
- overhead reach promotion/state work

Those belong elsewhere.

---

## 14. Model recommendation

- **Recommended for promotion bookkeeping itself**: Composer 2.0
- **Use Ask → Composer 2.0 → Sonnet 4.6** when the same PR also attempts real engine recovery that changes a fixture from conditional to permanent must-pass

The bookkeeping is simple; the engine recovery is the risky part.

---

## 15. One-line lock

**PR-E1 must turn shallow/ultra-low-ROM lock state from informal conditional SKIP into a machine-readable, test-enforced promotion contract so no recovered fixture can ever silently fall back into ambiguity.**

---

## 16. Landed status pointer (current main)

Executable registry state, canonical proof bits, and PR-F skip policy as enforced on main: **`docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`**.