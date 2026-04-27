# PR-TEMPLATE-48-METADATA-ALIGN-01 — Final Plan (with Review Addendum)

**Status:** planning / implementation spec  
**Scope lock:** M29~M48 session-composer metadata + deterministic 48-template harness + validation. **Not** an algorithm or scoring rewrite.

---

## 1. Root Cause: Why 28 templates appear in harness / local

1. **[`exercise-templates.ts`](../src/lib/workout-routine/exercise-templates.ts)** defines only **M01~M28** in `EXERCISE_TEMPLATES`.
2. **[`session-rail-truth-harness.mjs`](../scripts/session-rail-truth-harness.mjs)** `loadTemplates()` uses DB first; on recoverable failure it maps `EXERCISE_TEMPLATES` → `template_pool_source: static (28)` and **no M29~M48**.
3. Artifacts are easy to misread as “full system” validation when they are **28-pool** runs.

---

## 2. Production fetch truth

- [`getTemplatesForSessionPlan`](../src/lib/workout-routine/exercise-templates-db.ts): `is_active`, `scoring_version=deep_v2`, **`limit(60)`** — **48 rows** fit if present.
- M29~M48 rows exist from seed, but **session-composer fields** were not in the initial INSERT; meta patch covered **M01~M28 only** — M29~M48 need **this PR’s backfill** for reliable ranking/segment fit.

---

## 3. M29~M48 metadata gap

- [`202603211200_exercise_templates_m29_m48.sql`](../supabase/migrations/202603211200_exercise_templates_m29_m48.sql) INSERT omits `phase`, `target_vector`, `difficulty`, `progression_level`, `avoid_if_pain_mode`.
- [`202603190001_exercise_templates_meta_patch.sql`](../supabase/migrations/202603190001_exercise_templates_meta_patch.sql) updates **M01~M28 only**.
- [`202603230001_exercise_templates_metadata_v2_backfill.sql`](../supabase/migrations/202603230001_exercise_templates_metadata_v2_backfill.sql) backfills `balance_demand`/`complexity` for M29~M48 but **not** the five composer fields.
- [`20260419120001_template_name_refresh_from_manifest.sql`](../supabase/migrations/20260419120001_template_name_refresh_from_manifest.sql) updates **display names** for M01~M48 **only** (semantic drift risk vs original `focus_tags` / `contraindications` — see **§4 Addendum B**).

---

## 4. Addendum A — M18: out of scope for this PR (default)

- **Do not** modify M01~M28 in this PR by default.
- **M18** (양발 카프 레이즈) metadata questions remain **follow-up PR** material only.
- **Only** include M18 if it were strictly required for M29~M48 validation — **it is not**; **exclude M18** from this PR.

---

## 5. Addendum B — Semantic mismatch audit: M30, M44, M46 (mandatory)

Do **not** treat M29~M48 as “phase/vector only.” After [`20260419120001`](../supabase/migrations/20260419120001_template_name_refresh_from_manifest.sql), **final names** can disagree with **original** `focus_tags` / `contraindications` from the insert.

| ID | Final name (manifest) | Risk |
|----|------------------------|------|
| **M30** | 쿼드러펫 숄더탭 (was deadbug family in seed) | Audited: `wrist_load` (seed has on M31) — **M30** seed: `lower_back_pain` only, no `wrist_load`. Quadcrawl shoulder tap → **consider adding `wrist_load`**; **confirm** whether `lower_back_pain` should remain. |
| **M44** | 딥 스쿼트 (was wall deep squat hold naming) | Audited: seed `knee_load` only. Rationale: `deep_squat` in **tag_codebook** is used elsewhere for contraindication — **decide** if `contraindications` should include `deep_squat` in addition to `knee_load`. `avoid_if_pain_mode`: typically `['caution','protected']` if aligned with M16-class deep patterns. **Either** minimal SQL patch in this PR **or** follow-up + fixture row documents “DB as-is” until then — **no silent ignore**. |
| **M46** | 스탠딩 오픈북 (replaces 프론 Y 레이즈 in manifest row) | Seed: `upper_back_activation`, `shoulder_mobility`, `shoulder_overhead`. Open-book pattern → **audit** if `thoracic_mobility` belongs in `focus_tags`; **audit** if `shoulder_overhead` remains valid. **Decide** same PR vs follow-up; document fixture accordingly. |

