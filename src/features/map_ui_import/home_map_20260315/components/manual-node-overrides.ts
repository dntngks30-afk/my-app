/**
 * Dev-only manual placement overrides for donor home map (presentation layer).
 * Does not affect session truth, path geometry, or node display source.
 *
 * Overrides are keyed by program length (8 / 12 / 16 / 20 sessions) because
 * path sampling uses total → same session id has different base anchors per total.
 *
 * Merge order for a rendered total T:
 *   1) auto placement (resolveViewportSafePlacement)
 *   2) code constant for bucket(T): MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL[T]
 *   3) localStorage for bucket(T) (LS wins per session id)
 */

import type { SessionNodeLayoutMode, SessionNodePlacement } from "./session-node-layout"

export type ManualNodeOverride = {
  dx?: number
  dy?: number
  labelDx?: number
  labelDy?: number
  labelSide?: "left" | "right"
  layoutMode?: SessionNodeLayoutMode
}

export type ManualNodeOverrides = Record<number, ManualNodeOverride>

/** Supported reset program lengths on the donor map */
export const MANUAL_OVERRIDE_TOTALS = [8, 12, 16, 20] as const
export type ManualOverrideTotal = (typeof MANUAL_OVERRIDE_TOTALS)[number]

export type ManualNodeOverridesByTotal = Partial<Record<ManualOverrideTotal, ManualNodeOverrides>>

/** Map arbitrary API total to the nearest 8/12/16/20 bucket for override lookup */
export function coerceManualOverrideTotal(total: number): ManualOverrideTotal {
  const t = Math.max(1, Math.min(20, Math.round(Number(total))))
  let best: ManualOverrideTotal = 20
  let bestD = Math.abs(best - t)
  for (const b of MANUAL_OVERRIDE_TOTALS) {
    const d = Math.abs(b - t)
    if (d < bestD) {
      best = b
      bestD = d
    }
  }
  return best
}

function isManualOverrideTotalKey(s: string): s is `${ManualOverrideTotal}` {
  return (MANUAL_OVERRIDE_TOTALS as readonly number[]).includes(Number(s))
}

function parseSessionOverrides(raw: unknown): ManualNodeOverrides | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: ManualNodeOverrides = {}
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k)
    if (!Number.isFinite(id) || id < 1 || id > 20) continue
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      out[id] = v as ManualNodeOverride
    }
  }
  return Object.keys(out).length ? out : null
}

/** True if JSON looks like legacy flat { "1": {...}, "2": {...} } without total buckets */
function isLegacyFlatOverrides(parsed: Record<string, unknown>): boolean {
  const keys = Object.keys(parsed)
  if (keys.length === 0) return false
  const allNumericSessions = keys.every((k) => /^\d+$/.test(k) && Number(k) >= 1 && Number(k) <= 20)
  const hasTotalBucket = keys.some(isManualOverrideTotalKey)
  return allNumericSessions && !hasTotalBucket
}

function normalizeLsPayload(parsed: unknown): ManualNodeOverridesByTotal {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  const obj = parsed as Record<string, unknown>
  if (isLegacyFlatOverrides(obj)) {
    const sessions = parseSessionOverrides(obj)
    return sessions && Object.keys(sessions).length ? { 20: sessions } : {}
  }
  const out: ManualNodeOverridesByTotal = {}
  for (const key of Object.keys(obj)) {
    if (!isManualOverrideTotalKey(key)) continue
    const total = Number(key) as ManualOverrideTotal
    const inner = parseSessionOverrides(obj[key])
    if (inner && Object.keys(inner).length) out[total] = inner
  }
  return out
}

/**
 * Paste committed overrides here (per 8/12/16/20). LS merges on top per total.
 * Unknown totals use nearest bucket via coerceManualOverrideTotal.
 */
export const MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL: ManualNodeOverridesByTotal = {
  8: {
    1: { dx: -36, dy: -8 },
    3: { dx: -125, dy: 22.6845703125 },
    4: { dx: 27, dy: 3.885986328125 },
    5: { dx: -11, dy: 0.4541015625 },
    6: { dx: -77, dy: 7.961181640625 },
    7: { dx: -17, dy: 12.06390380859375, labelSide: "left" },
  },
  12: {
    1: { dx: -52, dy: -5.933349609375 },
    2: { dx: -27, dy: -6.84326171875 },
    3: { dx: -152, dy: 10 },
    4: { dx: -47, dy: 12.363525390625 },
    5: { dx: -137, dy: 7.7138671875 },
    6: { dx: 44, dy: 5.5780029296875 },
    7: { dx: -13, dy: -7.087890625 },
    8: { dx: -53, dy: -0.8035888671875 },
    9: { dx: -12, dy: -3.52166748046875 },
    10: { dx: -59, dy: 16.72869873046875 },
    11: { dx: -30, dy: 47.3656005859375 },
    12: { dx: 0, dy: 6.958240445449242 },
  },
  16: {
    1: { dx: -33, dy: -6.918212890625 },
    2: { dx: -43, dy: 3 },
    3: { dx: -150, dy: 2 },
    4: { dx: -24, dy: 1.21630859375 },
    5: { dx: -162, dy: -5.00244140625 },
    6: { dx: -60, dy: 3.69482421875 },
    7: { dx: -148, dy: -1.382080078125 },
    8: { dx: 29, dy: -4.8228759765625 },
    9: { dx: -10, dy: -3.4400634765625 },
    10: { dx: -30, dy: -7.2506103515625 },
    11: { dx: -12, dy: -3.319580078125 },
    12: { dx: -84, dy: 5.0379638671875 },
    13: { dx: -9, dy: -2.56298828125 },
    14: { dx: -15, dy: 7.534698486328125 },
    15: { dx: -144, dy: 0.6850433349609375 },
  },
  20: {
    1: { dx: -60, dy: -5.999267578125 },
    2: { dx: -42, dy: -4.382080078125 },
    3: { dx: -123, dy: -14.501220703125 },
    4: { dx: -11, dy: -4.274169921875 },
    5: { dx: -120, dy: 34.53369140625 },
    6: { dx: -44, dy: 32.6572265625 },
    7: { dx: -122, dy: 23.16259765625 },
    8: { dx: -67, dy: 9.029052734375 },
    9: { dx: -113, dy: 33.542724609375 },
    10: { dx: 17, dy: 4.478515625 },
    11: { dx: -14, dy: -12.517333984375 },
    12: { dx: -36, dy: -9.4268798828125, labelDx: 1, labelDy: 3 },
    13: { dx: -18, dy: 5.87451171875 },
    14: { dx: -101, dy: -11.6744384765625 },
    15: { dx: -18, dy: 9.16064453125 },
    16: { dx: -97, dy: 23.1473388671875 },
    17: { dx: -19, dy: -5 },
    18: { dx: -8, dy: -4.004150390625 },
    19: { dx: -118, dy: -4.3646087646484375 },
    20: { dx: 8, dy: 8.942119662956564 },
  },
}

