# PR-E2 — Success Snapshot Storage Harness Lock

> This document follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent truth map and `docs/pr/PR-E-residual-risk-closure-truth-map.md` as the direct parent SSOT.
>
> Assumption lock:
>
> - PR-A froze squat product success truth at the post-owner final-pass surface.
> - PR-B rebound severity/result semantics to that frozen truth.
> - PR-C normalized final-pass semantics naming/source selection and introduced the single read boundary.
> - PR-D added executable regression harnesses for gate truth, source selection, cross-surface alignment, and compat fallback.
> - PR-E identified one remaining blind spot: the real success snapshot storage path is not yet locked end-to-end.
>
> This PR closes **only** that blind spot.
>
> It does **not** change squat pass policy.
> It does **not** redesign success payload semantics.
> It does **not** widen runtime success conditions.
>
> It adds a narrow browser-like verification harness around the real success snapshot write path so future PRs cannot silently drift diagnosis/bundle truth away from persisted success snapshots.

---

## 1. Why this PR exists

Current main already locks:

- gate-level final pass truth,
- semantics source selection,
- diagnosis summary canonical fields,
- attempt/bundle canonical read behavior.

But one important path is still not directly locked:

- `recordSquatSuccessSnapshot(...)`
- `pushSuccessSnapshot(...)`
- browser `localStorage` persistence
- read-back via `getRecentSuccessSnapshots()`

That means a future PR can keep helper-level and bundle-level tests green while the real persisted success snapshot:

- drops canonical fields,
- serializes the wrong final-pass semantics,
- writes inconsistent mismatch flags,
- or silently diverges from diagnosis/bundle truth.

This PR exists to close that path without changing product behavior.

---

## 2. Core law

> **Verify the real success snapshot write path; do not create a second test-only semantics path.**

This PR is about storage-path verification ownership, not semantics redesign.

---

## 3. Scope

### In scope

- Add a narrow browser-like harness for the real squat success snapshot write path.
- Stub only the minimum browser surface needed for the real runtime path:
  - `window`
  - `window.location.pathname`
  - `window.location.search` if needed
  - `localStorage`
- Call the real `recordSquatSuccessSnapshot(...)` function.
- Read back persisted snapshots through the real storage reader.
- Assert canonical final-pass semantics fields and invariant preservation.
- Add a mismatch-injected storage-path case.
- Add a clear/cleanup step so the harness is deterministic and bounded.
- Document the lock in this SSOT.

### Out of scope

- No changes to squat thresholds.
- No changes to pass/fail policy.
- No changes to `readSquatFinalPassSemanticsTruth(...)` logic.
- No changes to `buildSquatResultSeveritySummary(...)` logic.
- No success payload redesign.
- No route/page/UI changes.
- No refactor of broader trace storage systems.
- No E2E browser automation stack.

---

## 4. Parent truth that must remain frozen

### 4.1 Product pass truth remains PR-A truth

This PR must not change:

- `finalPassEligible`
- `finalPassBlockedReason`
- page latch ownership
- post-owner final-pass surface as product success truth

### 4.2 Semantics truth remains PR-B/PR-C truth

This PR must not change:

- `finalPassGranted`
- `finalPassSemanticsSource`
- `finalPassSemanticsMismatchDetected`
- `passSemanticsTruth: 'final_pass_surface'`

### 4.3 Snapshot writer remains sink-only

Success snapshot recording remains diagnostic/observability only.
It must not affect pass, latch, gate, severity, or route flow.

---

## 5. Actual problem to solve

The current repo verifies diagnosis/bundle semantics, but not the persisted success snapshot path itself.

Today the write path depends on browser-only surfaces:

- `window`
- `localStorage`

and runtime write timing through the real success snapshot function.

Node-only helper tests do not fully own that path.

So the missing lock is not “what should the truth be?”
The missing lock is:

> **Does the real success snapshot storage path persist the already-locked canonical truth without drift?**

---

## 6. Canonical ownership chain to preserve

Risk closure must preserve the following ownership chain exactly:

1. gate/runtime decides final pass truth
2. `readSquatFinalPassSemanticsTruth(...)` reads canonical semantics truth
3. `recordSquatSuccessSnapshot(...)` builds the squat success snapshot from that canonical truth
4. `pushSuccessSnapshot(...)` persists it
5. `getRecentSuccessSnapshots()` reads it back
6. the read-back payload still expresses the same canonical final-pass semantics

No alternate path may replace this chain inside the harness.

---

## 7. Required implementation shape

### 7.1 Use the real write function

The harness must call the real exported function:

- `recordSquatSuccessSnapshot(...)`

It is forbidden to bypass it by directly constructing a snapshot object and pushing it to storage.

### 7.2 Browser-like stub must be minimal

The harness may stub only what the runtime path actually needs.

Allowed:

- `global.window`
- `window.location.pathname`
- `window.location.search`
- `global.localStorage` or `window.localStorage`