**Rule:** If `focus_tags` or `contraindications` **clearly** conflict with final exercise meaning after clinical/product review, choose:

1. **Minimal corrective UPDATE** in this PR (or same migration file as backfill), **or**
2. **Explicit follow-up PR** and fixture/harness text states **“carrying current DB semantics (see ISSUE-xxx)”** — not silent.

If M30/M44/M46 become controversial, **split** clinical tag/contraindication work per **Addendum G**.

---

## 6. Addendum C — Fixture-48: deterministic, not blind DB dump

- Checked-in **fixture** must be **reproducible** and aligned with, in order:
  1. Current **M01~M28** metadata as defined in DB migrations (or explicit TS parity rules if script-generated).
  2. M29~M48 **insert** + **name manifest** + **this PR’s M29~M48 composer backfill** (and any agreed tag/contra fixes from §5).
- **Do not** ship an uncontrolled one-off production export as SSOT.
- **Row shape** must match `getTemplatesForSessionPlan` mapping (all fields the client reads):

| Field | Type |
|-------|------|
| `id` | string |
| `name` | string |
| `level` | number |
| `focus_tags` | string[] |
| `contraindications` | string[] |
| `duration_sec` | number |
| `media_ref` | unknown |
| `is_fallback` | boolean |
| `phase` | string \| null |
| `target_vector` | string[] \| null |
| `difficulty` | string \| null |
| `avoid_if_pain_mode` | string[] \| null |
| `progression_level` | number \| null |
| `balance_demand` | string \| null |
| `complexity` | string \| null |

---

## 7. Addendum D — `scripts/validate-session-template-fixture.mjs` (new)

**Required checks**

- Row count **exactly 48**
- IDs **M01~M48** all present, unique
- **M29~M48:** `phase` non-null, `target_vector` non-empty array, `difficulty` non-null, `progression_level` non-null
- `avoid_if_pain_mode` is an **array** (may be `[]`)
- `phase` ∈ {`prep`,`main`,`accessory`,`cooldown`}
- `difficulty` ∈ {`low`,`medium`,`high`}
- `target_vector` elements ⊆ **known generator axes** (e.g. `lower_stability`, `lower_mobility`, `upper_mobility`, `trunk_control`, `asymmetry`, `deconditioned` — and `balanced_reset` only if code path explicitly allows; align with [plan-generator `GOLD_PATH_VECTORS`](../src/lib/session/plan-generator.ts) + product)

**CI / local:** e.g. `node scripts/validate-session-template-fixture.mjs path/to/fixture.json` exit non-zero on failure.

---

## 8. Addendum E — Harness output: `template_count` + `template_pool_source`

- Every harness artifact (or per-run summary) must include **both**:
  - `template_pool_source` (e.g. `fixture_m01_m48_session_plan_v1`, `supabase_deep_v2`, `static_exercise_templates_28`)
  - `template_count` (e.g. **48** for fixture/DB-48, **28** for static fallback)
- **Source label alone is insufficient** for reviewers/CI.

---

## 9. Addendum F — Session 2 / Session 3: semi-quantitative validation

For **each** `primary_type` × **freq2**, inspect **session_number 2 and 3** (not only 1).

**Minimum fields per session row**

- `main_segment_template_ids`
- Each main item: `target_vector`, `focus_tags` (from resolved template row)
- Prep + Cooldown: `templateId`s and `focus_tags`
- `template_pool_source`, `template_count`

**Criteria (same as product brief, made checkable)**

| primary_type | Pass heuristic |
|--------------|-----------------|
| **LOWER_INSTABILITY** | Main **lower_stability**-aligned dominant; trunk support OK; **upper_mobility** not on **2+** main items. |
| **LOWER_MOBILITY_RESTRICTION** | **lower_mobility** visible across prep/main/cd; lower_stability support OK; **upper_mobility** not on 2+ mains. |
| **UPPER_IMMOBILITY** | Main **upper_mobility** dominant; trunk OK; **lower_stability** not on 2+ mains. |
| **CORE_CONTROL_DEFICIT** | Main **trunk_control** dominant; hip/thoracic support OK; **not** upper-only or lower-only dominating mains. |
| **DECONDITIONED** | Full-body / trunk OK; **high-complexity unilateral lower** not dominating early (S2–S3). |
| **STABLE** | Balanced exposure; no single high-risk axis dominating early. |

