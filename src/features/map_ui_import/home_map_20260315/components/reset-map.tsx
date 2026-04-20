"use client"

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type PointerEventHandler,
  type PointerEvent,
} from "react"
import { motion, useSpring, useTransform, useMotionValue, animate, type MotionValue } from "framer-motion"
import { Check, Lock, Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"
import { sessions as mapDataSessions } from "@/app/app/(tabs)/home/_components/reset-map-v2/map-data"
import type { SessionNode as MapDataSessionNode } from "@/app/app/(tabs)/home/_components/reset-map-v2/map-data"
import {
  getMapLines,
  type SessionNodeDisplay,
} from "@/app/app/(tabs)/home/_components/reset-map-v2/session-node-display"
import {
  resolveViewportSafePlacement,
  type SessionNodePlacement,
} from "./session-node-layout"
import {
  MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL,
  MANUAL_EDIT_FLAG_STORAGE_KEY,
  MANUAL_OVERRIDES_STORAGE_KEY,
  applyManualOverride,
  coerceManualOverrideTotal,
  formatOverridesByTotalForClipboard,
  loadOverridesFromLocalStorage,
  mergeCodeAndLocalManualOverridesByTotal,
  mergeManualOverrideSourcesForTotal,
  saveOverridesToLocalStorage,
  type ManualNodeOverride,
  type ManualNodeOverridesByTotal,
} from "./manual-node-overrides"

interface DonorSession {
  id: number
  title: string
  subtitle: string
  status: "completed" | "active" | "locked"
}

/** 프로덕션 total/completed/currentSession으로 donor 세션 목록 생성. 8/12/16/20 지원. */
function buildImportedSessionsFromProgress(
  total: number,
  completed: number,
  currentSession: number | null,
  nodeDisplayBySession?: Record<number, SessionNodeDisplay>
): DonorSession[] {
  const safeTotal = Math.max(1, Math.min(20, total))
  const items: DonorSession[] = []
  for (let id = 1; id <= safeTotal; id++) {
    const node = mapDataSessions.find((s) => s.id === id)
    const geometryFallback: MapDataSessionNode = node ?? {
      id,
      x: 0,
      y: 0,
      week: 1,
      label: `세션 ${id}`,
      type: "workout",
      description: "",
      duration: "",
      exercises: [],
      elevation: 0,
    }
    const lines = getMapLines(nodeDisplayBySession?.[id], geometryFallback)
    const title = lines.largeLabel
    const subtitle = lines.subtitle ?? ""
    let status: "completed" | "active" | "locked"
    if (currentSession === null) {
      status = id <= completed ? "completed" : "locked"
    } else {
      if (id < currentSession) status = "completed"
      else if (id === currentSession) status = "active"
      else status = "locked"
    }
    items.push({ id, title, subtitle, status })
  }
  return items
}

// Expanded canvas for 8/12/16/20 sessions — path fixed, anchors scale by total
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 4000
const VIEWPORT_HEIGHT = 480

// Layout geometry: organic curved road
const CENTER_X = 300
const START_Y = 3880
const END_Y = 80
const ROUTE_SAMPLES = 120 // Dense points for smooth curved path

// Uniform gap from road edge to panel center
const PANEL_GAP = 52
const RIGHT_PANEL_OFFSET = 42 // Right panels slightly closer (shifted left)
const LEFT_PANEL_OFFSET = 62 // Left panels slightly further out (shifted left from road)

const round = (n: number) => Math.round(n * 100) / 100

// Parametric curve: road rises through center of canvas, gentle S-curves
// Returns { x, y } for t in [0, 1], bottom to top
function roadParametric(t: number): { x: number; y: number } {
  const totalHeight = START_Y - END_Y
  const yWobble = 18 * Math.sin(t * Math.PI * 1.6)
  const y = round(START_Y - t * totalHeight + yWobble)

  // Reduced amplitudes so road stays centered in canvas (visual spine)
  const primary = 95 * Math.sin(t * Math.PI * 2.2)
  const secondary = 32 * Math.sin(t * Math.PI * 4.3 + 0.5)
  const tertiary = 14 * Math.sin(t * Math.PI * 0.7)
  const x = round(CENTER_X + primary + secondary + tertiary)

  return { x, y }
}

// Dense route points for the actual road centerline
function buildRoutePoints(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= ROUTE_SAMPLES; i++) {
    const t = i / ROUTE_SAMPLES
    points.push(roadParametric(t))
  }
  return points
}

const routePoints = buildRoutePoints()

/** Donor map: pan starts after this travel (CSS px); tap eligibility uses the same scale in SessionNode. */
const MAP_PAN_THRESHOLD_PX = 10
const WHEEL_PAN_DELTA_SCALE = 0.35

