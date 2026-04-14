# PR-E — Residual Risk Closure Truth Map

> This document follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent truth map and assumes PR-A + PR-B + PR-C + PR-D are already landed.
>
> Locked progression so far:
>
> - **PR-A** froze squat product success truth at the post-owner final-pass surface.
> - **PR-B** rebound result semantics to that frozen final-pass truth.
> - **PR-C** normalized final-pass semantics naming and source selection.
> - **PR-D** locked the current contract with regression harnesses.
>
> This document exists because PR-D intentionally left three residual safety gaps:
>
> 1. shallow / ultra-low-ROM real-path lock is still conditional and can SKIP,
> 2. success snapshot real storage path is not fully locked in Node-only regression,
> 3. setup step-back / frame-jump / camera-tilt / unstable-bbox false-pass family is not yet pinned with dedicated fixtures.
>
> This is **not** a product-expansion SSOT.
> This is a **risk-closure truth map** whose sole job is to close those three remaining gaps without widening pass policy, without adding new success rules, and without reopening old regressions.

---

## 1. Core diagnosis

The remaining risk is no longer a main truth split inside the engine.
The remaining risk is that three verification blind spots can still let future PRs regress while all current A/B/C/D smokes stay green.

That means the next work must obey one law:

> **Close blind spots by strengthening observability and verification ownership, not by loosening runtime success conditions.**

This document therefore forbids any fix path that says:

- “make shallow easier so the skipped test can pass,”
- “relax snapshot writing so Node can see it,”
- “broaden readiness / framing tolerance so step-back or frame-jump tests pass.”

Those are all the wrong class of fix.

---

## 2. The three residual risks, precisely stated

### Risk 1 — Conditional shallow / ultra-low-ROM lock gap

Current PR-D behavior is deliberately conservative:

- shallow and ultra-low-ROM real-path checks only hard-lock if the current engine already passes them,
- otherwise the regression harness emits SKIP and refuses to broaden truth.

This is safe against accidental policy widening,
but it leaves one residual gap:

- the repo still does not have an always-on must-pass lock for those paths.

So a future PR can silently keep shallow/ultra-low broken and still pass PR-D,
as long as the SKIP path remains active.

### Risk 2 — Success snapshot real storage path gap

Current A/B/C/D work proves diagnosis summary, attempt snapshot, bundle summary, and helper-level semantics.

But success snapshot persistence is still only partially locked because:

- `recordSquatSuccessSnapshot(...)` writes through browser-only storage paths,
- Node smoke cannot fully emulate `window` / localStorage / runtime success timing / page-level trigger ownership in the same way.

So a future PR could keep diagnosis/bundle green while success snapshot serialization drifts.

### Risk 3 — Setup/framing false-pass dedicated fixture gap

PR-D already covers several nearby false-pass families:

- standing still,
- seated still,
- sit-down-only,
- stand-up-only,
- micro-dip,
- sway/noise.

But the following high-risk product families are still not pinned with their own dedicated fixture contracts:

- setup step-back,
- frame jump,
- camera tilt,
- unstable bbox / framing jitter.

These are especially dangerous because they can reopen success very early,
before the user has produced a real rep.

---

## 3. Global law for all residual-risk closure work

Every follow-up under this SSOT must obey all four of these laws.

### 3.1 No new pass law

No follow-up under this document may create a new squat success path.

The purpose is:

- stronger lock,
- stronger fixture realism,
- stronger storage-path verification,

not more permissive passing.

### 3.2 No OR-union law

No residual-risk closure work may reintroduce widened truth such as:

- `A || B` success ownership,
- fallback-to-success when primary path is missing,
- silent compatibility that hides mismatch.

### 3.3 No consumer-owned engine law

No test helper, snapshot helper, or browser harness may redefine engine truth.

They may observe, record, replay, and assert.
They may not become a second engine.

### 3.4 Narrow-scope law

Each residual risk must be closed in its own narrow PR.

Do not mix:

- shallow/ultra-low real-path closure,
- success snapshot storage-path closure,
- setup/framing false-pass fixture closure

into one implementation PR.

Each blind spot has a different failure mode and must remain independently reviewable.

---

## 4. Truth map for Risk 1 — Shallow / ultra-low-ROM real-path closure

### 4.1 What must be preserved

The current protective rule is correct:

- PR-D must not broaden shallow or ultra-low-ROM pass policy just to make a lock test green.

That rule remains frozen.

### 4.2 The actual problem to solve

The actual problem is not “shallow should be easier.”
The problem is:

