# PR-SESSION-PREPARING-CLAIM-CREATE-ORDER-RECOVERY-01

## Purpose

Recover the broken post-onboarding execution flow where new public-first users hang on `session-preparing` because the route tries to create a session before the public result has been claimed.

This PR is **not** about session quality, claimed-result ranking quality, trace shape, or first-session expressiveness.
This PR is about restoring the execution order truth so `onboarding -> claim -> create -> app entry` becomes reliable again under the current product direction where `session-preparing` is treated as a real execution-preparation surface.

---

## Executive conclusion

The direct runtime failure is **not** a Next.js missing-route 404.
The first failing request is the product-level `404 ANALYSIS_INPUT_UNAVAILABLE` returned by `/api/session/create` when `resolveSessionAnalysisInput(...)` cannot find either:

1. a **claimed** public result, or
2. a legacy deep summary.

The immediately following `409` is a **request-dedupe follow-up symptom**, not the primary cause.

The real ordering bug is:

- `/session-preparing` currently owns `createSession()` and calls it on mount.
- `/onboarding-complete` still owns `claimPublicResultClient(...)`.
- Therefore create runs **before** claim.
- New public-only users have bridge identity but do **not** yet have a claimed public result row.
- Session creation therefore fails with `ANALYSIS_INPUT_UNAVAILABLE`.

---

## Verified repo facts

### A. Original session-preparing contract (staging only)
Commit `094600952cfd7b41fe070d3c75cfaf5b10e0ccca` (`PR-GENERATION-STAGE-07`) introduced `/session-preparing` as a short staging route only.
The page explicitly stated:
- no new session-create API call,
- no network work,
- auto-continue to `/onboarding-complete`,
- existing claim flow remains on onboarding-complete.

### B. Regression introduction
Commit `e4bb3463434026376344e5f41ef6c874eda1fe29` changed `/session-preparing` from staging-only into a real create owner.
That commit added:
- immediate `createSession(...)` call on mount,
- dwell/progress linked to readiness,
- redirect to `/onboarding-complete` only after create success.

This is the structural regression introduction point.
Subsequent commit `0c97af239ddd9e9658d8ce042dae547a61e5f3d5` only split the logic into `useSessionPreparingOrchestrator.ts`; it did not change the ordering truth.

### C. Claim still happens later
`src/app/onboarding-complete/page.tsx` still loads bridge context and runs `claimPublicResultClient(...)` on mount.
So the order is currently:

`onboarding submit -> /session-preparing -> create -> /onboarding-complete -> claim`

### D. Session create requires claimed truth or legacy fallback
`resolveSessionAnalysisInput(...)` resolves in this order:
1. latest **claimed** public result
2. legacy paid deep summary
3. null

`getLatestClaimedPublicResultForUser(...)` only considers rows with `claimed_at IS NOT NULL`.
So bridge-only public users are invisible to session-create until claim is completed.

### E. Error semantics
- `404` here means `ANALYSIS_INPUT_UNAVAILABLE`, assembled intentionally by `/api/session/create`.
- `409` here means request deduped / already processing.
- Therefore `404` is the primary blocked response and `409` is the secondary follow-up symptom.

---

## What this PR is and is not blaming

### Direct regression-causing change
- `e4bb3463434026376344e5f41ef6c874eda1fe29`

### Not the direct cause
The following PR families are **not** the direct root cause of the hang:
- PR52 baseline/session alignment lock
- PR53 alignment_audit
- PR54 selected-truth trace normalization
- PR56/57/58 claimed-result selection ranking refinements
- PR60~63 first-session polish / expressiveness

These may make source selection more explicit or easier to observe, but they did not introduce the create-before-claim ordering inversion.

---

## Broken runtime truth map (current)

### Current owners
- **Public result identity owner:** public result page + bridge storage (`public-result-bridge.ts`)
- **Bridge owner:** localStorage/query bridge
- **Claim owner:** `onboarding-complete`
- **Create owner:** `session-preparing`
- **App entry owner:** `onboarding-complete` -> `/app/home`

### Current broken sequence
1. result execution CTA saves bridge context
2. auth/pay/onboarding continue
3. onboarding submit succeeds
4. `/session-preparing` mounts
5. `createSession()` fires immediately
6. server looks for claimed public result or legacy deep only
7. new public-only user has neither -> `404 ANALYSIS_INPUT_UNAVAILABLE`
8. quick follow-up request -> `409 REQUEST_DEDUPED`
9. route never reaches the intended successful create+complete flow
10. claim owner (`onboarding-complete`) runs too late to rescue the first create

---

## Recovery direction locked in this PR

### Chosen direction
Adopt **Direction 2**:

`/session-preparing` is the real execution-preparation orchestrator and must own:

`bridge -> claim -> create -> success redirect`

