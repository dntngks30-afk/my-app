# PR-PILOT-BASELINE-SESSION-ALIGN-01 — Public Baseline Result → Session Composition Alignment Lock

## Parent truth

This PR is for the free pilot flow only.

Canonical pilot surface to protect:
- test → result → reset map
- result shown to the user must be the same truth that drives first session composition
- optional camera refine may enrich, but baseline-only users must still receive a believable first session aligned to the baseline result

## Why this PR exists

Current repo behavior still allows session creation to consume either:
1. latest claimed public result
2. legacy paid deep fallback

That fallback is acceptable as a backward-compatibility mechanism at the platform level, but it is not acceptable as the implicit truth owner for the free pilot measurement path.

The free pilot question is not “can any historical analysis produce a plausible session?”
The free pilot question is:

> when a user completes the public baseline result, does MOVE RE generate a first reset-map session that clearly matches that very result?

Right now that truth is not locked strongly enough.

## Confirmed repo findings

### 1. Session creation source is still dual-owned
- `src/lib/session/resolveSessionAnalysisInput.ts`
- ownership order is latest claimed public result, then legacy paid deep fallback

### 2. Public result is adapted into SessionDeepSummary through a lossy bridge
- `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts`
- primary_type is converted into:
  - session band result_type
  - focus tags
  - avoid tags
- this adapter is the real bridge between public result and session generation

### 3. Session generator composes from SessionDeepSummary, not directly from public baseline semantics
- `src/app/api/session/create/_lib/generation-input.ts`
- `src/app/api/session/create/_lib/plan-materialize.ts`
- `src/lib/session/plan-generator.ts`

### 4. First-session intent is anchored mainly by legacy-style `resultType`
- `src/lib/session/priority-layer.ts`
- first-session composition is driven by:
  - `resultType`
  - optional `priority_vector`
  - pain mode / safety mode
- this means public baseline semantics only influence composition correctly if the adapter maps them correctly

## Core problem to lock

The first session shown on reset map can drift away from the public baseline result because:
- source truth may fall back to legacy paid deep
- public primary_type to session intent mapping is still broad / legacy-band oriented
- first-session rationale and segment composition may be technically valid but not feel aligned to the result the user just saw

## PR purpose

Lock the first reset-map session so that for free pilot baseline users:
- the public baseline result is the single truth owner for session-1 composition
- the first session visibly matches the user-facing baseline result category
- the rationale, focus axes, gold-path selection, and template composition all align to the same baseline result

## Scope

### In scope
1. Public baseline result → session creation source lock for pilot path
2. Public baseline primary_type/result_type → first-session intent alignment refinement
3. First-session composition rules for each baseline result family
4. First-session rationale alignment to baseline result wording
5. Observability to prove which source and which alignment path generated session 1

### Out of scope
- camera evaluator logic
- public result page UI redesign
- payment / checkout logic
- later-session adaptive engine redesign
- broad refactor of reset map UI
- full template taxonomy redesign beyond what is needed for baseline alignment

## Locked truths after this PR

### Truth 1 — baseline-first source ownership
For the free pilot baseline path, session 1 must be generated from the claimed public baseline result.
Legacy paid deep fallback must not silently own pilot session-1 generation for users who have a fresh claimed public baseline result.

### Truth 2 — user-facing result category must match first-session intent
The first session must not merely be “safe” or “plausible.”
It must be recognizably aligned with the public baseline category the user just saw.

### Truth 3 — rationale, focus axes, and actual exercise mix must agree
The following must point in the same direction:
- public baseline result type
- session rationale
- session_focus_axes
- gold path vector
- main segment template mix

### Truth 4 — baseline-only users must still get a strong first session
Camera is optional refine.
Baseline-only users must not receive a vague generic core session unless their baseline result genuinely implies that.

## Exact design direction

### A. Source lock for pilot session generation
Refine session analysis input resolution so the pilot baseline path prefers:
1. claimed public result from the just-completed public flow
2. if none exists, explicit fallback path with observability

The important lock is not merely preference order.
It is explicit measurement truth:
- source mode must be visible in generation trace
- fallback usage must be auditable, not silent

### B. Replace broad legacy-band feeling with baseline-specific first-session intent
Current mapping compresses public primary types into legacy session bands.
That is useful for compatibility, but too broad for pilot trust.

The first session should be defined baseline-first like this:

#### LOWER_INSTABILITY
Goal:
- lower-chain stability first
- glute / pelvis / lower stability activation before harder control work

Desired session feel:
- “하체 안정” type session
- not upper-focused
- not generic core-only