- once shallow / ultra-low-ROM is truly fixed on main,
- the lock must become **always-on**,
- and the repo must stop accepting SKIP as a permanent state.

### 4.3 Canonical truth for Risk 1

Risk 1 closure must be built around a two-state contract only:

#### State A — not yet valid on SSOT main

- test may SKIP,
- but only when the fixture is explicitly marked as not-yet-passable,
- and the SKIP reason must be explicit and stable.

#### State B — valid on SSOT main

- the same fixture must become hard-must-pass,
- and SKIP is no longer allowed for that fixture.

### 4.4 What is forbidden

Forbidden fixes include:

- lowering thresholds only for the fixture,
- changing fixture geometry so it no longer reflects the target shallow/ultra-low family,
- replacing real-path pass with mocked pass,
- silently converting must-pass back into SKIP after it was once green.

### 4.5 Required closure mechanism

Risk 1 should be closed by introducing a **promotion gate** from conditional lock to permanent lock.

Recommended structure:

- keep current PR-D shallow / ultra-low checks,
- add a narrow fixture-status map or explicit comment block that marks each as one of:
  - `conditional_until_main_passes`
  - `permanent_must_pass`
- once a fixture genuinely passes on SSOT main, flip it to `permanent_must_pass` in the same PR that fixes the engine.

### 4.6 Required future invariant

After promotion, the following becomes illegal:

- shallow/ultra-low fixture returns SKIP on a branch where SSOT main already marked it permanent-must-pass.

### 4.7 Model recommendation

- **Design / fixture promotion bookkeeping**: Composer 2.0
- **Any engine PR that makes shallow or ultra-low real-path pass again**: Ask → Composer 2.0 → Sonnet 4.6

Reason:
The lock itself is simple; the engine recovery PR is the risky part.

---

## 5. Truth map for Risk 2 — Success snapshot real storage path closure

### 5.1 What must be preserved

Current truth already says:

- diagnosis summary and bundle semantics are aligned,
- success snapshot should express the same canonical final-pass semantics,
- snapshot writing is sink-only and must not affect pass.

That remains locked.

### 5.2 The actual problem to solve

The problem is not semantics logic.
The problem is storage-path ownership.

Today success snapshot verification is incomplete because Node regression does not fully own:

- `window`,
- localStorage ring buffer behavior,
- browser timing around success trigger,
- page-triggered recording path.

### 5.3 Canonical truth for Risk 2

Risk 2 closure must preserve this ownership chain:

1. engine/gate decides success,
2. page/runtime success path decides snapshot write timing,
3. snapshot writer records canonical final-pass semantics as sink-only payload,
4. storage persists that payload,
5. diagnostics read it back without rewriting meaning.

### 5.4 What is forbidden

Forbidden fixes include:

- rewriting `recordSquatSuccessSnapshot(...)` to run differently only for tests,
- weakening success snapshot payload so verification becomes easier,
- making localStorage write succeed by bypassing the real write path,
- introducing a second semantics computation only for success snapshot tests.

### 5.5 Required closure mechanism

Risk 2 should be closed by adding a **browser-like narrow storage harness**, not by changing product logic.

Preferred options, in order:

#### Option A — best

A narrow script or test harness that stubs only:

- `window`,
- `localStorage`,
- minimal current route,

then calls the real success snapshot writer and reads back the stored snapshot.

#### Option B — acceptable

A dev-only pure wrapper around storage access that is already runtime-equivalent and injectable,
**only if** it does not change payload meaning or write timing semantics.

### 5.6 What must be asserted

At minimum, Risk 2 closure must assert that a real success snapshot write preserves:

- `finalPassGranted`,
- `finalPassSemanticsSource`,
- `finalPassSemanticsMismatchDetected`,
- `passSemanticsTruth`,
- non-failed severity for real success.

And for an injected mismatch case:

- mismatch is stored,
- canonical value remains the gate-selected one,
- success is not widened by storage-layer logic.

### 5.7 Required future invariant

After Risk 2 is closed, the following becomes illegal:

- diagnosis summary says success,
- bundle says success,
- but success snapshot storage path serializes failure or drops canonical final-pass semantics fields.

### 5.8 Model recommendation

- **Narrow browser-like storage harness**: Composer 2.0
- **Only use Sonnet 4.6 if** storage ownership gets tangled with page-trigger timing or route-level side effects

Reason:
This is mostly harness plumbing, not semantic reasoning.

---

## 6. Truth map for Risk 3 — Setup / framing false-pass dedicated fixture closure

### 6.1 What must be preserved

