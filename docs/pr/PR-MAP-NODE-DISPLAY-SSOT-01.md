# PR-MAP-NODE-DISPLAY-SSOT-01 — Map node display truth hierarchy and panel alignment

## Parent SSOT purpose

This document locks the display-source-of-truth strategy for the Home Reset Map session nodes so that:

- the map keeps the existing compact 2-line node surface,
- the node label/subtitle stop drifting away from the SessionPanel goal/rationale,
- adaptive session generation after session 1 remains compatible,
- far-future nodes can stay lightweight without pretending to know final generated truth.

This is a **parent SSOT** for follow-up implementation PRs. It is not the implementation itself.

---

## Problem

Current truth ownership is structurally split:

1. `src/app/app/(tabs)/home/_components/reset-map-v2/map-data.ts` predefines node `label` and `description` for sessions 1..20 as static display text.
2. `ResetMapV2` and `SessionPanelV2` derive panel goal/rationale from real session data loaded at runtime through:
   - active plan
   - plan summary
   - bootstrap
   - next-session preview / recovery path
3. Session 2+ can be generated/adapted differently depending on user state, completed history, bootstrap result, pain mode, experience guardrail, and later adaptive inputs.

Therefore a static map string for every future node cannot remain reliably aligned with a panel whose content is resolved from real runtime session truth.

The product issue is not visual density. The issue is **truth drift** between:

- map node label/subtitle
- panel goal block
- actual generated session intent

---

## Product law

Keep the map visually minimal.

Each node should continue to expose only:

- one large role-like label
- one short supporting subtitle

Do **not** solve this by adding extra chips, paragraphs, badges, confidence bars, or technical metadata onto the map.

The fix must come from **unifying display truth**, not from adding more UI.

---

## Core decision

Introduce a **3-tier truth hierarchy** for map node display:

1. **confirmed truth** — use real generated/stored session truth when available
2. **preview truth** — use bootstrap / next-session preview truth when the final session is not yet created but a near-term preview exists
3. **placeholder arc truth** — use only a stage/arc placeholder for far-future sessions that do not yet have real session truth

This is the only structure that allows:

- exact alignment for current/completed/near-next sessions,
- graceful approximation for far-future sessions,
- no false promise that all 20 future nodes already know their final panel content.

---

## Truth ownership by session distance

### A. Confirmed node

A node is **confirmed** when the app has actual plan/meta truth for that session.

Typical examples:

- completed sessions
- current session
- any session whose summary/full plan is already available

Display requirement:

- map label/subtitle must be derived from the same meta family used by SessionPanel
- panel and map must not drift for confirmed nodes

### B. Preview node

A node is **preview** when the app does not yet have the final stored session, but does have near-term resolved preview truth.

Typical examples:

- next session with bootstrap response
- locked-next session with usable next-session preview

Display requirement:

- map label/subtitle must come from preview truth, not from a static long-range placeholder
- this is the best available truth for the next session and should override static fallback copy

### C. Placeholder node

A node is **placeholder** when neither real plan truth nor preview truth exists.

Typical examples:

- sessions beyond next/near-next
- future nodes that have not been bootstrapped/generated yet

Display requirement:

- map may show only stage/arc-level intent
- placeholder text must be treated as provisional, not final session truth
- placeholder text must be easy to override once preview or confirmed truth becomes available

---

## Display contract

Each node should resolve to one normalized display object before rendering.

```ts
export type SessionNodeDisplayState = 'confirmed' | 'preview' | 'placeholder'

export type SessionNodeDisplay = {
  sessionNumber: number
  state: SessionNodeDisplayState

  roleCode: string
  roleLabel: string

  goalCode: string
  goalLabel: string

  subtitle: string

  source:
    | 'active_plan'
    | 'summary'
    | 'bootstrap'
    | 'next_preview'
    | 'arc_template'

  confidence: 'high' | 'medium' | 'low'
}
```

The map renderer should consume this object, not raw static `label` / `description` text as final semantic truth.

---

## Source priority

For a given session node, display truth should resolve in this priority order:

1. active full plan meta
2. cached/loaded session summary meta
3. bootstrap meta
4. usable next-session preview meta
5. arc placeholder template

Interpretation:

- if real plan truth exists, use it
- else if near-term preview exists, use it
- else fall back to stage placeholder

No lower-priority source may override a higher-priority one.

---

## Map data ownership change

`map-data.ts` currently carries semantic display strings as if they were final truth.

That ownership must change.

### Locked change

`map-data.ts` should become:

- geometry / coordinates / terrain / visual route data
- node ids / type / structural metadata
- optional fallback stage seed only

It should **not** remain the long-term owner of final node meaning for sessions 1..20.

### Implication

Static strings such as current `label` and `description` must be demoted to one of:

- arc placeholder seed
- migration fallback only

They must no longer be treated as canonical truth once runtime session meta exists.

---

## Shared display-copy layer

The map and SessionPanel must stop inventing separate interpretations from different logic paths.

Introduce a shared copy-building layer that accepts session meta and returns display-ready copy for both surfaces.

Example shape:

```ts
buildSessionDisplayCopy(meta) => {
  roleCode,
  roleLabel,
  goalCode,
  goalLabel,
  subtitle,
  panelHeadline,
  panelChips,
}
```