Preferred composition:
- Prep: trunk_control or low-intensity lower mobility prep
- Main: lower_stability dominant
- Accessory: lower_stability or trunk support
- Cooldown: lower mobility / decompression

#### LOWER_MOBILITY_RESTRICTION
Goal:
- hip/ankle mobility restoration first
- avoid making the first session feel like pure strength work

Desired session feel:
- “가동성 회복” type session
- mobility first, not glute-strength-first unless used as support

Preferred composition:
- Prep: lower mobility opener
- Main: lower mobility dominant
- Accessory: trunk support or light lower mobility integration
- Cooldown: mobility / release

#### UPPER_IMMOBILITY
Goal:
- thoracic / shoulder mobility first
- shoulder range and upper movement organization first

Desired session feel:
- clearly upper-body movement restoration
- must not read like core-only or lower-body-first

Preferred composition:
- Prep: thoracic / shoulder opening
- Main: upper mobility dominant
- Accessory: upper mobility or trunk support
- Cooldown: upper mobility release

#### CORE_CONTROL_DEFICIT
Goal:
- trunk connection, breathing, core control first
- must feel like body-center stabilization, not upper mobility session

Desired session feel:
- clearly trunk/core organization
- not generic stretching-only

Preferred composition:
- Prep: low-threat trunk prep / breathing / gentle mobility
- Main: trunk_control dominant
- Accessory: lower stability support or trunk continuation
- Cooldown: decompression / reset

#### DECONDITIONED
Goal:
- low-threat whole-body re-entry
- reduce intimidation, increase completion likelihood

Desired session feel:
- easiest believable reset session
- never dense or aggressive

Preferred composition:
- Prep: deconditioned / gentle prep
- Main: deconditioned or trunk_control low difficulty
- Accessory: very low complexity support
- Cooldown: gentle release

#### STABLE
Goal:
- light balanced reset, not medicalized correction

Desired session feel:
- balanced maintenance / movement reset
- avoid over-pathologizing

Preferred composition:
- mixed but still coherent
- keep first session simple and confidence-building

### C. Session 1 must be visibly type-matched in the Main segment
At least one dominant Main item must clearly match the baseline result family.
The first session must not rely only on rationale text to claim alignment.
The actual Main segment must show it.

### D. Rationale lock
Session rationale must be generated from the same baseline intent that drove composition.
It must not say upper-body while the Main segment is trunk-dominant, or say mobility while the Main segment is activation-heavy.

### E. Observability lock
Generation trace for session 1 should explicitly record:
- analysis_source_mode
- source_public_result_id
- baseline primary_type
- resolved session result_type / gold path
- first-session intent anchor
- whether fallback or compatibility mapping was used

## Proposed implementation split

### PR slice 1 — source and intent lock
Files likely touched:
- `src/lib/session/resolveSessionAnalysisInput.ts`
- `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts`
- `src/lib/session/priority-layer.ts`

Purpose:
- make baseline truth ownership explicit
- make first-session intent baseline-specific, not merely legacy-band-compatible

### PR slice 2 — generator composition lock
Files likely touched:
- `src/lib/session/plan-generator.ts`
- possibly rationale helper usage only if needed

Purpose:
- ensure Main segment visibly matches baseline result family
- keep difficulty/safety guardrails intact

## Non-goals / prohibitions
- do not rewrite the whole adaptive engine
- do not redesign reset map UI in this PR
- do not remove safety gates
- do not make camera mandatory
- do not collapse all baseline types into the same generic core session
- do not silently preserve legacy fallback behavior without traceability

## Acceptance criteria

### Functional
1. A fresh claimed public baseline result generates session 1 from public result source, not silent legacy fallback
2. Session 1 rationale, focus axes, and Main segment agree with the baseline result family
3. Baseline-only LOWER/UPPER/CORE users receive recognizably different first-session compositions
4. UPPER baseline cannot produce core-only-feeling session 1
5. LOWER_MOBILITY baseline cannot produce lower-stability-dominant first session unless clearly justified as support

### Observability
6. Generation trace makes source and first-session intent auditable
7. Fallback usage is explicitly visible

### Product trust
8. A user who sees the baseline result should feel that the first reset-map session obviously follows from that result

## Regression checks
- existing safety_mode caps must remain intact
- pain_mode filtering must remain intact
- camera refined path must still be able to enrich composition later
- session 2+ adaptive path must remain additive and not be rewritten here

## Recommended model
- **SONNET 4.6** for the structural/source-of-truth and first-session policy parts
- **COMPOSER** is sufficient only for follow-up copy/renderer adjustments after the composition truth is locked