The product law remains:

- no pass before a real rep,
- no pass from setup motion,
- no pass from framing instability,
- no pass from non-rep visual artifacts.

### 6.2 The actual problem to solve

Current PR-D covers adjacent false-pass families,
but not the specific high-risk setup/framing families that often reappear during camera tuning.

The danger here is not “bad quality.”
The danger is **premature success opening**.

### 6.3 Canonical truth for Risk 3

The following must each become their own dedicated false-pass fixture family:

1. **setup step-back**
   - subject changes framing/position before real rep begins

2. **frame jump**
   - timestamps or body box shift abruptly without meaningful squat cycle

3. **camera tilt / framing drift**
   - viewpoint changes body projection but not movement meaning

4. **unstable bbox / unstable landmark framing**
   - tracking instability mimics motion cues

### 6.4 What is forbidden

Forbidden fixes include:

- collapsing all four into one generic `invalid framing` test,
- asserting only retry/fail UI copy instead of final-pass closure,
- relying only on quality flags without checking `finalPassEligible`,
- mocking out the exact instability so heavily that the fixture no longer resembles the target risk.

### 6.5 Required closure mechanism

Risk 3 should be closed by adding **one dedicated narrow fixture or smoke per family**, each asserting:

- `finalPassEligible === false`,
- latch remains false,
- no canonical success semantics are emitted,
- if a blocked reason family is stable enough, it is checked narrowly,
- but the primary lock remains “no success opening.”

### 6.6 Priority order inside Risk 3

The closure order should be:

1. setup step-back
2. frame jump
3. unstable bbox / landmark instability
4. camera tilt / framing drift

Why this order:

- setup step-back most directly threatens early success opening,
- frame jump is the next most likely to create fake motion,
- unstable bbox is common during camera tuning,
- tilt/drift is important but usually less frequent than the first three.

### 6.7 Required future invariant

After Risk 3 is closed, the following becomes illegal:

- any of the four dedicated fixture families ever opening canonical success without a genuine rep.

### 6.8 Model recommendation

- **Fixture design and narrow smoke additions**: Composer 2.0
- **Only use Sonnet 4.6 if** the fixture requires careful frame-sequence synthesis tightly coupled to pose-feature math

---

## 7. Recommended PR split after this SSOT

To keep review safe, the next work should be split as follows.

### PR-E1 — Conditional Shallow Lock Promotion Map

Scope:

- convert Risk 1 from indefinite SKIP to explicit promotion-state contract,
- no engine widening,
- no semantics changes.

### PR-E2 — Success Snapshot Storage Harness Lock

Scope:

- close Risk 2 with a browser-like narrow storage harness,
- verify stored canonical final-pass semantics fields,
- no snapshot payload redesign.

### PR-E3 — Setup/Framing False-Pass Fixture Lock

Scope:

- add dedicated setup step-back / frame-jump / unstable-bbox / tilt fixtures,
- lock no-success-opening behavior,
- no threshold retuning.

These should not be merged into one PR.

---

## 8. Acceptance criteria for the overall residual-risk closure program

The overall closure program is complete only when all three are true.

### A. No permanent SKIP ambiguity remains for promoted shallow/ultra-low fixtures

A fixture is either:

- explicitly conditional because SSOT main does not yet pass it,
- or permanently must-pass.

It cannot live forever in an undefined half-state.

### B. Success snapshot storage path is locked end-to-end

A real success write preserves the same canonical final-pass semantics truth already locked in diagnosis/bundle.

### C. Dedicated setup/framing false-pass families are pinned

Step-back, frame-jump, tilt/drift, and unstable-bbox families each have their own no-success-opening lock.

---

## 9. Residual risks intentionally still outside this document

This document does not attempt to solve:

- overhead reach residual lock work,
- broad browser E2E camera automation,
- deprecated alias removal and storage migration,
- owner-role JSDoc cleanup for `passOwner` / `finalSuccessOwner` / `motionOwnerSource`.

Those may come later, but they are not part of this three-risk closure map.

---

## 10. Operational rule after this SSOT

Any future squat camera PR that touches one of these three risk zones must do one of two things:

- land the corresponding closure PR and update the regression harness, or
- explicitly state why it is not touching that risk zone.

No future PR may silently rely on these blind spots remaining open.

---

## 11. One-line lock

**The remaining squat risk is no longer engine truth; it is blind-spot truth. Close the blind spots by promoting conditional locks, verifying real success snapshot storage, and pinning dedicated setup/framing false-pass fixtures — without widening pass policy even one step.**