**Optional:** add a small **diff script** comparing `artifacts/session-rail-28` vs `...-48` for the same case_label.

---

## 10. Files to modify (execution PR)

**MUST**

- New **additive** migration: M29~M48 session-composer backfill + any **minimal** M30/M44/M46 `focus_tags`/`contraindications` agreed in §5.
- **Deterministic** `scripts/fixtures/…` (name TBD) — 48 rows, validated by `validate-session-template-fixture.mjs`.
- `scripts/validate-session-template-fixture.mjs` (new).
- `scripts/session-rail-truth-harness.mjs`: `--template-source fixture-48` (or equivalent), `template_count` + `template_pool_source` in output JSON.

**MUST NOT (this PR)**

- M01~M28 metadata changes **except** if you explicitly split a follow-up; **M18 excluded** (§4).
- primary_type / Deep Result / public / camera / auth / pay / session create contract / app UI / SessionPanelV2 / ExercisePlayerModal / Mux execution paths.

**MAY (split PR)**

- Controversial **clinical** rewrites of M30/M44/M46 tags/contraindications.

---

## 11. Addendum G — One PR scope (final)

**One PR** is appropriate **only** if it includes **all** of:

1. M29~M48 session-composer **metadata backfill** (and only **minimal** tag/contra fixes for M30/M44/M46 if product signs off; else defer + document).
2. **Deterministic** fixture-48 + **validation script** (§6–§7).
3. Harness **fixture-48** mode + **`template_count`** in artifacts (§8).
4. **Semi-quantitative** S2/S3 inspection plan (§9).

**Split** a **second** PR if M30/M44/M46 focus_tags/contraindications changes become **clinically controversial** (clinical metadata PR after audit).

---

## 12. Test commands (suggested)

```bash
node scripts/validate-session-template-fixture.mjs scripts/fixtures/<fixture-48>.json

npx tsx scripts/session-rail-truth-harness.mjs --mode static-neutral --template-source fixture-48 --out-dir artifacts/session-rail-48
npx tsx scripts/session-rail-truth-harness.mjs --mode all --template-source fixture-48 --out-dir artifacts/session-rail-48

npm run test:plan-generator
npm run test:result-session-alignment
```

(Exact harness flags to match implementation.)

---

## 13. Acceptance criteria

- [ ] Fixture validates with **0** errors; **48** rows; M29~M48 composer fields as in §7.
- [ ] Artifacts show **`template_pool_source` + `template_count`**.
- [ ] S2/S3 per primary_type×freq2 reviewed with fields in §9.
- [ ] M30/M44/M46 mismatch **addressed** (fix or explicit defer + documented fixture semantics).
- [ ] No M18 change; no M01~M28 change unless out-of-scope follow-up.
- [ ] `limit(60)` unchanged; no UI/Mux/scoring/primary_type/session-create changes.

---

## Reference: generator vocabulary

- `phase`: prep | main | accessory | cooldown  
- `target_vector`: lower_stability | lower_mobility | upper_mobility | trunk_control | asymmetry | deconditioned | (balanced_reset per code usage)  
- `difficulty`: low | medium | high  
- `avoid_if_pain_mode`: `[]` | `['caution']` | `['protected']` | `['caution','protected']` as needed  

---

*Document incorporates Review Addendum A–G. Implementation order: migration backfill → fixture generation from repo truth → validate script → harness flags & artifact fields → S2/S3 review.*

## Implementation (landed in repo)

- **DB:** [20260427120000_exercise_templates_m29_m48_session_composer_v1.sql](../supabase/migrations/20260427120000_exercise_templates_m29_m48_session_composer_v1.sql) — M30/M44/M46 semantic + M29~M48 composer backfill.
- **Fixture (deterministic):** run `node scripts/compose-exercise-template-fixture.mjs` → [scripts/fixtures/exercise-templates-session-plan-m01-m48.v1.json](../scripts/fixtures/exercise-templates-session-plan-m01-m48.v1.json)
- **Validate:** `npm run validate:session-template-fixture` (or `node scripts/validate-session-template-fixture.mjs <path>`)
- **Harness:** `npx tsx scripts/session-rail-truth-harness.mjs --template-source fixture-48 --out-dir artifacts/session-rail-48` — artifacts include `template_pool_source` and `template_count` (48).
- **NPM:** `test:session-rail-fixture-48`, `validate:session-template-fixture` in [package.json](../package.json).