// Generate SVG path from route points (Catmull-Rom to Bezier)
function generatePath(): string {
  if (routePoints.length < 2) return ""
  let path = `M ${round(routePoints[0].x)} ${round(routePoints[0].y)}`

  for (let i = 0; i < routePoints.length - 1; i++) {
    const p0 = routePoints[Math.max(0, i - 1)]
    const p1 = routePoints[i]
    const p2 = routePoints[i + 1]
    const p3 = routePoints[Math.min(routePoints.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${round(cp1x)} ${round(cp1y)} ${round(cp2x)} ${round(cp2y)} ${round(p2.x)} ${round(p2.y)}`
  }
  return path
}

function generateCompletedPath(total: number, progressIndex: number): string {
  if (total < 2 || progressIndex < 0) return `M ${round(routePoints[0].x)} ${round(routePoints[0].y)}`

  const segment = ROUTE_SAMPLES / (total - 1)
  const endIdx = Math.min(Math.ceil(progressIndex * segment) + 1, ROUTE_SAMPLES)

  let path = `M ${round(routePoints[0].x)} ${round(routePoints[0].y)}`
  for (let i = 1; i <= endIdx && i < routePoints.length; i++) {
    const p0 = routePoints[Math.max(0, i - 2)]
    const p1 = routePoints[i - 1]
    const p2 = routePoints[i]
    const p3 = routePoints[Math.min(routePoints.length - 1, i + 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${round(cp1x)} ${round(cp1y)} ${round(cp2x)} ${round(cp2y)} ${round(p2.x)} ${round(p2.y)}`
  }
  return path
}

// No secondary/minor branch roads - main route only for clean composition

// Generate area blocks for map richness
function generateAreaBlocks() {
  const blocks: { x: number; y: number; w: number; h: number }[] = []

  for (let y = 300; y < CANVAS_HEIGHT - 200; y += 500) {
    blocks.push({ x: 20, y: y, w: 60, h: 40 })
    blocks.push({ x: 520, y: y + 100, w: 60, h: 35 })
    blocks.push({ x: 40, y: y + 250, w: 50, h: 30 })
    blocks.push({ x: 510, y: y + 350, w: 55, h: 38 })
  }

  return blocks
}

type SessionAnchor = {
  x: number
  y: number
  tangentAngle: number
  roadX: number
  roadY: number
  normalX: number
  normalY: number
  side: number
}

function computeAnchorsFromPath(pathEl: SVGPathElement, total: number): SessionAnchor[] {
  const totalLength = pathEl.getTotalLength()
  const delta = Math.max(12, totalLength / 150)
  const anchors: SessionAnchor[] = []
  const safeTotal = Math.max(1, Math.min(20, total))

  for (let i = 0; i < safeTotal; i++) {
    const progress = safeTotal === 1 ? 0 : i / (safeTotal - 1)
    const sampleLength = totalLength * progress
    const anchor = pathEl.getPointAtLength(sampleLength)

    // For i === 0, use tangent at path start (0 to delta)
    const prevLen = i === 0 ? 0 : Math.max(0, sampleLength - delta)
    const nextLen = i === 0 ? delta : Math.min(totalLength, sampleLength + delta)
    const prev = pathEl.getPointAtLength(prevLen)
    const next = pathEl.getPointAtLength(nextLen)

    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const tangent = { x: dx / len, y: dy / len }
    let normal = { x: -tangent.y, y: tangent.x }
    if (normal.x < 0) normal = { x: -normal.x, y: -normal.y }

    // Strict alternating: index 0 right, 1 left, 2 right, 3 left...
    const side = i % 2 === 0 ? 1 : -1
    const offset = side === 1 ? RIGHT_PANEL_OFFSET : LEFT_PANEL_OFFSET
    let panelCenterX = anchor.x + normal.x * side * offset
    let panelCenterY = anchor.y + normal.y * side * offset

    // Session 1 (index 0): place at road start vertex (tip), offset from path start
    if (i === 0) {
      const startPoint = pathEl.getPointAtLength(0)
      panelCenterX = startPoint.x + normal.x * side * offset - 16
      panelCenterY = startPoint.y + normal.y * side * offset + 10
    }
    // Session 2 (index 1): shift left slightly
    if (i === 1) panelCenterX -= 18

    anchors.push({
      x: panelCenterX,
      y: panelCenterY,
      tangentAngle: Math.atan2(tangent.y, tangent.x),
      roadX: anchor.x,
      roadY: anchor.y,
      normalX: normal.x,
      normalY: normal.y,
      side,
    })
  }
  return anchors
}

export interface DonorResetMapProps {
  total: number
  completed: number
  /** null = daily cap, 현재 세션 없음 */
  currentSession: number | null
  onNodeTap?: (session: MapDataSessionNode) => void
  /** PR-TRUTH-01: same runtime node copy family as JourneyMapV2 */
  nodeDisplayBySession?: Record<number, SessionNodeDisplay>
}

export function ResetMap({
  total,
  completed,
  currentSession,
  onNodeTap,
  nodeDisplayBySession,
}: DonorResetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasMotionRef = useRef<HTMLDivElement | null>(null)
  const [sessionAnchors, setSessionAnchors] = useState<SessionAnchor[] | null>(null)
  const hasInitialScrolled = useRef(false)
  const [mapEditMode, setMapEditMode] = useState(false)
  const [manualOverridesByTotal, setManualOverridesByTotal] = useState<ManualNodeOverridesByTotal>({})
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  const overrideBucket = useMemo(() => coerceManualOverrideTotal(total), [total])

  useEffect(() => {
    if (typeof window === "undefined") return
    const q = new URLSearchParams(window.location.search)
    const fromUrl = q.get("mapEdit") === "1"
    const fromLs = window.localStorage.getItem(MANUAL_EDIT_FLAG_STORAGE_KEY) === "1"
    setMapEditMode(fromUrl || fromLs)
    setManualOverridesByTotal(loadOverridesFromLocalStorage())
  }, [])

  const sessions = useMemo(
    () =>
      buildImportedSessionsFromProgress(
        total,
        completed,
        currentSession,
        nodeDisplayBySession
      ),
    [total, completed, currentSession, nodeDisplayBySession]
  )

  const [containerWidth, setContainerWidth] = useState<number | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const updateWidth = () => {
      setContainerWidth(Math.round(node.getBoundingClientRect().width))
    }
    updateWidth()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth)
      return () => window.removeEventListener("resize", updateWidth)
    }
    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const effectiveContainerWidth =
    containerWidth != null && containerWidth > 0 ? containerWidth : 360

  const sessionPlacements = useMemo((): (SessionNodePlacement | null)[] => {
    if (!sessionAnchors?.length) return []
    return sessionAnchors.map((anchor, index) => {
      const session = sessions[index]
      if (!session) return null
      const isActive = session.status === "active"
      const isCompleted = session.status === "completed"
      const nodeR = isActive ? 23 : isCompleted ? 20 : 17.5
      return resolveViewportSafePlacement({
        baseNodeX: anchor.x,
        baseNodeY: anchor.y,
        preferredLabelSide: anchor.side === 1 ? "right" : "left",
        containerWidthPx: effectiveContainerWidth,
        canvasWidthPx: CANVAS_WIDTH,
        title: session.title,
        subtitle: session.subtitle,
        nodeRadiusPx: nodeR,
      })
    })
  }, [sessionAnchors, sessions, effectiveContainerWidth])

  const effectiveManualOverrides = useMemo(
    () =>
      mergeManualOverrideSourcesForTotal(
        MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL,
        manualOverridesByTotal,
        total
      ),
    [manualOverridesByTotal, total]
  )

  const finalPlacements = useMemo((): (SessionNodePlacement | null)[] => {
    if (!sessionPlacements.length) return []
    return sessionPlacements.map((p, index) => {
      const session = sessions[index]
      if (!p || !session) return null
      return applyManualOverride(p, effectiveManualOverrides[session.id])
    })
  }, [sessionPlacements, sessions, effectiveManualOverrides])

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const el = canvasMotionRef.current
    if (!el) return { x: clientX, y: clientY }
    const r = el.getBoundingClientRect()
    const x = (clientX - r.left) * (CANVAS_WIDTH / Math.max(1, r.width))
    const y = (clientY - r.top) * (CANVAS_HEIGHT / Math.max(1, r.height))
    return { x, y }
  }, [])

  const onManualNodeDragDelta = useCallback(
    (sessionId: number, ddx: number, ddy: number) => {
      setManualOverridesByTotal((prev) => {
        const bucket = coerceManualOverrideTotal(total)
        const slice = { ...(prev[bucket] ?? {}) }
        const cur = slice[sessionId] ?? {}
        slice[sessionId] = {
          ...cur,
          dx: (cur.dx ?? 0) + ddx,
          dy: (cur.dy ?? 0) + ddy,
        }
        return { ...prev, [bucket]: slice }
      })
    },
    [total]
  )

  const onManualLabelDragDelta = useCallback(
    (sessionId: number, ddx: number, ddy: number) => {
      setManualOverridesByTotal((prev) => {
        const bucket = coerceManualOverrideTotal(total)
        const slice = { ...(prev[bucket] ?? {}) }
        const cur = slice[sessionId] ?? {}
        slice[sessionId] = {
          ...cur,
          labelDx: (cur.labelDx ?? 0) + ddx,
          labelDy: (cur.labelDy ?? 0) + ddy,
        }
        return { ...prev, [bucket]: slice }
      })
    },
    [total]
  )

  const persistOverridesToLs = useCallback(() => {
    saveOverridesToLocalStorage(manualOverridesByTotal)
  }, [manualOverridesByTotal])

  const reloadOverridesFromLs = useCallback(() => {
    setManualOverridesByTotal(loadOverridesFromLocalStorage())
  }, [])

  const copyOverridesJson = useCallback(async () => {
    const merged = mergeCodeAndLocalManualOverridesByTotal(
      MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL,
      manualOverridesByTotal
    )
    const text = formatOverridesByTotalForClipboard(merged)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt("Copy:", text)
    }
  }, [manualOverridesByTotal])

  const resetOverrideOne = useCallback(() => {
    if (selectedSessionId == null) return
    setManualOverridesByTotal((prev) => {
      const bucket = coerceManualOverrideTotal(total)
      const slice = { ...(prev[bucket] ?? {}) }
      delete slice[selectedSessionId]
      if (Object.keys(slice).length === 0) {
        const next = { ...prev }
        delete next[bucket]
        return next
      }
      return { ...prev, [bucket]: slice }
    })
  }, [selectedSessionId, total])

  const resetOverrideAll = useCallback(() => {
    setManualOverridesByTotal((prev) => {
      const bucket = coerceManualOverrideTotal(total)
      const next = { ...prev }
      delete next[bucket]
      if (typeof window !== "undefined") {
        if (Object.keys(next).length === 0) window.localStorage.removeItem(MANUAL_OVERRIDES_STORAGE_KEY)
        else saveOverridesToLocalStorage(next)
      }
      return next
    })
  }, [total])

  const toggleEditPersistFlag = useCallback((on: boolean) => {
    setMapEditMode(on)
    if (typeof window !== "undefined") {
      if (on) window.localStorage.setItem(MANUAL_EDIT_FLAG_STORAGE_KEY, "1")
      else window.localStorage.removeItem(MANUAL_EDIT_FLAG_STORAGE_KEY)
    }
  }, [])

  const toggleSelectedLabelSide = useCallback(() => {
    if (selectedSessionId == null) return
    const idx = sessions.findIndex((s) => s.id === selectedSessionId)
    const auto = idx >= 0 ? sessionPlacements[idx] : null
    if (!auto) return
    setManualOverridesByTotal((prev) => {
      const bucket = coerceManualOverrideTotal(total)
      const slice = { ...(prev[bucket] ?? {}) }
      const cur = slice[selectedSessionId] ?? {}
      const currentSide = cur.labelSide ?? auto.labelSide
      const nextSide = currentSide === "right" ? "left" : "right"
      slice[selectedSessionId] = { ...cur, labelSide: nextSide }
      return { ...prev, [bucket]: slice }
    })
  }, [selectedSessionId, sessionPlacements, sessions, total])

  const toggleSelectedLayoutMode = useCallback(() => {
    if (selectedSessionId == null) return
    const idx = sessions.findIndex((s) => s.id === selectedSessionId)
    const auto = idx >= 0 ? sessionPlacements[idx] : null
    if (!auto) return
    setManualOverridesByTotal((prev) => {
      const bucket = coerceManualOverrideTotal(total)
      const slice = { ...(prev[bucket] ?? {}) }
      const cur = slice[selectedSessionId] ?? {}
      const currentMode = cur.layoutMode ?? auto.layoutMode
      const nextMode = currentMode === "stacked-below" ? "side-inline" : "stacked-below"
      slice[selectedSessionId] = { ...cur, layoutMode: nextMode }
      return { ...prev, [bucket]: slice }
    })
  }, [selectedSessionId, sessionPlacements, sessions, total])

  const mainPathRef = useCallback(
    (el: SVGPathElement | null) => {
      if (el) setSessionAnchors(computeAnchorsFromPath(el, total))
    },
    [total]
  )

  const panY = useMotionValue(0)
  // Parallax / settle: main canvas follows panY directly; background uses soft spring from panY
  const springY = useSpring(panY, { stiffness: 80, damping: 28 })

  type MapGesturePhase = "idle" | "pressing" | "panning"
  const mapGestureRef = useRef<{
    phase: MapGesturePhase
    pointerId: number | null
    pressStartX: number
    pressStartY: number
    lastClientY: number
    lastTime: number
    velocity: number
  }>({
    phase: "idle",
    pointerId: null,
    pressStartX: 0,
    pressStartY: 0,
    lastClientY: 0,
    lastTime: 0,
    velocity: 0,
  })
  const [isMapPanning, setIsMapPanning] = useState(false)

  // Parallax transforms for background layers
  const bgLayer1Y = useTransform(springY, [-(CANVAS_HEIGHT - VIEWPORT_HEIGHT), 0], [200, -200])
  const bgLayer2Y = useTransform(springY, [-(CANVAS_HEIGHT - VIEWPORT_HEIGHT), 0], [350, -350])
  const bgLayer3Y = useTransform(springY, [-(CANVAS_HEIGHT - VIEWPORT_HEIGHT), 0], [150, -150])
  const bgLayer4Y = useTransform(springY, [-(CANVAS_HEIGHT - VIEWPORT_HEIGHT), 0], [250, -250])

  const clampPan = useCallback((value: number) => {
    const minPan = -(CANVAS_HEIGHT - VIEWPORT_HEIGHT)
    return Math.max(minPan, Math.min(0, value))
  }, [])

  const progressIndex =
    currentSession != null ? currentSession - 1 : Math.max(0, completed - 1)

  // One-time initial scroll to active/current session on mount only (never re-center after user pans)
  useEffect(() => {
    if (!sessionAnchors?.length || hasInitialScrolled.current) return
    hasInitialScrolled.current = true
    const activeIndex = sessions.findIndex((s) => s.status === "active")
    const scrollIndex = activeIndex >= 0 ? activeIndex : Math.max(0, completed - 1)
    const targetY = -(sessionAnchors[scrollIndex].y - VIEWPORT_HEIGHT / 2)
    panY.set(clampPan(targetY))
  }, [sessionAnchors, panY, clampPan, sessions, completed])

  const finishMapPanMomentum = useCallback(() => {
    const st = mapGestureRef.current
    const v = st.velocity
    if (Math.abs(v) > 0.8) {
      const targetY = clampPan(panY.get() + v * 12)
      animate(panY, targetY, {
        type: "spring",
        stiffness: 120,
        damping: 22,
        velocity: v,
      })
    }
    st.velocity = 0
  }, [clampPan, panY])

  const resetMapPointerGesture = useCallback(
    (el: HTMLDivElement | null, pointerId: number, applyMomentum: boolean) => {
      const st = mapGestureRef.current
      if (el) {
        try {
          el.releasePointerCapture(pointerId)
        } catch {
          /* ignore */
        }
      }
      const wasPanning = st.phase === "panning"
      st.phase = "idle"
      st.pointerId = null
      setIsMapPanning(false)
      if (wasPanning && applyMomentum) finishMapPanMomentum()
      else st.velocity = 0
    },
    [finishMapPanMomentum]
  )

  const onMapSurfacePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0) return
    const t = e.target as HTMLElement | null
    if (t?.closest("button")) return

    const st = mapGestureRef.current
    if (st.phase !== "idle") return

    st.phase = "pressing"
    st.pointerId = e.pointerId
    st.pressStartX = e.clientX
    st.pressStartY = e.clientY
    st.lastClientY = e.clientY
    st.lastTime = performance.now()
    st.velocity = 0
  }, [])

  const onMapSurfacePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const st = mapGestureRef.current
      if (st.phase === "idle" || e.pointerId !== st.pointerId) return

      const now = performance.now()
      const travel = Math.hypot(e.clientX - st.pressStartX, e.clientY - st.pressStartY)

      if (st.phase === "pressing" && travel >= MAP_PAN_THRESHOLD_PX) {
        st.phase = "panning"
        setIsMapPanning(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }

      if (st.phase === "panning") {
        if (e.pointerType === "touch") e.preventDefault()
        const dy = e.clientY - st.lastClientY
        const dt = now - st.lastTime
        if (dt > 0) st.velocity = (dy / dt) * 16
        panY.set(clampPan(panY.get() + dy))
        st.lastClientY = e.clientY
        st.lastTime = now
      } else {
        st.lastClientY = e.clientY
        st.lastTime = now
      }
    },
    [clampPan, panY]
  )

  const onMapSurfacePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const st = mapGestureRef.current
      if (e.pointerId !== st.pointerId) return
      resetMapPointerGesture(e.currentTarget, e.pointerId, true)
    },
    [resetMapPointerGesture]
  )

  const onMapSurfacePointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const st = mapGestureRef.current
      if (e.pointerId !== st.pointerId) return
      resetMapPointerGesture(e.currentTarget, e.pointerId, false)
    },
    [resetMapPointerGesture]
  )

  const onMapSurfaceLostPointerCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const st = mapGestureRef.current
      if (e.pointerId !== st.pointerId) return
      resetMapPointerGesture(null, e.pointerId, true)
    },
    [resetMapPointerGesture]
  )

  const onMapSurfacePointerLeave = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse") return
      const st = mapGestureRef.current
      if (st.phase === "idle" || e.pointerId !== st.pointerId) return
      resetMapPointerGesture(e.currentTarget, e.pointerId, true)
    },
    [resetMapPointerGesture]
  )

  const onMapSurfaceWheelNative = useCallback(
    (e: WheelEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest("[data-map-edit-panel]")) return
      if (e.ctrlKey) return
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      if (e.deltaMode === 2) {
        const h = containerRef.current?.clientHeight
        dy *= h && h > 0 ? h : VIEWPORT_HEIGHT
      }
      if (Math.abs(dy) < 0.5) return
      e.preventDefault()
      e.stopPropagation()
      panY.set(clampPan(panY.get() - dy * WHEEL_PAN_DELTA_SCALE))
    },
    [clampPan, panY]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("wheel", onMapSurfaceWheelNative, { passive: false })
    return () => el.removeEventListener("wheel", onMapSurfaceWheelNative)
  }, [onMapSurfaceWheelNative])

  const areaBlocks = generateAreaBlocks()

  return (
    <div
      ref={containerRef}
      data-donor-map-surface
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl select-none",
        isMapPanning ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        height: VIEWPORT_HEIGHT,
        backgroundColor: "oklch(0.22 0.03 245)",
        touchAction: "none",
        overscrollBehaviorY: "contain",
      }}
      onPointerDown={onMapSurfacePointerDown}
      onPointerMove={onMapSurfacePointerMove}
      onPointerUp={onMapSurfacePointerUp}
      onPointerCancel={onMapSurfacePointerCancel}
      onPointerLeave={onMapSurfacePointerLeave}
      onLostPointerCapture={onMapSurfaceLostPointerCapture}
    >
      {/* Edge fade hints */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 z-20" style={{ background: 'linear-gradient(to bottom, oklch(0.22 0.03 245), oklch(0.22 0.03 245 / 0.7), transparent)' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-20" style={{ background: 'linear-gradient(to top, oklch(0.22 0.03 245), oklch(0.22 0.03 245 / 0.7), transparent)' }} />

      {/* Animated background layers with parallax */}
      <BackgroundLayers
        layer1Y={bgLayer1Y}
        layer2Y={bgLayer2Y}
        layer3Y={bgLayer3Y}
        layer4Y={bgLayer4Y}
        areaBlocks={areaBlocks}
      />

      {/* Main pannable canvas - 600x4000 matches SVG viewBox for exact panel alignment */}
      <motion.div
        ref={canvasMotionRef}
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          y: panY,
        }}
      >
        {/* Route SVG */}
        <svg
          className="absolute inset-0 pointer-events-none"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            <linearGradient id="activeRouteGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="oklch(0.70 0.16 50)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="oklch(0.70 0.16 50)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="oklch(0.70 0.16 50)" stopOpacity="1" />
            </linearGradient>
            <filter id="routeGlow">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="flowingEnergy" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="transparent">
                <animate attributeName="offset" values="0;1;0" dur="3s" repeatCount="indefinite" />
              </stop>
              <stop offset="15%" stopColor="oklch(0.78 0.18 50)">
                <animate attributeName="offset" values="0.15;1;0.15" dur="3s" repeatCount="indefinite" />
              </stop>
              <stop offset="30%" stopColor="transparent">
                <animate attributeName="offset" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>

          {/* Geometry source: invisible path for getTotalLength/getPointAtLength */}
          <path
            ref={mainPathRef}
            d={generatePath()}
            fill="none"
            stroke="none"
            style={{ visibility: "hidden", position: "absolute" }}
            aria-hidden
          />

          {/* Locked future path - dashed */}
          <motion.path
            d={generatePath()}
            fill="none"
            stroke="oklch(0.38 0.04 245)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 16"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, ease: "easeOut" }}
          />

          {/* Completed path glow base */}
          <motion.path
            d={generateCompletedPath(total, progressIndex)}
            fill="none"
            stroke="url(#activeRouteGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            filter="url(#routeGlow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
          />

          {/* Flowing energy overlay on active path */}
          <motion.path
            d={generateCompletedPath(total, progressIndex)}
            fill="none"
            stroke="url(#flowingEnergy)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
          />

          {/* Debug: anchor dots + normal direction lines (set to true to verify alignment) */}
          {false &&
            sessionAnchors?.map((a, i) => (
              <g key={`dbg-${i}`}>
                <circle cx={a.roadX} cy={a.roadY} r={3} fill="red" opacity={0.7} />
                <line
                  x1={a.roadX}
                  y1={a.roadY}
                  x2={a.roadX + (a.x - a.roadX) * 0.3}
                  y2={a.roadY + (a.y - a.roadY) * 0.3}
                  stroke="lime"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              </g>
            ))}
        </svg>

        {/* Session nodes: road anchors + viewport-safe node+label footprint */}
        {sessionAnchors?.map((anchor, index) =>
          sessions[index] && finalPlacements[index] ? (
            <SessionNode
              key={sessions[index].id}
              session={sessions[index]}
              placement={finalPlacements[index]!}
              index={index}
              mapEditMode={mapEditMode}
              selectedSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
              clientToCanvas={clientToCanvas}
              onManualNodeDragDelta={onManualNodeDragDelta}
              onManualLabelDragDelta={onManualLabelDragDelta}
              manualOverride={effectiveManualOverrides[sessions[index].id]}
              onTap={
                onNodeTap
                  ? () => {
                      const node = mapDataSessions.find((s) => s.id === sessions[index].id)
                      if (node) onNodeTap(node)
                    }
                  : undefined
              }
            />
          ) : null
        )}
      </motion.div>

      {/* Subtle drag hint indicator */}
      <motion.div
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 opacity-20 pointer-events-none"
        animate={{ opacity: [0.2, 0.1, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-1 h-8 rounded-full bg-white/50" />
        <div className="w-1 h-4 rounded-full bg-white/30" />
      </motion.div>

      {mapEditMode ? (
        <div
          data-map-edit-panel
          className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[30] flex max-h-[min(45vh,220px)] flex-col gap-1 overflow-y-auto border-t border-white/15 bg-black/90 px-2 py-1.5 text-[10px] text-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.35)]"
          style={{ touchAction: "auto", overscrollBehavior: "auto" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* 액션 우선: 가로 넘침 시에도 스크롤로 전부 도달 */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="shrink-0 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 hover:bg-amber-500/25"
              title="코드+LS 병합 결과를 8/12/16/20별 객체로 복사 (MANUAL_NODE_OVERRIDES_FROM_CODE_BY_TOTAL)"
              onClick={() => void copyOverridesJson()}
            >
              JSON 복사
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              onClick={persistOverridesToLs}
            >
              LS 저장
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              onClick={reloadOverridesFromLs}
            >
              LS 불러오기
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              onClick={() => toggleEditPersistFlag(false)}
            >
              편집 끄기
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              onClick={resetOverrideOne}
              disabled={selectedSessionId == null}
            >
              reset 1
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              title="현재 total에 해당하는 버킷(8/12/16/20)의 LS 오버라이드만 삭제합니다"
              onClick={resetOverrideAll}
            >
              reset all
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              onClick={toggleSelectedLabelSide}
              disabled={selectedSessionId == null}
            >
              side↔
            </button>
            <button
              type="button"
              className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 hover:bg-white/10"
              onClick={toggleSelectedLayoutMode}
              disabled={selectedSessionId == null}
            >
              layout↔
            </button>
          </div>
          {/* 메타 + 선택 세션 JSON: 별도 줄·가로 스크롤로 버튼 밀림 방지 */}
          <div className="flex min-w-0 flex-col gap-1 border-t border-white/10 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-200">mapEdit</span>
              <span
                className={`shrink-0 ${overrideBucket !== total ? "text-amber-200/90" : "text-slate-500"}`}
                title="편집·LS는 coerce된 8/12/16/20 버킷에만 기록됩니다. total과 다르면 가장 가까운 버킷을 씁니다."
              >
                total {total} · bucket {overrideBucket}
                {overrideBucket !== total ? " (nearest)" : ""}
              </span>
              <span className="shrink-0 text-slate-400">세션 {selectedSessionId ?? "—"}</span>
            </div>
            {selectedSessionId != null && effectiveManualOverrides[selectedSessionId] ? (
              <div className="max-h-14 min-w-0 overflow-x-auto overflow-y-auto whitespace-nowrap rounded bg-black/50 px-1.5 py-1 font-mono text-[9px] leading-snug text-slate-400">
                {JSON.stringify(effectiveManualOverrides[selectedSessionId])}
              </div>
            ) : null}
          </div>
        </div>
      ) : process.env.NODE_ENV === "development" ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-1 right-1 z-[25] rounded border border-white/10 bg-black/50 px-1.5 py-0.5 text-[9px] text-slate-500 opacity-60 hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => toggleEditPersistFlag(true)}
        >
          mapEdit
        </button>
      ) : null}
    </div>
  )
}

