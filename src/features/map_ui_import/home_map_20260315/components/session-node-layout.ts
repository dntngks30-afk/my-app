/**
 * Viewport-safe placement for donor home reset map nodes (presentation only).
 * Geometry ownership stays with SVG path sampling in reset-map.tsx; this module
 * resolves final node + label footprint against measured container width.
 */

export type SessionNodeLayoutMode = "side-inline" | "stacked-below"

export type SessionNodePlacement = {
  nodeX: number
  nodeY: number
  labelSide: "left" | "right"
  layoutMode: SessionNodeLayoutMode
  labelMaxWidth: number
  labelAlign: "left" | "right" | "center"
}

const DEFAULT_SAFE_INSET = 16
const DEFAULT_LABEL_GAP = 10
const DEFAULT_MAX_LABEL = 112
/** ~8–9자 한글 가로 줄이 유지되도록 하는 하한; 이보다 좁으면 한 글자씩 세로처럼 보일 수 있음 */
const READABLE_HORIZONTAL_LABEL_MIN_PX = 96
/** 뷰포트가 매우 좁을 때만 허용하는 최소값(가독성 타협) */
const ABSOLUTE_LABEL_WIDTH_FLOOR_PX = 72

function readableLabelFloorPx(safeCanvasSpan: number): number {
  const capByViewport = Math.max(0, safeCanvasSpan - 8)
  return Math.min(
    DEFAULT_MAX_LABEL,
    Math.max(ABSOLUTE_LABEL_WIDTH_FLOOR_PX, Math.min(READABLE_HORIZONTAL_LABEL_MIN_PX, capByViewport))
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

/** Conservative width estimate for wrapped primary + subtitle (Korean-friendly). */
export function estimateLabelBlockWidth(
  title: string,
  subtitle: string,
  maxWidth: number
): number {
  const cap = Math.max(0, maxWidth)
  const innerFloor = Math.min(ABSOLUTE_LABEL_WIDTH_FLOOR_PX, cap)
  const titleW = Math.min(cap, Math.max(innerFloor, title.length * 11))
  const subW = Math.min(cap, Math.max(innerFloor, subtitle.length * 10))
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

/** Single horizontal shift so footprint fits [safeLeft, safeRight], or null if too wide. */
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

export type ResolveViewportSafePlacementInput = {
  baseNodeX: number
  baseNodeY: number
  /** Preferred label side: 'right' = label sits to the right of the node (donor rhythm). */
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
  const labelCap = input.maxLabelWidthPx ?? DEFAULT_MAX_LABEL

  const { safeLeft, safeRight } = getSafeHorizontalCanvasBounds(
    containerWidthPx,
    canvasWidthPx,
    safeInset
  )
  const safeW = Math.max(0, safeRight - safeLeft)
  const nodeR = Math.max(17.5, nodeRadiusPx)
  const readableFloor = readableLabelFloorPx(safeW)
  let labelW = estimateLabelBlockWidth(
    title,
    subtitle,
    Math.min(labelCap, Math.max(readableFloor, safeW - nodeR * 2 - gap))
  )

  const tryInline = (side: "left" | "right"): SessionNodePlacement | null => {
    const fp0 = footprintInline(baseNodeX, nodeR, gap, labelW, side)
    const shift = bestShiftForFootprint(fp0, safeLeft, safeRight)
    if (shift === null) return null
    const nodeX = baseNodeX + shift
    return {
      nodeX,
      nodeY: baseNodeY,
      labelSide: side,
      layoutMode: "side-inline",
      labelMaxWidth: labelW,
      labelAlign: side === "right" ? "left" : "right",
    }
  }

  const opp: "left" | "right" = preferredLabelSide === "right" ? "left" : "right"
  let result = tryInline(preferredLabelSide) ?? tryInline(opp)

  if (!result) {
    labelW = estimateLabelBlockWidth(
      title,
      subtitle,
      Math.min(labelCap, Math.max(readableFloor, safeW - 8))
    )
    result = tryInline(preferredLabelSide) ?? tryInline(opp)
  }

  if (!result) {
    let lw = Math.max(labelW, readableFloor)
    for (let attempt = 0; attempt < 14; attempt++) {
      const fp0 = footprintStacked(baseNodeX, nodeR, lw)
      const shift = bestShiftForFootprint(fp0, safeLeft, safeRight)
      if (shift !== null) {
        return {
          nodeX: baseNodeX + shift,
          nodeY: baseNodeY,
          labelSide: preferredLabelSide,
          layoutMode: "stacked-below",
          labelMaxWidth: lw,
          labelAlign: "center",
        }
      }
      if (lw <= readableFloor) break
      lw = Math.max(readableFloor, lw - 10)
    }
    const lastW = Math.max(ABSOLUTE_LABEL_WIDTH_FLOOR_PX, Math.min(readableFloor, safeW - 8))
    const shift =
      bestShiftForFootprint(footprintStacked(baseNodeX, nodeR, lastW), safeLeft, safeRight) ?? 0
    return {
      nodeX: baseNodeX + shift,
      nodeY: baseNodeY,
      labelSide: preferredLabelSide,
      layoutMode: "stacked-below",
      labelMaxWidth: lastW,
      labelAlign: "center",
    }
  }

  return result
}
