# PR-SESSION-PREPARING-BRIDGE-PERSIST-02

## Problem summary

Pilot/public-first users who complete the public test, finish onboarding, and reach
`/session-preparing` see `/api/session/create` fail with:

```json
{ "ok": false, "error": { "code": "ANALYSIS_INPUT_UNAVAILABLE" } }
```

The session create API requires either a **claimed** public result row in the DB or a
legacy paid deep summary fallback. A public result is created after test completion but,
without a claim step, it is invisible to `resolveSessionAnalysisInput`.

---

## Root cause

Three independent gaps combined to break the `claim → create` contract:

### Gap 1 — `OnboardingPrepClient` dropped query params without saving to bridge

`/onboarding-prep?publicResultId=abc&stage=baseline` was read by the component but never
written to `moveReBridgeContext:v1`. The component then called `router.push('/onboarding')`
without query params, so the publicResultId was lost.

```
/onboarding-prep?publicResultId=abc&stage=baseline
  → [identity read from URL]
  → router.push('/onboarding')         ← query gone
  → /session-preparing
  → loadBridgeContext() === null        ← claim skipped
  → createSession()                     ← ANALYSIS_INPUT_UNAVAILABLE
```

### Gap 2 — `useExecutionStartBridge` active path skipped bridge save

When a user is already active (`plan_status === 'active'`), the bridge was not saved
before navigating to `/onboarding-prep`. Only the unauthenticated and inactive paths
called `saveBridgeContext`. If the URL query was then dropped by onboarding (gap 1),
and the bridge was never saved from this path, `/session-preparing` had nothing to claim.

### Gap 3 — `clearBridgeContext` ran before `createSession`

Inside `runPipeline`, `clearBridgeContext()` was called immediately after claim success
but **before** `createSession`. If `createSession` failed, the bridge was already gone,
making retry and recovery impossible.

---

## Changed files

| File | Change |
|------|--------|
| `src/app/onboarding-prep/_components/OnboardingPrepClient.tsx` | Save valid query params to bridge on mount |
| `src/lib/public-results/useExecutionStartBridge.ts` | Add `saveBridgeContext` to active-user path before `router.push` |
| `src/app/session-preparing/useSessionPreparingOrchestrator.ts` | Move `clearBridgeContext` to after `createSession` succeeds |

---

## Fixed sequence

```
public test complete
  → publicResultId returned
  → "실행 시작" CTA
  → useExecutionStartBridge
      (unauthenticated) saveBridgeContext → /app/auth
      (inactive)        saveBridgeContext → checkout or pilot redeem → /onboarding-prep
      (active)          saveBridgeContext → /onboarding-prep          ← NEW
  → /onboarding-prep?publicResultId=abc&stage=baseline
      [OnboardingPrepClient mount]
      saveBridgeContext({publicResultId, resultStage, anonId})         ← NEW
      setHasContext(true)
  → router.push('/onboarding')     ← query dropped but bridge is now in localStorage
  → /session-preparing
      loadBridgeContext() returns {publicResultId: abc, ...}
      POST /api/public-results/abc/claim
      POST /api/pilot/redeem (if pilot context present)
      POST /api/session/create
      createSession succeeds
      clearBridgeContext()                                              ← NEW position
  → /onboarding-complete
  → /app/home
```

---

## What is intentionally not changed

- `/api/session/create` semantics — no server-side change
- `resolveSessionAnalysisInput` — still requires claimed public result or legacy deep
- public result V2 schema — no schema change
- `/app/home`, ResetMapV2, SessionPanelV2 — untouched
- session composition / scoring / readiness global semantics — untouched
- payment meaning — untouched
- legacy deep fallback — preserved: if no bridge, pipeline still calls `createSession`
  which succeeds for users with a legacy deep summary

---

## Key invariants locked by this PR

1. `/onboarding-prep` query `publicResultId` is now persisted to bridge on mount.
2. Active-user path (`plan_status === active`) now saves bridge before any navigation
   toward onboarding-prep or onboarding.
3. Bridge is no longer cleared before `createSession` success.
4. `createSession` still depends on claimed public result or legacy deep fallback
   (not on bridge contents directly).
5. If claim fails, `createSession` is not called.
6. Bridge survives claim failure and create failure for retry/recovery.

---

## Manual verification checklist

### Fresh pilot user (main target)
- [ ] Open DevTools Application → Local Storage.
- [ ] Complete public test as new user.
- [ ] Click "실행 시작" → redirects to login/onboarding-prep.
- [ ] At `/onboarding-prep`, confirm `moveReBridgeContext:v1` is present in localStorage.
- [ ] Complete onboarding form and submit.
- [ ] At `/session-preparing`, confirm DevTools Network shows:
  - `POST /api/public-results/{id}/claim` fires first
  - `POST /api/session/create` fires after
  - No `ANALYSIS_INPUT_UNAVAILABLE` response
- [ ] Confirm successful redirect to `/onboarding-complete` then `/app/home`.
- [ ] Confirm `moveReBridgeContext:v1` is removed from localStorage after success.

### Already active user re-entering flow
- [ ] As an active user, navigate to public result page and click "실행 시작".
- [ ] Confirm bridge is saved before redirect to `/onboarding-prep`.
- [ ] Same claim → create sequence as above.

### Incognito / new account
- [ ] Start from pilot link in incognito.
- [ ] Complete test, create account, proceed to onboarding.
- [ ] Verify same sequence.

### Claim failure path
- [ ] Manually inject invalid publicResultId into `moveReBridgeContext:v1`.
- [ ] At `/session-preparing`, confirm claim fails and `createSession` is NOT called.
- [ ] Confirm bridge context is preserved after claim failure.

### Legacy deep-only user
- [ ] Log in as user with only legacy paid deep summary (no public result).
- [ ] Navigate to `/session-preparing`.
- [ ] Confirm no claim request fires (bridge is empty).
- [ ] Confirm `createSession` is called and succeeds via legacy fallback.

### StrictMode / remount
- [ ] Refresh or re-navigate to `/session-preparing` during active session.
- [ ] Confirm only one claim and one create request in Network tab.
- [ ] Module-level `sessionPreparingPipelineInflight` dedupe remains effective.

---

## Rollback plan

All three changes are in client-side files only, with no server-side or DB changes.
To rollback:

```bash
git revert HEAD  # reverts the single commit for this PR
```

Individual file rollback if needed:

```bash
git checkout HEAD~1 -- src/app/onboarding-prep/_components/OnboardingPrepClient.tsx
git checkout HEAD~1 -- src/lib/public-results/useExecutionStartBridge.ts
git checkout HEAD~1 -- src/app/session-preparing/useSessionPreparingOrchestrator.ts
```

Rollback does NOT require DB migration or Vercel config changes.

---

## Related PRs

- `PR-SESSION-PREPARING-CLAIM-CREATE-ORDER-RECOVERY-01` — established `claim → create`
  order inside `useSessionPreparingOrchestrator`; this PR fixes the upstream bridge
  persistence that feeds that order.
- `PR-PILOT-ENTRY-01` — pilot code attribution at root landing (not modified here).
- `PR-PILOT-ENTITLEMENT-02` — `redeemPilotAccessClient` (not modified here).