Usage:

- map node uses: `roleLabel`, `subtitle`
- panel uses: `goalLabel`, `panelHeadline`, `panelChips`

Rule:

Different surfaces may show different **depth**, but not different **truth ownership**.

---

## Session meta contract extension

To support exact alignment, near-term session truth must carry explicit display-level intent.

The relevant plan/meta shape should support these fields when available:

```ts
meta: {
  session_role_code?: string
  session_role_label?: string

  session_goal_code?: string
  session_goal_label?: string
  session_goal_hint?: string

  session_rationale?: string
  session_focus_axes?: string[]
  pain_mode?: 'none' | 'caution' | 'protected'
}
```

Notes:

- `session_role_*` = journey-stage style label for the big map text
- `session_goal_*` = actual session target family
- `session_goal_hint` = short map subtitle
- `session_rationale` / `session_focus_axes` continue to support panel explanation

This does **not** require more map UI. It only standardizes source fields.

---

## Role and goal taxonomy

The visible vocabulary should stay small and repeatable.

### Role layer (large map label)

Recommended bounded set:

- 적응
- 정렬
- 안정
- 확장
- 균형
- 통합
- 회복

### Goal layer (supporting subtitle / panel goal family)

Recommended bounded set:

- 전신 준비
- 호흡 정렬
- 코어 안정성
- 하체 안정성
- 하체 가동성
- 상체 가동성
- 좌우 균형
- 부담 완화 회복

The system should not try to invent 20 unique poetic names just because the user has 20 sessions.

The right model is:

- small bounded display taxonomy
- repeated but meaningful progression
- actual runtime override when real session truth becomes available

---

## Placeholder arc policy

Far-future sessions must use only an arc-template approximation.

For example, a 20-session program may be shaped as:

- sessions 1–3: 적응 / 전신 준비 · 호흡 정렬
- sessions 4–7: 안정 / 코어 안정성 · 하체 안정성
- sessions 8–11: 확장 / 상체 가동성 · 하체 가동성
- sessions 12–15: 균형 / 좌우 균형 · 몸통 제어
- sessions 16–18: 통합 / 전신 연결
- sessions 19–20: 회복 / 부담 완화 · 정리

This placeholder arc is not a promise of final generated session truth.
It is only a pre-generation display scaffold.

Once preview or confirmed truth exists, it must override the placeholder.

---

## Resolver requirement

Before rendering the map, the app must resolve each node through a dedicated display resolver.

Conceptually:

```ts
resolveSessionNodeDisplay({
  sessionNumber,
  completed,
  currentSession,
  activePlan,
  summaryCache,
  bootstrapCache,
  nextPreview,
  arcTemplate,
})
```

Required behavior:

- if real plan/summary truth exists -> confirmed
- else if bootstrap or usable next preview exists -> preview
- else -> placeholder

This resolver becomes the only place that decides node display truth source.

---

## UI policy

Do not visibly expose `confirmed/preview/placeholder` states on the map with extra labels unless a later dedicated UX PR explicitly decides to do so.

At this stage the state split is internal truth ownership, not a new map annotation feature.

The user-facing map remains visually restrained.

---

## Non-goals

This parent SSOT does **not** itself implement:

- a new map layout
- route geometry changes
- SessionPanel redesign
- adaptive engine redesign
- session generation semantic changes
- new scoring logic
- new pain-mode semantics
- new completion semantics

This SSOT only locks **display truth ownership and alignment structure**.

---

## Child PR plan

### PR1 — Display contract and meta pass-through

Goal:

- extend near-term session truth so summary/bootstrap/runtime consumers can carry map-display intent fields
- establish `session_role_*`, `session_goal_*`, `session_goal_hint` contract

Expected scope:

- type additions
- summary pass-through
- bootstrap-to-panel/display adapter alignment
- no map rendering rewrite yet

### PR2 — Node display resolver and source hierarchy

Goal:

- introduce resolver that picks confirmed / preview / placeholder truth per node
- demote static map strings to fallback seed only

Expected scope:

- ResetMapV2 integration
- map-data responsibility cleanup
- map node display derivation

### PR3 — Shared copy builder for map and panel

Goal:

- ensure map label/subtitle and panel goal block are derived from the same source family
- remove semantic drift between the two surfaces

Expected scope:

- shared copy helper
- SessionPanel alignment
- map subtitle/role rendering through shared output

---

## Acceptance criteria for the full parent SSOT roadmap

1. Completed sessions show map text that matches the actual panel goal direction.
2. Current session map text matches the current session panel goal direction.
3. Next session uses bootstrap/preview truth when available instead of stale static copy.
4. Far-future sessions may remain approximate, but are clearly implemented as placeholder truth that is replaceable.
5. Map visual density remains essentially unchanged.
6. `map-data.ts` is no longer the canonical semantic owner of all node labels/descriptions.
7. Map and panel no longer drift because of separate copy ownership.

---

## Final product stance

The reset map should not pretend that all future nodes already know their exact final session content.

Instead:

- near nodes should become more truthful,
- far nodes should remain elegantly approximate,
- and the user should never feel that the map is promising one thing while the panel delivers another.
