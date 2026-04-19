/**
 * Viewport-safe placement for donor home reset map nodes (presentation only).
 * Prioritizes horizontal-readable Korean labels and full node+label containment.
 */

export type SessionNodeLayoutMode = "side-inline" | "stacked-below"

export type SessionNodePlacement = {
  nodeX: number
  nodeY: number
  labelSide: "left" | "right"
  layoutMode: SessionNodeLayoutMode
  /** Fixed box width: min === max so text never collapses to a vertical column */
  labelMinWidth: number
  labelMaxWidth: number
  labelAlign: "left" | "right" | "center"
  /** Dev manual override: extra label translation in canvas px (after auto placement) */
  labelOffsetX?: number
  labelOffsetY?: number
}

const DEFAULT_SAFE_INSET = 16
const DEFAULT_LABEL_GAP = 10
/** Upper cap; real width is min(this, safe zone minus node+gap) */
const LABEL_WIDTH_CAP_PX = 168
/**
 * 한글 2~4음절(안정·하체 등)이 한 줄로 읽히게 할 최소 박스 폭.
 * 이보다 좁으면 글자가 줄마다 1음절씩만 서서 세로처럼 보이기 쉽다.
 */
const READABLE_HORIZONTAL_LABEL_MIN_PX = 128
/** 뷰포트가 매우 좁을 때만 허용하는 최저값(그래도 keep-all + 다줄 가로) */
const ABSOLUTE_LABEL_WIDTH_FLOOR_PX = 96

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function readableFloorForSafeSpan(safeCanvasSpan: number): number {
  const room = Math.max(0, safeCanvasSpan - 12)
  return Math.min(
    LABEL_WIDTH_CAP_PX,
    Math.max(ABSOLUTE_LABEL_WIDTH_FLOOR_PX, Math.min(READABLE_HORIZONTAL_LABEL_MIN_PX, room))
  )
}

export function getSafeHorizontalCanvasBounds(
  containerWidthPx: number,
  canvasWidthPx: number,
  safeInsetPx: number = DEFAULT_SAFE_INSET
): { safeLeft: number; safeRight: number } {
  const W = Math.max(0, containerWidthPx)
  const C = Math.max(1, canvasWidthPx)
  const inset = Math.max(0, safeInsetPx)
  if (W <= 0) {
    return { safeLeft: inset, safeRight: C - inset }
  }
  const offset = (C - W) / 2
  return {
    safeLeft: inset + offset,
    safeRight: C - inset + offset,
  }
}

/** Desired label column width from copy, capped by budget (horizontal reading). */
export function estimateLabelBlockWidth(
  title: string,
  subtitle: string,
  maxWidth: number
): number {
  const cap = Math.max(0, maxWidth)
  const innerFloor = Math.min(ABSOLUTE_LABEL_WIDTH_FLOOR_PX, cap)
  const titleW = Math.min(cap, Math.max(innerFloor, title.length * 12))
  const subW = Math.min(cap, Math.max(innerFloor, subtitle.length * 11))
  return Math.min(cap, Math.max(titleW, subW, innerFloor))
}

function footprintInline(
  nodeX: number,
  nodeR: number,
  gap: number,
  labelW: number,
  labelSide: "left" | "right"
): { left: number; right: number } {
  if (labelSide === "right") {
    return { left: nodeX - nodeR, right: nodeX + nodeR + gap + labelW }
  }
  return { left: nodeX - nodeR - gap - labelW, right: nodeX + nodeR }
}

function footprintStacked(nodeX: number, nodeR: number, labelW: number): { left: number; right: number } {
  const half = Math.max(nodeR, labelW / 2)
  return { left: nodeX - half, right: nodeX + half }
}

function bestShiftForFootprint(
  fp: { left: number; right: number },
  safeLeft: number,
  safeRight: number
): number | null {
  const sLo = safeLeft - fp.left
  const sHi = safeRight - fp.right
  if (sLo > sHi) return null
  if (0 >= sLo && 0 <= sHi) return 0
  if (0 < sLo) return sLo
  return sHi
}

function tryInlinePlacement(
  baseNodeX: number,
  baseNodeY: number,
  nodeR: number,
  gap: number,
  lw: number,
  side: "left" | "right",
  safeLeft: number,
  safeRight: number
): SessionNodePlacement | null {
  let lo: number
  let hi: number
  if (side === "right") {
    lo = safeLeft + nodeR
    hi = safeRight - nodeR - gap - lw
  } else {
    lo = safeLeft + nodeR + gap + lw
    hi = safeRight - nodeR
  }
  if (lo > hi) return null
  const nodeX = clamp(baseNodeX, lo, hi)
  return {
    nodeX,
    nodeY: baseNodeY,
    labelSide: side,
    layoutMode: "side-inline",
    labelMinWidth: lw,
    labelMaxWidth: lw,
    labelAlign: side === "right" ? "left" : "right",
  }
}