Not recommended:

- fake router stacks
- fake page controllers
- extra timing orchestration not required by the writer

The point is storage-path realism, not fake app simulation.

### 7.3 Machine-deterministic storage cleanup

Before each storage-path assertion group, the harness must clear:

- success snapshot storage key through the real cleanup path if available, or
- equivalent localStorage cleanup

After the run, the harness must leave storage clean.

### 7.4 Narrow script, not broad browser test suite

This should be one narrow deterministic script or smoke file under `scripts/`.

Do not introduce Playwright/Cypress/browser automation for this PR.

---

## 8. What must be asserted

### 8.1 Real-success write case

For a real successful squat gate payload written through `recordSquatSuccessSnapshot(...)`, the persisted snapshot must preserve at minimum:

- `motionType === 'squat'`
- `passSemanticsTruth === 'final_pass_surface'`
- `finalPassGranted === true`
- `finalPassSemanticsSource` present and matching canonical read truth
- `finalPassSemanticsMismatchDetected === false` when the source values align
- `passSeverity !== 'failed'`
- `resultInterpretation !== 'movement_not_completed'`

### 8.2 Mismatch-injected write case

For a mismatch payload where:

- `finalPassEligible === false`
- `squatFinalPassTruth.finalPassGranted === true`

the persisted snapshot must preserve:

- `finalPassGranted === false`
- `finalPassSemanticsSource === 'gate_final_pass_eligible'`
- `finalPassSemanticsMismatchDetected === true`
- `passSeverity === 'failed'`
- no OR-union widened success

### 8.3 Read-back shape case

After persistence, reading through `getRecentSuccessSnapshots()` must return a squat success snapshot whose canonical semantics fields are still present.

### 8.4 Cleanup case

After cleanup, `getRecentSuccessSnapshots()` must return an empty list.

---

## 9. Forbidden fixes

The following are forbidden in this PR:

- writing a second snapshot builder only for tests
- changing runtime semantics so tests become easier
- bypassing `recordSquatSuccessSnapshot(...)`
- bypassing `pushSuccessSnapshot(...)`
- weakening required snapshot fields
- adding test-only branches inside production snapshot logic
- altering success timing/page ownership behavior just to satisfy the harness
- treating route mocking as the primary goal instead of storage truth preservation

---

## 10. Files allowed

Allowed implementation files:

- new narrow smoke file under `scripts/` for storage-path verification
- optional tiny test-only utilities under `scripts/` if needed
- `docs/pr/PR-E2-success-snapshot-storage-harness-lock.md`

Optional read-only production imports used by the script:

- `src/lib/camera/camera-success-diagnostic.ts`
- `src/lib/camera/squat/squat-final-pass-semantics.ts`
- existing gate fixture sources already used in prior smoke scripts

### Production files forbidden unless absolutely required for non-semantic testability

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/squat/squat-final-pass-semantics.ts`
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts`
- route/page/UI files

If any production file must change, it must be strictly for non-semantic testability and must not change payload meaning, source selection, or write timing. In that case, the PR description must explicitly justify it.

---

## 11. Required regression matrix

### Matrix A — real success snapshot storage

| Case | Expected |
|---|---|
| real successful squat write | persisted snapshot contains canonical final-pass fields |
| real successful squat write | `finalPassGranted=true`, mismatch false |
| real successful squat write | severity non-failed |

### Matrix B — mismatch preservation

| Case | Expected |
|---|---|
| gate=false, truth=true mismatch write | persisted `finalPassGranted=false` |
| gate=false, truth=true mismatch write | source=`gate_final_pass_eligible` |
| gate=false, truth=true mismatch write | mismatch true |
| gate=false, truth=true mismatch write | severity failed |

### Matrix C — storage lifecycle

| Case | Expected |
|---|---|
| clear before write | empty list |
| write once | list length 1 |
| cleanup after read | empty list |

---

## 12. Acceptance criteria

This PR is complete only when all are true:

1. the harness calls the real success snapshot writer
2. canonical final-pass semantics fields survive persistence and read-back
3. mismatch cases remain mismatch cases after persistence
4. success does not become widened at storage layer
5. no production pass semantics changed
6. no test-only semantics branch was introduced

---

## 13. Residual risks intentionally left out

This PR does not solve:

- shallow/ultra-low-ROM promotion state management
- dedicated setup/framing false-pass fixture families
- overhead reach storage-path parity
- broader browser E2E automation

Those belong to other PRs.

---

## 14. Model recommendation

- **Recommended**: Composer 2.0
- **Escalate to Sonnet 4.6 only if** minimal browser-like stubbing becomes entangled with route-level side effects or non-obvious module-evaluation order issues

This is primarily narrow harness plumbing, not semantic redesign.

---

## 15. One-line lock

**PR-E2 must lock the real squat success snapshot storage path end-to-end so persisted success snapshots cannot drift from the canonical final-pass semantics already frozen by PR-A/B/C/D.**