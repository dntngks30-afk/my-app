"use client"

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { motion, useSpring, useTransform, useMotionValue, animate } from "framer-motion"
import { Check, Lock, Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"
import { sessions as mapDataSessions } from "@/app/app/(tabs)/home/_components/reset-map-v2/map-data"
import type { SessionNode as MapDataSessionNode } from "@/app/app/(tabs)/home/_components/reset-map-v2/map-data"

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
  currentSession: number | null
): DonorSession[] {
  const safeTotal = Math.max(1, Math.min(20, total))
  const items: DonorSession[] = []
  for (let id = 1; id <= safeTotal; id++) {
    const node = mapDataSessions.find((s) => s.id === id)
    const title = node?.label ?? `세션 ${id}`
    const subtitle = node?.description ?? ""
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
}

export function ResetMap({
  total,
  completed,
  currentSession,
  onNodeTap,
}: DonorResetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sessionAnchors, setSessionAnchors] = useState<SessionAnchor[] | null>(null)
  const hasInitialScrolled = useRef(false)

  const sessions = useMemo(
    () => buildImportedSessionsFromProgress(total, completed, currentSession),
    [total, completed, currentSession]
  )

  const mainPathRef = useCallback(
    (el: SVGPathElement | null) => {
      if (el) setSessionAnchors(computeAnchorsFromPath(el, total))
    },
    [total]
  )

  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const lastY = useRef(0)
  const velocity = useRef(0)
  const lastTime = useRef(0)

  const panY = useMotionValue(0)
  // Soft spring: low stiffness so pan stays where user leaves it, no snap-back
  const springY = useSpring(panY, { stiffness: 80, damping: 28 })

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

  const handleDragStart = (clientY: number) => {
    setIsDragging(true)
    dragStartY.current = clientY
    lastY.current = clientY
    lastTime.current = Date.now()
    velocity.current = 0
  }

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return

    const now = Date.now()
    const dt = now - lastTime.current
    const dy = clientY - lastY.current

    if (dt > 0) {
      velocity.current = (dy / dt) * 16
    }

    lastY.current = clientY
    lastTime.current = now

    const delta = clientY - dragStartY.current
    const newPan = clampPan(panY.get() + delta)
    panY.set(newPan)
    dragStartY.current = clientY
  }

  const handleDragEnd = () => {
    setIsDragging(false)

    // Light momentum only; no aggressive spring-back
    if (Math.abs(velocity.current) > 0.8) {
      const targetY = clampPan(panY.get() + velocity.current * 12)
      animate(panY, targetY, {
        type: "spring",
        stiffness: 120,
        damping: 22,
        velocity: velocity.current,
      })
    }
  }

  const areaBlocks = generateAreaBlocks()

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing select-none"
      style={{ height: VIEWPORT_HEIGHT, backgroundColor: 'oklch(0.22 0.03 245)' }}
      onMouseDown={(e) => handleDragStart(e.clientY)}
      onMouseMove={(e) => handleDragMove(e.clientY)}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
      onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
      onTouchEnd={handleDragEnd}
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
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          y: springY,
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

        {/* Session nodes - all anchored to road, unified GAP, alternating left/right */}
        {sessionAnchors?.map((anchor, index) =>
          sessions[index] ? (
            <SessionNode
              key={sessions[index].id}
              session={sessions[index]}
              anchor={anchor}
              index={index}
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
  layer1Y: ReturnType<typeof useTransform>
  layer2Y: ReturnType<typeof useTransform>
  layer3Y: ReturnType<typeof useTransform>
  layer4Y: ReturnType<typeof useTransform>
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
  anchor,
  index,
  onTap,
}: {
  session: DonorSession
  anchor: SessionAnchor
  index: number
  onTap?: () => void
}) {
  const isCompleted = session.status === "completed"
  const isActive = session.status === "active"
  const isLocked = session.status === "locked"
  const position = { x: anchor.x, y: anchor.y }
  const labelOnRight = anchor.side === 1
  const isClickable = !!onTap

  return (
    <motion.div
      className={cn("absolute z-10", isClickable && "cursor-pointer")}
      onPointerDown={(e) => {
        if (onTap) {
          e.stopPropagation()
          e.preventDefault()
          onTap()
        }
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

      {/* Node circle - ~12% smaller */}
      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all",
          isCompleted && "bg-orange-500 text-white",
          isActive && "bg-orange-500 text-white",
          isLocked && "bg-[oklch(0.32_0.04_245)] text-slate-400"
        )}
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

      {/* Label — donor-faithful: session number, title, subtitle */}
      <motion.div
        className={cn("absolute top-1/2 -translate-y-1/2 whitespace-nowrap", labelOnRight ? "left-full ml-3" : "right-full mr-3 text-right")}
        initial={{ opacity: 0, x: labelOnRight ? -8 : 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 + 0.7 }}
      >
        <p
          className={cn(
            "text-[10px] font-medium tabular-nums",
            isActive && "text-orange-400",
            isCompleted && "text-slate-300",
            isLocked && "text-slate-500"
          )}
        >
          세션 {session.id}
        </p>
        <p
          className={cn(
            "text-sm font-semibold",
            isActive && "text-orange-500",
            isCompleted && "text-white/95",
            isLocked && "text-slate-400"
          )}
        >
          {session.title}
        </p>
        <p
          className={cn(
            "text-[11px]",
            isActive && "text-orange-400/90",
            isCompleted && "text-slate-400",
            isLocked && "text-slate-500/70"
          )}
        >
          {session.subtitle}
        </p>
      </motion.div>
    </motion.div>
  )
}