It should no longer be treated as staging-only.

### Why this direction
- It matches the current product feel: the user already experiences `session-preparing` as a real preparation screen.
- It directly fixes the actual bug without undoing the route’s current role.
- It keeps claim/create sequencing in one owner.
- It is a better foundation for later pilot-link and guest-preview flows.

---

## Locked recovery truth map (target)

### 1. session-preparing becomes the single execution-preparation owner
On mount:
1. read auth session
2. read bridge context
3. if bridge has `publicResultId`, run `claimPublicResultClient(...)` first
4. only when claim succeeds (`claimed` or `already_owned`), run `createSession(...)`
5. on create success, continue to completion screen

### 2. onboarding-complete stops being the primary claim owner
`onboarding-complete` should remain a success / transition surface, not the first claim owner.
Its responsibility becomes:
- success messaging
- readiness cache clear if needed
- transition into `/app/home`

### 3. bridge clear timing
Bridge clear should not happen before execution truth is safely established.
For this recovery PR, the lock is:
- do **not** lose bridge context on claim failure
- do **not** allow create before claim success
- clear timing must remain deterministic and recovery-safe

Preferred safe law for this PR:
- bridge must survive claim failure
- bridge must not be silently cleared before the flow can reliably continue

### 4. claim failure behavior
If claim fails:
- stop in `session-preparing`
- surface a claim-specific error state
- do not call create
- keep bridge context for retry/recovery

### 5. create failure behavior
If create fails after successful claim:
- stop in `session-preparing`
- surface a create-specific error state
- do not pretend success
- do not auto-route to completion/home

### 6. duplicate-call ownership
Client-side duplicate prevention must be widened from `create` only to the full **claim+create pipeline**.
The owner unit is the entire preparation pipeline, not just the POST to create.

### 7. legacy deep fallback remains intact
If no bridge public result exists but a legacy deep summary exists, existing fallback behavior remains allowed.
This PR must not remove that path.

---

## Minimal file touch set

### Required
- `src/app/session-preparing/useSessionPreparingOrchestrator.ts`
- `src/app/session-preparing/page.tsx`
- `src/app/onboarding-complete/page.tsx`

### Likely reused but not fundamentally redesigned
- `src/lib/public-results/useClaimPublicResult.ts`
- `src/lib/public-results/public-result-bridge.ts`

### Read-only references / no semantic rewrite intended
- `src/lib/session/resolveSessionAnalysisInput.ts`
- `src/app/api/session/create/route.ts`
- `src/app/api/session/create/_lib/request-gate.ts`
- `src/app/api/session/create/_lib/response-assembly.ts`
- `src/app/api/session/create/_lib/generation-input.ts`

---

## Non-goals

This PR must **not**:
- redesign claimed-result ranking policy
- redesign first-session alignment or composition
- change payment meaning
- change readiness meaning globally
- change session-quality heuristics
- rewrite app-home / reset-map UI
- remove legacy deep fallback
- change public result semantics

---

## Acceptance criteria

### Functional
1. New public-only user no longer hits `404 ANALYSIS_INPUT_UNAVAILABLE` on the first normal post-onboarding create attempt.
2. `session-preparing` executes claim before create whenever bridge public result context exists.
3. Claim failure stops before create and preserves recovery context.
4. Create failure after claim is surfaced distinctly from claim failure.
5. `onboarding-complete` is no longer the first point where claim becomes possible.
6. Legacy deep users still create successfully without public-result claim.

### Observability / debugging
7. Logs or local debugging make it obvious whether the failure occurred in claim or create.
8. 409 request-dedupe is no longer the first-visible symptom for the normal fresh-user path.

### Product continuity
9. The user still experiences `session-preparing` as a real execution preparation screen.
10. Successful flows still reach the completion/app-entry path naturally.

---

## Regression checks

Manual regression pack must include:
1. public result -> login -> onboarding -> session-preparing -> success path (fresh public-only user)
2. same path with claimed result already owned
3. legacy deep-only user path
4. claim failure path (bridge retained, no fake success)
5. create failure path after claim success
6. StrictMode/remount duplicate protection path
7. back/refresh during session-preparing

---

## Residual risks to lock during implementation

1. Whether bridge should clear on claim success or create success must remain recovery-safe and explicit.
2. Request-dedupe policy may still create rough retry UX if failed requests keep the dedupe key alive for too long.
3. `onSkipNext` behavior must not bypass the new truth order in a way that reintroduces app-entry-before-truth-establishment.
4. Any doc still describing session-preparing as staging-only must be updated after code recovery.

---

## Recommended implementation workflow

- **Ask / reasoning pass first** for route-owner and retry semantics
- **Sonnet 4.6** for implementation
- Composer can be used afterward for narrow copy / error-surface cleanup only
