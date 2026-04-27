# MOVE RE Pilot Smoke SSOT — 2026-05-01

## 0. Document Status

- **Status:** Parent SSOT for pilot smoke PR chain
- **Scope:** Smoke, readiness, deploy-risk detection only
- **Target pilot window:** 2026-05-01
- **Primary goal:** determine whether MOVE RE can safely accept pilot testers before launch
- **Non-goal:** feature redesign, algorithm retuning, camera engine rewrite, session-composer behavior change

This document is the parent source of truth for all pilot smoke PRs.
Child PRs must reference this file and must not redefine the pilot readiness contract independently.

---

## 1. Pilot Smoke Purpose

The pilot smoke system answers one question:

> Can MOVE RE be released to pilot testers with known and bounded risks?

It does not prove that every product detail is perfect.
It proves that the critical public-first flow, template data, session generation, camera test, auth, and build/deploy path are safe enough for controlled pilot exposure.

The smoke system must classify the repo state into exactly one of:

```txt
READY
READY_WITH_MANUAL_CHECKS
BLOCKED
```

### READY

All required automated checks pass, no hard-fail manual item remains, and deploy prerequisites are confirmed.

### READY_WITH_MANUAL_CHECKS

All required automated checks pass, but one or more explicitly manual checks remain, such as real-device camera validation or live Google/Kakao OAuth validation.

### BLOCKED

At least one hard-fail automated check or hard-fail manual check fails.

---

## 2. Pilot Smoke Principles

### 2.1 Smoke PRs must not change product behavior

Pilot smoke PRs may add scripts, package commands, docs, and diagnostic summaries.
They must not change the core behavior of camera pass, session generation, template selection, auth routing, payment, onboarding, or app execution.

### 2.2 Detection before correction

If a smoke reveals a blocker, fix it in a separate hotfix PR.
Do not silently repair product behavior inside the smoke PR.

### 2.3 SKIP is not success

For pilot readiness, `SKIP` is treated as a failure by default.

Allowed exception:
- A check may be classified as `MANUAL_REQUIRED` only when it depends on live credentials, production Supabase data, provider OAuth consoles, or real-device behavior.
- The script must clearly print why it is manual-required and what exact manual check replaces it.

### 2.4 Fixture success is not production parity

Fixture-48 success proves deterministic generator behavior.
Production readiness still requires template metadata parity with the Supabase `exercise_templates` table.

### 2.5 Camera is frozen for pilot

The camera V2 engine is considered feature-frozen for the pilot gate.
Pilot smoke may verify the V2 chain and document real-device checks.
Pilot smoke must not change V2 owner, V2 pass semantics, threshold policy, final-pass ownership, or recovery windows.

### 2.6 Session composer is verification-first

Recent session work has focused on fixture-48, first-session anchor alignment, S2/S3 continuity, full-rail continuity, adaptive branch behavior, and rationale copy.
Pilot smoke must bundle and expose these checks rather than retune the generator.

---

## 3. Absolute Prohibitions for Child PRs

Child pilot smoke PRs must not modify:

```txt
src/lib/session/plan-generator.ts scoring behavior
src/lib/session/priority-layer.ts scoring/anchor behavior
src/lib/session/constraints.ts product behavior
src/lib/session/ordering.ts product behavior
src/lib/camera/** pass semantics
src/lib/camera/** V2 owner semantics
src/app/movement-test/** capture/pass behavior
src/app/api/session/create/** generation behavior
src/app/api/session/complete/** completion behavior
src/lib/supabase.ts
middleware.ts
next.config.ts
payment routes
onboarding routes
public-result scoring/rendering semantics
/app/home execution flow
ResetMap/AppShell/session player core
Supabase DB write/migration logic
PWA/cache strategy
```

Allowed changes:

```txt
scripts/pilot-*.mjs
docs/pilot/*.md
package.json scripts only
small auth observability changes only when implementing PR-AUTH-OAUTH-OBSERVABILITY-01
```

Any product-behavior hotfix discovered by pilot smoke must be a separate PR with its own SSOT or implementation memo.

---

## 4. Required Pilot Domains

The final pilot gate must cover these domains:

| Domain | Purpose | Gate Type |
|---|---|---|
| Build / Deploy | Confirm app can build and deploy | automated + manual env checklist |
| Template Parity | Confirm fixture-48 and production template metadata are aligned | automated with production env, manual-required otherwise |
| Session Composer | Confirm generated routines are type/phase/adaptive/rationale safe | automated fixture-48 bundle |
| Camera V2 | Confirm squat/overhead pass behavior remains stable | automated smoke + real-device manual |
| Auth OAuth | Confirm Google/Kakao login can be observed and manually validated | automated callback simulation + live manual |
| Release Checklist | Produce final READY / READY_WITH_MANUAL_CHECKS / BLOCKED summary | automated aggregator + manual signoff |

---

## 5. Child PR Roadmap

For speed before 2026-05-01, use the compressed 4-PR chain below.

---

## PR-1 — PR-PILOT-SMOKE-SSOT-00

### Purpose

Create this parent SSOT and lock the pilot smoke contract.

### Files

```txt
docs/pilot/PILOT_SMOKE_SSOT_2026_05_01.md
```

### Allowed Scope

Docs only.

### Acceptance Criteria

- Parent SSOT exists.
- Child PR order is defined.
- Hard-fail, warning, and manual-required semantics are defined.
- Absolute prohibitions are defined.
- No source code changes.

---

## PR-2 — PR-PILOT-TEMPLATE-SESSION-GATE-01

### Purpose

Verify production template metadata and session composer output before the pilot.

### Files Allowed

```txt
scripts/pilot-template-parity-check.mjs
scripts/pilot-session-smoke-bundle.mjs
docs/pilot/PR-PILOT-TEMPLATE-SESSION-GATE-01.md
package.json
```

### Package Scripts To Add

```json
{
  "test:pilot-template-parity": "node scripts/pilot-template-parity-check.mjs",
  "test:pilot-session": "node scripts/pilot-session-smoke-bundle.mjs"
}
```

### Template Parity Checks

The parity check compares production Supabase `exercise_templates` against the deterministic fixture-48 truth.

Hard fail:

```txt
exercise_templates count < 48
any required M01~M48 id missing
phase missing or invalid
target_vector missing or empty
difficulty missing or invalid
progression_level missing or invalid
avoid_if_pain_mode invalid shape
```

Warning:

```txt
media_ref missing
name mismatch
duration_sec mismatch
non-critical display metadata mismatch
```

If production Supabase env is unavailable:

```txt
status = MANUAL_REQUIRED
do not report READY
print exact env keys needed and manual replacement steps
```

### Session Smoke Bundle

The bundle must run the existing session checks in a stable order:

```txt
npm run validate:session-template-fixture
npm run test:first-session-anchor-fixture-48
npm run test:session-2plus-continuity-fixture-48
npm run test:full-rail-type-continuity-fixture-48
npm run test:full-rail-adaptive-branch-fixture-48
npm run test:adaptive-real-next-session
npm run test:session-rationale-copy
npm run test:session-rail-fixture-48
```

Hard fail:

```txt
any command exits non-zero
any command prints unapproved SKIP
first-session anchor fails
S2/S3 continuity fails
full-rail continuity fails
adaptive branch verification fails
rationale copy smoke fails
```

### Non-goals

```txt
No scoring changes
No template metadata mutation
No Supabase writes
No generator retuning
No UI changes
```

---

## PR-3 — PR-PILOT-CAMERA-AUTH-GATE-01

### Purpose

Freeze camera V2 for pilot and make OAuth login failure observable.

### Files Allowed

```txt
scripts/pilot-camera-smoke-bundle.mjs
scripts/pilot-auth-url-smoke.mjs
docs/pilot/PR-PILOT-CAMERA-AUTH-GATE-01.md
docs/pilot/PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md
docs/pilot/PILOT_AUTH_OAUTH_CHECKLIST.md
package.json
```

If PR-AUTH-OAUTH-OBSERVABILITY-01 has not yet been implemented, it may be implemented before or inside this PR only with the previously locked narrow scope:

```txt
src/app/app/auth/page.tsx
src/app/app/auth/AppAuthClient.tsx
src/app/auth/callback/page.tsx
src/app/auth/callback/CallbackClient.tsx
docs/ops/oauth-production-checklist.md
```

### Package Scripts To Add

```json
{
  "test:pilot-camera": "node scripts/pilot-camera-smoke-bundle.mjs",
  "test:pilot-auth": "node scripts/pilot-auth-url-smoke.mjs"
}
```

### Camera Automated Bundle

At minimum, run:

```txt
npm run test:camera-prf-proof-gate
npm run test:camera-pr8-overhead-reach
npm run test:camera-setup-screen
npm run test:voice-waited-cue-completion
```