export const MANUAL_OVERRIDES_STORAGE_KEY = "move-re:home-map-manual-overrides"
export const MANUAL_EDIT_FLAG_STORAGE_KEY = "move-re:home-map-edit-enabled"

export function loadOverridesFromLocalStorage(): ManualNodeOverridesByTotal {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(MANUAL_OVERRIDES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return normalizeLsPayload(parsed)
  } catch {
    return {}
  }
}

export function saveOverridesToLocalStorage(overridesByTotal: ManualNodeOverridesByTotal): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MANUAL_OVERRIDES_STORAGE_KEY, JSON.stringify(overridesByTotal))
}

/** Per-session merge: localStorage wins over code for the same session id */
export function mergeManualOverrideSources(
  fromCode: ManualNodeOverrides,
  fromLs: ManualNodeOverrides
): ManualNodeOverrides {
  const out: ManualNodeOverrides = { ...fromCode }
  for (const [k, v] of Object.entries(fromLs)) {
    const id = Number(k)
    if (!Number.isFinite(id)) continue
    out[id] = { ...out[id], ...v }
  }
  return out
}

/** For rendered total: code[bucket] then LS[bucket], LS wins per session */
export function mergeManualOverrideSourcesForTotal(
  codeByTotal: ManualNodeOverridesByTotal,
  lsByTotal: ManualNodeOverridesByTotal,
  total: number
): ManualNodeOverrides {
  const bucket = coerceManualOverrideTotal(total)
  const fromCode = codeByTotal[bucket] ?? {}
  const fromLs = lsByTotal[bucket] ?? {}
  return mergeManualOverrideSources(fromCode, fromLs)
}

/** Per total: code ∪ LS (LS wins per session). Used for clipboard export. */
export function mergeCodeAndLocalManualOverridesByTotal(
  codeByTotal: ManualNodeOverridesByTotal,
  lsByTotal: ManualNodeOverridesByTotal
): ManualNodeOverridesByTotal {
  const out: ManualNodeOverridesByTotal = {}
  for (const t of MANUAL_OVERRIDE_TOTALS) {
    const m = mergeManualOverrideSources(codeByTotal[t] ?? {}, lsByTotal[t] ?? {})
    if (Object.keys(m).length > 0) out[t] = m
  }
  return out
}

export function applyManualOverride(
  placement: SessionNodePlacement,
  override: ManualNodeOverride | undefined
): SessionNodePlacement {
  if (!override) return placement
  const has =
    override.dx != null ||
    override.dy != null ||
    override.labelDx != null ||
    override.labelDy != null ||
    override.labelSide != null ||
    override.layoutMode != null
  if (!has) return placement
  return {
    ...placement,
    nodeX: placement.nodeX + (override.dx ?? 0),
    nodeY: placement.nodeY + (override.dy ?? 0),
    labelSide: override.labelSide ?? placement.labelSide,
    layoutMode: override.layoutMode ?? placement.layoutMode,
    labelOffsetX: override.labelDx ?? placement.labelOffsetX ?? 0,
    labelOffsetY: override.labelDy ?? placement.labelOffsetY ?? 0,
  }
}

export function formatOverridesForClipboard(overrides: ManualNodeOverrides): string {
  const lines = ["export const MANUAL_NODE_OVERRIDES: Record<number, ManualNodeOverride> = {"]
  const ids = Object.keys(overrides)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
  for (const id of ids) {
    const o = overrides[id]
    lines.push(`  ${id}: ${JSON.stringify(o)},`)
  }
  lines.push("}")
  return lines.join("\n")
}

/** Clipboard: full BY_TOTAL object for pasting into MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL */
export function formatOverridesByTotalForClipboard(byTotal: ManualNodeOverridesByTotal): string {
  const lines = [
    "// Paste into manual-node-overrides.ts (replace MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL)",
    "export const MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL: ManualNodeOverridesByTotal = {",
  ]
  const totals = [...MANUAL_OVERRIDE_TOTALS].filter((t) => {
    const m = byTotal[t]
    return m && Object.keys(m).length > 0
  })
  for (const t of totals) {
    const inner = byTotal[t]!
    const ids = Object.keys(inner)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    lines.push(`  ${t}: {`)
    for (const id of ids) {
      lines.push(`    ${id}: ${JSON.stringify(inner[id])},`)
    }
    lines.push(`  },`)
  }
  lines.push("}")
  return lines.join("\n")
}