function BackgroundLayers({
  layer1Y,
  layer2Y,
  layer3Y,
  layer4Y,
  areaBlocks,
}: {
  layer1Y: MotionValue<number>
  layer2Y: MotionValue<number>
  layer3Y: MotionValue<number>
  layer4Y: MotionValue<number>
  areaBlocks: { x: number; y: number; w: number; h: number }[]
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Layer 1: Deep grid with slow drift */}
      <motion.div
        className="absolute inset-0"
        style={{ y: layer1Y }}
        animate={{ x: [0, 10, 0, -10, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <svg className="absolute -inset-40 opacity-[0.04]" viewBox="0 0 800 5000" style={{ width: "180%", height: "180%" }}>
          {[...Array(250)].map((_, i) => (
            <line key={`h1-${i}`} x1="0" y1={i * 20} x2="800" y2={i * 20} stroke="currentColor" strokeWidth="1" className="text-slate-400" />
          ))}
          {[...Array(40)].map((_, i) => (
            <line key={`v1-${i}`} x1={i * 20} y1="0" x2={i * 20} y2="5000" stroke="currentColor" strokeWidth="1" className="text-slate-400" />
          ))}
        </svg>
      </motion.div>

      {/* Layer 2: Terrain contours with medium drift */}
      <motion.div
        className="absolute inset-0"
        style={{ y: layer2Y }}
        animate={{ x: [0, -15, 0, 15, 0] }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
      >
        <svg className="absolute -inset-40 opacity-[0.06]" viewBox="0 0 800 5000" style={{ width: "180%", height: "180%" }}>
          {[...Array(35)].map((_, i) => {
            const baseY = i * 140 + 50
            const baseX = i % 2 === 0 ? 100 : 600
            return (
              <g key={`terrain-${i}`}>
                <ellipse cx={baseX} cy={baseY} rx={60 + (i % 3) * 20} ry={35 + (i % 4) * 10} fill="none" stroke="oklch(0.42 0.04 245)" strokeWidth="1.5" />
                <ellipse cx={baseX} cy={baseY} rx={100 + (i % 3) * 25} ry={60 + (i % 4) * 15} fill="none" stroke="oklch(0.42 0.04 245)" strokeWidth="1" />
                <ellipse cx={baseX} cy={baseY} rx={140 + (i % 3) * 30} ry={85 + (i % 4) * 20} fill="none" stroke="oklch(0.42 0.04 245)" strokeWidth="0.5" />
              </g>
            )
          })}
        </svg>
      </motion.div>

      {/* Layer 3: Area blocks only - no branch roads */}
      <motion.div
        className="absolute inset-0"
        style={{ y: layer3Y }}
        animate={{ x: [0, 8, 0, -8, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        <svg className="absolute -inset-20 opacity-[0.15]" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} style={{ width: "140%", height: "100%" }}>
          {areaBlocks.map((block, i) => (
            <rect key={`block-${i}`} x={block.x} y={block.y} width={block.w} height={block.h} fill="oklch(0.30 0.035 245)" rx="3" />
          ))}
        </svg>
      </motion.div>

      {/* Layer 4: Landmark dots and checkpoints */}
      <motion.div
        className="absolute inset-0"
        style={{ y: layer4Y }}
        animate={{ x: [0, -6, 0, 6, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        <svg className="absolute -inset-10 opacity-[0.18]" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} style={{ width: "130%", height: "100%" }}>
          {[...Array(100)].map((_, i) => {
            const x = round(30 + (i % 7) * 80 + Math.sin(i) * 25)
            const y = round(80 + Math.floor(i / 7) * 280 + Math.cos(i) * 35)
            return <circle key={`dot-${i}`} cx={x} cy={y} r={2.5 + (i % 3)} fill="oklch(0.46 0.04 245)" />
          })}

          {[...Array(50)].map((_, i) => {
            const x = round(50 + (i % 6) * 90 + Math.cos(i * 2) * 15)
            const y = round(150 + Math.floor(i / 6) * 480 + Math.sin(i * 2) * 25)
            return <rect key={`sq-${i}`} x={x} y={y} width={4} height={4} fill="oklch(0.44 0.04 245)" transform={`rotate(45 ${round(x + 2)} ${round(y + 2)})`} />
          })}

          {[...Array(70)].map((_, i) => {
            const x = 60 + (i % 10) * 50
            const y = 100 + Math.floor(i / 10) * 560
            return (
              <g key={`int-${i}`}>
                <line x1={x - 3} y1={y} x2={x + 3} y2={y} stroke="oklch(0.42 0.04 245)" strokeWidth="1" />
                <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="oklch(0.42 0.04 245)" strokeWidth="1" />
              </g>
            )
          })}
        </svg>
      </motion.div>

      {/* Layer 5: Floating zone labels */}
      <motion.div
        className="absolute inset-0 opacity-[0.07] text-[8px] font-medium tracking-[0.2em] text-slate-300 uppercase"
        style={{ y: layer3Y }}
      >
        {[
          { label: "Zone A", x: 25, y: 100 },
          { label: "Zone B", x: 450, y: 350 },
          { label: "Zone C", x: 35, y: 650 },
          { label: "Zone D", x: 440, y: 900 },
          { label: "Zone E", x: 30, y: 1200 },
          { label: "Zone F", x: 455, y: 1480 },
          { label: "Zone G", x: 40, y: 1750 },
          { label: "Zone H", x: 445, y: 2020 },
          { label: "Zone I", x: 35, y: 2300 },
          { label: "Zone J", x: 450, y: 2580 },
          { label: "Zone K", x: 30, y: 2850 },
          { label: "Zone L", x: 455, y: 3130 },
          { label: "Zone M", x: 40, y: 3400 },
          { label: "Zone N", x: 445, y: 3680 },
          { label: "시작", x: 380, y: 3850 },
        ].map(({ label, x, y }, i) => (
          <motion.span
            key={label}
            className="absolute whitespace-nowrap"
            style={{ left: x, top: y }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 5 + i * 0.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          >
            {label}
          </motion.span>
        ))}
      </motion.div>
    </div>
  )
}

function SessionNode({
  session,
  placement,
  index,
  onTap,
  mapEditMode,
  selectedSessionId,
  onSelectSession,
  clientToCanvas,
  onManualNodeDragDelta,
  onManualLabelDragDelta,
  manualOverride,
}: {
  session: DonorSession
  placement: SessionNodePlacement
  index: number
  onTap?: () => void
  mapEditMode: boolean
  selectedSessionId: number | null
  onSelectSession: (id: number) => void
  clientToCanvas: (clientX: number, clientY: number) => { x: number; y: number }
  onManualNodeDragDelta: (sessionId: number, ddx: number, ddy: number) => void
  onManualLabelDragDelta: (sessionId: number, ddx: number, ddy: number) => void
  manualOverride: ManualNodeOverride | undefined
}) {
  const isCompleted = session.status === "completed"
  const isActive = session.status === "active"
  const isLocked = session.status === "locked"
  const position = { x: placement.nodeX, y: placement.nodeY }
  const isClickable = !!onTap
  const labelGap = 10
  const nodeHalf = isActive ? 23 : isCompleted ? 20 : 17.5
  const labelBoxW = placement.labelMaxWidth
  const isSelected = mapEditMode && selectedSessionId === session.id

  const nodeDragRef = useRef<{ lastX: number; lastY: number } | null>(null)
  const labelDragRef = useRef<{ lastX: number; lastY: number } | null>(null)
  const tapCandidateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    eligible: boolean
  } | null>(null)
  /** Normal-mode tap: window-level end so pointerup outside the node still clears stale candidate (no capture). */
  const tapWindowCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      tapWindowCleanupRef.current?.()
      tapWindowCleanupRef.current = null
    }
  }, [])

  const onNodeHandlePointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!mapEditMode) return
    e.stopPropagation()
    e.preventDefault()
    onSelectSession(session.id)
    const p = clientToCanvas(e.clientX, e.clientY)
    nodeDragRef.current = { lastX: p.x, lastY: p.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onNodeHandlePointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!mapEditMode || !nodeDragRef.current) return
    e.stopPropagation()
    const p = clientToCanvas(e.clientX, e.clientY)
    const ddx = p.x - nodeDragRef.current.lastX
    const ddy = p.y - nodeDragRef.current.lastY
    nodeDragRef.current = { lastX: p.x, lastY: p.y }
    if (ddx !== 0 || ddy !== 0) onManualNodeDragDelta(session.id, ddx, ddy)
  }

  const onNodeHandlePointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    nodeDragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onLabelHandlePointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!mapEditMode) return
    e.stopPropagation()
    e.preventDefault()
    onSelectSession(session.id)
    const p = clientToCanvas(e.clientX, e.clientY)
    labelDragRef.current = { lastX: p.x, lastY: p.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onLabelHandlePointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!mapEditMode || !labelDragRef.current) return
    e.stopPropagation()
    const p = clientToCanvas(e.clientX, e.clientY)
    const ddx = p.x - labelDragRef.current.lastX
    const ddy = p.y - labelDragRef.current.lastY
    labelDragRef.current = { lastX: p.x, lastY: p.y }
    if (ddx !== 0 || ddy !== 0) onManualLabelDragDelta(session.id, ddx, ddy)
  }

  const onLabelHandlePointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    labelDragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      className={cn(
        "absolute z-10",
        isClickable && !mapEditMode && "cursor-pointer",
        isSelected && "rounded-lg ring-2 ring-cyan-400/90 ring-offset-2 ring-offset-transparent"
      )}
      onPointerDown={(e) => {
        if (mapEditMode) {
          e.stopPropagation()
          onSelectSession(session.id)
          return
        }
        if (onTap && e.isPrimary && e.button === 0) {
          tapWindowCleanupRef.current?.()
          const pointerId = e.pointerId
          const onWindowPointerEnd = (ev: globalThis.PointerEvent) => {
            if (ev.pointerId !== pointerId) return
            const c = tapCandidateRef.current
            if (c?.pointerId === pointerId) tapCandidateRef.current = null
            window.removeEventListener("pointerup", onWindowPointerEnd)
            window.removeEventListener("pointercancel", onWindowPointerEnd)
            tapWindowCleanupRef.current = null
          }
          const cleanup = () => {
            window.removeEventListener("pointerup", onWindowPointerEnd)
            window.removeEventListener("pointercancel", onWindowPointerEnd)
            tapWindowCleanupRef.current = null
          }
          tapWindowCleanupRef.current = cleanup
          window.addEventListener("pointerup", onWindowPointerEnd)
          window.addEventListener("pointercancel", onWindowPointerEnd)
          tapCandidateRef.current = {
            pointerId,
            startX: e.clientX,
            startY: e.clientY,
            eligible: true,
          }
        }
      }}
      onPointerMove={(e) => {
        if (mapEditMode || !onTap || !tapCandidateRef.current) return
        if (e.pointerId !== tapCandidateRef.current.pointerId) return
        const c = tapCandidateRef.current
        const dx = e.clientX - c.startX
        const dy = e.clientY - c.startY
        if (dx * dx + dy * dy > MAP_PAN_THRESHOLD_PX * MAP_PAN_THRESHOLD_PX) {
          c.eligible = false
        }
      }}
      onPointerUp={(e) => {
        if (mapEditMode || !onTap) {
          tapWindowCleanupRef.current?.()
          return
        }
        const c = tapCandidateRef.current
        if (!c) {
          tapWindowCleanupRef.current?.()
          return
        }
        if (e.pointerId !== c.pointerId) return
        const eligible = c.eligible
        tapCandidateRef.current = null
        tapWindowCleanupRef.current?.()
        if (eligible && e.isPrimary && e.button === 0) onTap()
      }}
      onPointerCancel={(e) => {
        const c = tapCandidateRef.current
        if (!c) {
          tapWindowCleanupRef.current?.()
          return
        }
        if (e.pointerId !== c.pointerId) return
        tapCandidateRef.current = null
        tapWindowCleanupRef.current?.()
      }}
      onKeyDown={(e) => {
        if (onTap && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onTap()
        }
      }}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.03 + 0.5, type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Active node glow system - compact */}
      {isActive && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 136,
              height: 136,
              left: "50%",
              top: "50%",
              x: "-50%",
              y: "-50%",
              background: "radial-gradient(circle, oklch(0.70 0.16 50 / 0.5) 0%, transparent 70%)",
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 74,
              height: 74,
              left: "50%",
              top: "50%",
              x: "-50%",
              y: "-50%",
              background: "radial-gradient(circle, oklch(0.72 0.17 50 / 0.6) 0%, transparent 65%)",
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3,
            }}
          />
        </>
      )}

      {mapEditMode ? (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1 py-0.5 font-mono text-[8px] text-slate-300">
          #{session.id} dx:{manualOverride?.dx ?? 0} dy:{manualOverride?.dy ?? 0} lΔ:
          {manualOverride?.labelDx ?? 0},{manualOverride?.labelDy ?? 0}
        </div>
      ) : null}

      {/* Node circle - ~12% smaller */}
      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all",
          mapEditMode && "pointer-events-auto",
          isCompleted && "bg-orange-500 text-white",
          isActive && "bg-orange-500 text-white",
          isLocked && "bg-[oklch(0.32_0.04_245)] text-slate-400"
        )}
        onPointerDown={(e) => {
          if (mapEditMode && onTap) {
            e.stopPropagation()
            onSelectSession(session.id)
            onTap()
          }
        }}
        style={{
          width: isActive ? 46 : isCompleted ? 40 : 35,
          height: isActive ? 46 : isCompleted ? 40 : 35,
          boxShadow: isActive ? "0 0 30px 10px oklch(0.70 0.16 50 / 0.5), 0 0 60px 20px oklch(0.70 0.16 50 / 0.25)" : isCompleted ? "0 0 16px 4px oklch(0.70 0.16 50 / 0.3)" : "none",
          border: isActive ? "3px solid oklch(0.80 0.16 50)" : "none",
        }}
        animate={
          isActive
            ? {
                boxShadow: [
                  "0 0 30px 10px oklch(0.70 0.16 50 / 0.5), 0 0 60px 20px oklch(0.70 0.16 50 / 0.25)",
                  "0 0 40px 15px oklch(0.70 0.16 50 / 0.7), 0 0 80px 30px oklch(0.70 0.16 50 / 0.35)",
                  "0 0 30px 10px oklch(0.70 0.16 50 / 0.5), 0 0 60px 20px oklch(0.70 0.16 50 / 0.25)",
                ],
              }
            : {}
        }
        transition={isActive ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
      >
        {isCompleted && <Check className="w-4 h-4" strokeWidth={3} />}
        {isActive && <Dumbbell className="w-4 h-4" strokeWidth={2.5} />}
        {isLocked && <Lock className="w-3 h-3" strokeWidth={2.5} />}
      </motion.div>

      {mapEditMode ? (
        <div
          role="presentation"
          className="pointer-events-auto absolute -right-1 -top-1 z-30 h-4 w-4 cursor-grab rounded-full border border-white bg-orange-500 active:cursor-grabbing"
          title="노드 이동"
          onPointerDown={onNodeHandlePointerDown}
          onPointerMove={onNodeHandlePointerMove}
          onPointerUp={onNodeHandlePointerUp}
          onPointerCancel={onNodeHandlePointerUp}
        />
      ) : null}

      {/* Label: fixed min/max width, horizontal multi-line only (no vertical reading) */}
      <motion.div
        className={cn(
          "absolute min-w-0",
          placement.layoutMode === "stacked-below"
            ? "left-1/2 top-full mt-2 -translate-x-1/2 text-center"
            : "top-1/2 -translate-y-1/2",
          placement.layoutMode !== "stacked-below" &&
            placement.labelSide === "right" &&
            "text-left",
          placement.layoutMode !== "stacked-below" && placement.labelSide === "left" && "text-right"
        )}
        style={
          placement.layoutMode === "stacked-below"
            ? {
                width: labelBoxW,
                minWidth: placement.labelMinWidth,
                maxWidth: labelBoxW,
                writingMode: "horizontal-tb",
              }
            : placement.labelSide === "right"
              ? {
                  left: `calc(50% + ${nodeHalf + labelGap}px)`,
                  width: labelBoxW,
                  minWidth: placement.labelMinWidth,
                  maxWidth: labelBoxW,
                  writingMode: "horizontal-tb",
                }
              : {
                  right: `calc(50% + ${nodeHalf + labelGap}px)`,
                  width: labelBoxW,
                  minWidth: placement.labelMinWidth,
                  maxWidth: labelBoxW,
                  writingMode: "horizontal-tb",
                }
        }
        initial={{
          opacity: 0,
          x: placement.layoutMode === "stacked-below" ? 0 : placement.labelSide === "right" ? -8 : 8,
          y: placement.layoutMode === "stacked-below" ? -6 : 0,
        }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: index * 0.03 + 0.7 }}
      >
        <div
          className="relative"
          style={{
            transform: `translate3d(${placement.labelOffsetX ?? 0}px, ${placement.labelOffsetY ?? 0}px, 0)`,
          }}
        >
          <p
            className={cn(
              "text-[10px] font-medium tabular-nums leading-tight break-keep",
              isActive && "text-orange-400",
              isCompleted && "text-slate-300",
              isLocked && "text-slate-500"
            )}
          >
            세션 {session.id}
          </p>
          <p
            className={cn(
              "text-sm font-semibold leading-snug break-keep break-words line-clamp-3",
              isActive && "text-orange-500",
              isCompleted && "text-white/95",
              isLocked && "text-slate-400"
            )}
          >
            {session.title}
          </p>
          {session.subtitle ? (
            <p
              className={cn(
                "text-[11px] leading-snug break-keep break-words line-clamp-3",
                isActive && "text-orange-400/90",
                isCompleted && "text-slate-400",
                isLocked && "text-slate-500/70"
              )}
            >
              {session.subtitle}
            </p>
          ) : null}
          {mapEditMode ? (
            <div
              role="presentation"
              className="pointer-events-auto absolute -bottom-1 -right-1 z-30 h-4 w-4 cursor-grab rounded-full border border-white bg-cyan-500 active:cursor-grabbing"
              title="라벨 이동"
              onPointerDown={onLabelHandlePointerDown}
              onPointerMove={onLabelHandlePointerMove}
              onPointerUp={onLabelHandlePointerUp}
              onPointerCancel={onLabelHandlePointerUp}
            />
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