The bundle may also directly call V2-specific scripts that are not yet exposed in `package.json`, such as PR04B/PR04C/PR04D/PR05/PR05B/PR05C smoke scripts, if they exist in `scripts/`.

Hard fail:

```txt
camera PR-F proof gate fails
V2 owner/recovery smoke fails
overhead reach smoke fails
setup screen smoke fails
voice/cue smoke fails
unapproved SKIP appears
```

### Camera Manual Checklist

The real-device checklist must include:

```txt
shallow squat: 3 attempts, at least 2 natural passes
deep squat: 1 natural pass
standing small movement: must fail
descent-start-only: must fail
seated/bottom hold: must fail
arm-only: must fail
overhead reach: not instant pass, not impossible to pass
no severe frame lag
voice guide does not spam or overlap excessively
pose overlay appears only with explicit diagnostic query flag
```

Manual hard fail:

```txt
shallow squat cannot pass naturally
standing passes as squat
seated/bottom hold passes as squat
arm-only passes as squat
overhead reach passes instantly without meaningful hold
severe frame lag blocks self-serve capture
```

### Auth Automated Smoke

The auth smoke should verify URL/callback failure behavior only.

Cases:

```txt
/auth/callback?provider=google -> /app/auth?error=oauth&provider=google
/auth/callback?provider=kakao -> /app/auth?error=oauth&provider=kakao
/auth/callback?provider=invalid -> /app/auth?error=oauth
```

Hard fail:

```txt
provider context is lost on callback failure
invalid provider is preserved
callback error route crashes
```

### Auth Manual Checklist

Must include:

```txt
Google login succeeds on canonical production domain
Kakao login succeeds on canonical production domain
logout then different account login works
Google login from Instagram in-app browser is checked
Kakao login from KakaoTalk in-app browser is checked
alias domain to canonical redirect behavior is understood
Supabase Site URL is correct
Supabase Additional Redirect URLs include app /auth/callback
Google Cloud Console redirect URI includes Supabase /auth/v1/callback
Kakao Developers redirect URI includes Supabase /auth/v1/callback
Kakao Web platform domain includes canonical origin
```

### Non-goals

```txt
No camera pass logic changes
No V2 threshold changes
No OAuth provider credential changes in code
No payment/onboarding/session routing changes
```

---

## PR-4 — PR-PILOT-BUILD-READY-BUNDLE-01

### Purpose

Add the final pilot readiness aggregator.

### Files Allowed

```txt
scripts/pilot-build-gate.mjs
scripts/pilot-ready-smoke-bundle.mjs
docs/pilot/PR-PILOT-BUILD-READY-BUNDLE-01.md
docs/pilot/PILOT_DEPLOY_ENV_CHECKLIST.md
docs/pilot/PILOT_RELEASE_CHECKLIST_2026_05_01.md
package.json
```

### Package Scripts To Add

```json
{
  "test:pilot-build": "node scripts/pilot-build-gate.mjs",
  "test:pilot-ready": "node scripts/pilot-ready-smoke-bundle.mjs"
}
```

### Build Gate

The build gate must run:

```txt
npm run build
npx tsc --noEmit --pretty false
```

Hard fail:

```txt
npm run build fails
required env key missing for production build
Vercel build cannot be reproduced or explained
```

TSC policy:

```txt
tsc pass = best case
tsc fail = not automatically BLOCKED if already known and documented
unknown new tsc errors touching pilot-critical domains = BLOCKED
ignoreBuildErrors removal is not required before pilot
```

### Final Ready Bundle Order

The final `test:pilot-ready` command must run:

```txt
npm run test:pilot-build
npm run test:pilot-session
npm run test:pilot-template-parity
npm run test:pilot-camera
npm run test:pilot-auth
```

It must print a final summary using this shape:

```txt
MOVE RE PILOT READY CHECK

BUILD
- status
- blockers
- warnings

TEMPLATES
- status
- blockers
- warnings

SESSION
- status
- blockers
- warnings

CAMERA
- status
- blockers
- warnings
- manual_required

AUTH
- status
- blockers
- warnings
- manual_required

FINAL STATUS: READY | READY_WITH_MANUAL_CHECKS | BLOCKED
```

### Status Rules

```txt
If any hard fail exists -> BLOCKED
If no hard fail but manual checks remain -> READY_WITH_MANUAL_CHECKS
If no hard fail and no manual checks remain -> READY
```

### Non-goals

```txt
No product fixes
No build config weakening
No broad dependency upgrades
No ignoreBuildErrors policy change unless separately approved
```