function tryStackedPlacement(
  baseNodeX: number,
  baseNodeY: number,
  nodeR: number,
  lw: number,
  preferredLabelSide: "left" | "right",
  safeLeft: number,
  safeRight: number
): SessionNodePlacement {
  const fp0 = footprintStacked(baseNodeX, nodeR, lw)
  const shift = bestShiftForFootprint(fp0, safeLeft, safeRight) ?? 0
  const nodeX = baseNodeX + shift
  return {
    nodeX,
    nodeY: baseNodeY,
    labelSide: preferredLabelSide,
    layoutMode: "stacked-below",
    labelMinWidth: lw,
    labelMaxWidth: lw,
    labelAlign: "center",
  }
}

export type ResolveViewportSafePlacementInput = {
  baseNodeX: number
  baseNodeY: number
  preferredLabelSide: "left" | "right"
  containerWidthPx: number
  canvasWidthPx: number
  safeInsetPx?: number
  title: string
  subtitle: string
  nodeRadiusPx: number
  labelGapPx?: number
  maxLabelWidthPx?: number
}

export function resolveViewportSafePlacement(
  input: ResolveViewportSafePlacementInput
): SessionNodePlacement {
  const {
    baseNodeX,
    baseNodeY,
    preferredLabelSide,
    containerWidthPx,
    canvasWidthPx,
    title,
    subtitle,
    nodeRadiusPx,
  } = input
  const safeInset = input.safeInsetPx ?? DEFAULT_SAFE_INSET
  const gap = input.labelGapPx ?? DEFAULT_LABEL_GAP
  const labelCap = input.maxLabelWidthPx ?? LABEL_WIDTH_CAP_PX

  const { safeLeft, safeRight } = getSafeHorizontalCanvasBounds(
    containerWidthPx,
    canvasWidthPx,
    safeInset
  )
  const safeW = Math.max(0, safeRight - safeLeft)
  const nodeR = Math.max(17.5, nodeRadiusPx)
  const readableFloor = readableFloorForSafeSpan(safeW)

  /** Max horizontal span for label when node+label share one row */
  const inlineLabelBudget = Math.max(0, safeW - 2 * nodeR - gap)
  const stackedLabelBudget = Math.max(0, safeW - 12)

  const opposite = (s: "left" | "right"): "left" | "right" => (s === "right" ? "left" : "right")

  const attemptInline = (lw: number): SessionNodePlacement | null => {
    if (lw > inlineLabelBudget + 1e-6) return null
    const a =
      tryInlinePlacement(baseNodeX, baseNodeY, nodeR, gap, lw, preferredLabelSide, safeLeft, safeRight) ??
      tryInlinePlacement(baseNodeX, baseNodeY, nodeR, gap, lw, opposite(preferredLabelSide), safeLeft, safeRight)
    return a
  }

  let result: SessionNodePlacement | null = null

  if (inlineLabelBudget >= readableFloor) {
    const cap = Math.min(labelCap, inlineLabelBudget)
    let lw = estimateLabelBlockWidth(title, subtitle, cap)
    lw = Math.max(readableFloor, Math.min(lw, cap))

    result = attemptInline(lw)

    if (!result) {
      let trial = Math.min(lw, inlineLabelBudget)
      while (trial >= readableFloor) {
        result = attemptInline(trial)
        if (result) break
        trial -= 12
      }
    }
  }

  if (result) return result

  const capStack = Math.min(labelCap, stackedLabelBudget)
  let stackedLw = estimateLabelBlockWidth(title, subtitle, capStack)
  stackedLw = Math.min(stackedLw, capStack)
  if (capStack >= readableFloor) {
    stackedLw = Math.max(readableFloor, stackedLw)
  }

  let stacked = tryStackedPlacement(
    baseNodeX,
    baseNodeY,
    nodeR,
    stackedLw,
    preferredLabelSide,
    safeLeft,
    safeRight
  )
  const fp = footprintStacked(stacked.nodeX, nodeR, stackedLw)
  if (fp.left < safeLeft - 0.5 || fp.right > safeRight + 0.5) {
    let trial = stackedLw
    while (trial >= ABSOLUTE_LABEL_WIDTH_FLOOR_PX) {
      stacked = tryStackedPlacement(
        baseNodeX,
        baseNodeY,
        nodeR,
        trial,
        preferredLabelSide,
        safeLeft,
        safeRight
      )
      const f2 = footprintStacked(stacked.nodeX, nodeR, trial)
      if (f2.left >= safeLeft - 0.5 && f2.right <= safeRight + 0.5) {
        stacked.labelMinWidth = trial
        stacked.labelMaxWidth = trial
        return stacked
      }
      trial -= 12
    }
  }

  return stacked
}
