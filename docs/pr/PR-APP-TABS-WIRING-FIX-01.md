# PR-APP-TABS-WIRING-FIX-01

## Problem

After adding `ResetTabViewV2` / `JourneyTabViewV2` to `/(tabs)/checkin/page.tsx` and
`/(tabs)/profile/page.tsx`, **the UI did not change** in production-style navigation.

## Root cause (CURRENT_IMPLEMENTED)

- When `navV2` is on (default in production), [`src/app/app/(tabs)/layout.tsx`](src/app/app/(tabs)/layout.tsx)
  renders **`<AppShell />` only** and **does not render route `children`**.
- Actual tab content therefore comes from:
  - [`AppShell.tsx`](src/app/app/_shell/AppShell.tsx) → [`StatsTab`](src/app/app/_tabs/stats/StatsTab.tsx) for `/app/checkin`
  - [`AppShell.tsx`](src/app/app/_shell/AppShell.tsx) → [`MyTab`](src/app/app/_tabs/my/MyTab.tsx) for `/app/profile`
- Those wrappers still pointed at **legacy white surfaces**:
  - `StatsTab` → `StatsTabContent` → `StatsViewV2`
  - `MyTab` → `ProfileTabContent` → `ProfileViewV2`
- `AppShell` also applied the **donor dark background only on `/app/home`**, leaving checkin/profile
  on **`bg-white`**, so the transplant looked like “no change.”

## Fix

| File | Change |
|------|--------|
| [`src/app/app/_shell/AppShell.tsx`](src/app/app/_shell/AppShell.tsx) | `useDonorTheme` matches BottomNav: home + checkin + profile (shared navy `oklch`) |
| [`src/app/app/_tabs/stats/StatsTab.tsx`](src/app/app/_tabs/stats/StatsTab.tsx) | Render `ResetTabViewV2` + `APP_TAB_BG` (persistent shell 경로 실제 진입점) |
| [`src/app/app/_tabs/my/MyTab.tsx`](src/app/app/_tabs/my/MyTab.tsx) | Render `JourneyTabViewV2` + cached `completedSessions`; same `DEFAULT_TOTAL_SESSIONS` as standalone profile page |

[`src/app/app/(tabs)/checkin/page.tsx`](src/app/app/(tabs)/checkin/page.tsx) and
[`profile/page.tsx`](src/app/app/(tabs)/profile/page.tsx) remain the correct targets when **`navV2=0`** (layout renders `children` only). No change required there for this wiring fix.

## Intentionally not changed

- [`/src/app/app/(tabs)/home/`](…) app home route surface and **ResetMapV2 / SessionPanelV2**
- **`StatsTabContent` / `ProfileTabContent`** — still present for tooling/reference; unused by `StatsTab`/`MyTab` after this PR
- Session APIs, scoring, auth, payment, DB

## Manual verification

1. **`navV2` default** (prod or dev without `navV2=0`):
   - Open `/app/checkin`: dark 리셋 screen (`오늘 필요한 리셋`), BottomNav 리셋 active, navy backdrop.
   - Open `/app/profile`: dark 여정 screen (`나의 여정`), BottomNav 여정 active, navy backdrop.
   - Confirm **no white “dashboard”** shell behind those tabs.
2. **`?navV2=0`** (dev): Legacy page routes render; regressions confined to legacy path acceptable.
3. BottomNav donor theme: same visual bar treatment on 지도 · 리셋 · 여정 when on tab routes.

## Rollback

Revert the three files listed in “Fix”; shell returns to StatsViewV2 / ProfileViewV2 and previous background split.