---

## 6. Existing Test Scripts To Reuse

The current repo already includes many scripts that should be reused rather than duplicated.

Session-related:

```txt
validate:session-template-fixture
test:session-rail-fixture-48
test:first-session-anchor-fixture-48
test:session-2plus-continuity-fixture-48
test:full-rail-type-continuity-fixture-48
test:full-rail-adaptive-branch-fixture-48
test:adaptive-real-next-session
test:session-rationale-copy
test:plan-quality-audit
test:session-gen-cache
```

Camera-related:

```txt
test:camera-prf-proof-gate
test:camera-pr8-overhead-reach
test:camera-setup-screen
test:voice-waited-cue-completion
```

Public/result/session source-related:

```txt
test:claimed-result-selection-timing-law
test:claimed-result-selection-suitability
test:result-session-alignment
test:result-session-structural-alignment
test:session-bootstrap
```

Build:

```txt
npm run build
npx tsc --noEmit --pretty false
```

---

## 7. Hard-Fail Matrix

The pilot must be marked BLOCKED if any of the following occurs.

### Build

```txt
npm run build fails
production env configuration cannot be verified
```

### Template

```txt
production exercise_templates has fewer than 48 templates
M01~M48 not all present
required session metadata missing: phase, target_vector, difficulty, progression_level
```

### Session

```txt
first-session anchor fixture fails
S2/S3 continuity fixture fails
full-rail continuity fixture fails
adaptive branch fixture fails
rationale copy smoke fails
session smoke bundle exits non-zero
unapproved SKIP appears
```

### Camera

```txt
camera proof gate fails
V2 smoke fails
shallow squat cannot pass naturally on real device
standing or seated false pass occurs
arm-only false pass occurs
overhead reach instant pass occurs
severe frame lag prevents capture
```

### Auth

```txt
Google login fails on production canonical domain
Kakao login fails on production canonical domain
OAuth callback error loses provider context
provider invalid value is preserved unsafely
```

---

## 8. Warning Matrix

Warnings do not block pilot by themselves, but they must be printed in the final summary.

```txt
tsc still has documented non-blocker errors
media_ref missing for some templates
manual real-device camera checklist not completed
manual OAuth provider console check not completed
alias domain behavior requires explanation
some checks require live production credentials
```

If warnings accumulate enough to make pilot operation risky, the final human decision may still hold release even if automation says READY_WITH_MANUAL_CHECKS.

---

## 9. Manual Signoff Checklist

Before pilot release, manually confirm:

```txt
Public homepage -> test start works
Survey baseline result works
Camera optional refine path works or is intentionally bypassable
Result -> execution start works
Login/signup preserves result continuity
Payment or pilot access path works
Onboarding minimal fields work
Session creation works
/app/home opens with correct reset map
Session panel opens
Exercise player opens
Session completion works
Next visit does not reuse stale legacy session incorrectly
Google login works
Kakao login works
Shallow squat passes naturally
False pass cases fail
Overhead reach behaves acceptably
PWA install prompt/path is acceptable
```

---

## 10. Composer Implementation Rules

For child PR implementation prompts, use these defaults:

```txt
Use PLAN mode first for each child PR.
Read this parent SSOT before any file changes.
Read only the allowed files for that child PR.
Do not inspect broad source files unless the plan proves it is necessary.
Do not modify product logic while building smoke scripts.
If a smoke exposes a product bug, stop and report the blocker instead of fixing inside the smoke PR.
Prefer runner scripts over duplicating test logic.
Preserve existing package scripts.
Add only additive package scripts.
Do not delete existing artifacts or tests.
```

---

## 11. Final Expected Command

At the end of the chain, this command should exist:

```bash
npm run test:pilot-ready
```

Expected final output must include:

```txt
FINAL STATUS: READY
```

or

```txt
FINAL STATUS: READY_WITH_MANUAL_CHECKS
```

or

```txt
FINAL STATUS: BLOCKED
```

No ambiguous final state is allowed.

---

## 12. Post-Pilot Deferred Refactors

The following are important but deferred until after pilot unless a smoke exposes a hard blocker:

```txt
Large plan-generator decomposition
Camera auto-progression structural refactor
Camera trace schema cleanup
Session meta/trace contract cleanup
ignoreBuildErrors removal
Legacy/compat surface deletion
PWA cache strategy refactor
UI redesign
```

Pilot priority is bounded readiness, not architectural perfection.
