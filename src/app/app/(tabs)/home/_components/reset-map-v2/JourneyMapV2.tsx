'use client'

import { useRef, useEffect, useState, useCallback, memo } from 'react'
import {
  sessions,
  generatePathD,
  generateContourLines,
  terrainZones,
  mapFeatures,
  type SessionNode,
} from './map-data'

interface JourneyMapV2Props {
  total: number
  completed: number
  /** null = daily cap, 현재 세션 없음 */
  currentSession: number | null
  onNodeTap: (session: SessionNode) => void
}

const VW = 390
const VH = 1580
const NODE_R = 13
const MILESTONE_R = 16

function TreeCluster({ x, y }: { x: number; y: number }) {
  return (
    <g opacity="0.45">
      <line x1={x} y1={y} x2={x} y2={y - 8} stroke="oklch(0.60 0.08 145)" strokeWidth="1" />
      <path d={`M${x - 4} ${y - 5} L${x} ${y - 13} L${x + 4} ${y - 5}Z`} fill="oklch(0.55 0.10 145)" />
      <line x1={x + 9} y1={y + 2} x2={x + 9} y2={y - 5} stroke="oklch(0.58 0.07 145)" strokeWidth="0.8" />
      <path d={`M${x + 6} ${y - 3} L${x + 9} ${y - 10} L${x + 12} ${y - 3}Z`} fill="oklch(0.52 0.09 145)" />
      <line x1={x + 5} y1={y + 3} x2={x + 5} y2={y - 3} stroke="oklch(0.56 0.06 145)" strokeWidth="0.6" />
      <path d={`M${x + 2.5} ${y - 1.5} L${x + 5} ${y - 7} L${x + 7.5} ${y - 1.5}Z`} fill="oklch(0.50 0.08 145)" />
    </g>
  )
}

function Rock({ x, y }: { x: number; y: number }) {
  return (
    <g opacity="0.30">
      <path
        d={`M${x} ${y} L${x + 3} ${y - 5} L${x + 7} ${y - 3} L${x + 10} ${y - 6} L${x + 13} ${y} Z`}
        fill="oklch(0.72 0.01 250)"
        stroke="oklch(0.65 0.015 250)"
        strokeWidth="0.5"
      />
    </g>
  )
}

function Stream({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y} Q${x + 8} ${y - 12}, ${x + 3} ${y - 25} Q${x - 5} ${y - 38}, ${x + 2} ${y - 50}`}
      fill="none"
      stroke="oklch(0.62 0.10 230)"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.35"
    />
  )
}

function Flag({ x, y }: { x: number; y: number }) {
  return (
    <g opacity="0.55">
      <line x1={x} y1={y} x2={x} y2={y - 14} stroke="oklch(0.55 0.02 250)" strokeWidth="1" />
      <path d={`M${x} ${y - 14} L${x + 8} ${y - 11} L${x} ${y - 8}Z`} fill="oklch(0.38 0.14 260)" />
    </g>
  )
}

function JourneyMapV2Inner({ total, completed, currentSession, onNodeTap }: JourneyMapV2Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, setMounted] = useState(false)

  const safeTotal = Math.max(1, Math.min(20, total ?? 20))
  const visibleSessions = sessions.filter(s => s.id <= safeTotal)

  const fullPath = visibleSessions.length >= 2 ? generatePathD(visibleSessions) : ''
  const contours = generateContourLines()

  const pathBoundary = currentSession ?? completed
  const completedSessions = visibleSessions.filter(s => s.id <= pathBoundary)
  const completedPath = completedSessions.length >= 2 ? generatePathD(completedSessions) : ''

  useEffect(() => {
    setMounted(true)
    if (scrollRef.current && currentSession != null) {
      const node = visibleSessions.find(s => s.id === currentSession)
      if (node) {
        const ratio = node.y / VH
        const ch = scrollRef.current.clientHeight
        const sh = scrollRef.current.scrollHeight
        const target = ratio * sh - ch / 2
        scrollRef.current.scrollTo({ top: target, behavior: 'smooth' })
      }
    }
  }, [currentSession, visibleSessions])

  const status = useCallback(
    (id: number): 'completed' | 'current' | 'locked' => {
      if (currentSession === null) {
        return id <= completed ? 'completed' : 'locked'
      }
      if (id < currentSession) return 'completed'
      if (id === currentSession) return 'current'
      return 'locked'
    },
    [currentSession, completed],
  )

  const C = {
    blue: 'oklch(0.38 0.14 260)',
    blueLight: 'oklch(0.48 0.12 260)',
    bluePale: 'oklch(0.55 0.10 260)',
    blueGlow: 'oklch(0.38 0.14 260 / 0.18)',
    blueGlowSoft: 'oklch(0.38 0.14 260 / 0.08)',
    checkInner: 'oklch(0.99 0 0)',
    locked: 'oklch(0.92 0.005 240)',
    lockedStroke: 'oklch(0.84 0.01 240)',
    lockedText: 'oklch(0.65 0.01 250)',
    label: 'oklch(0.45 0.02 250)',
    currentLabel: 'oklch(0.22 0.02 260)',
    completedLabel: 'oklch(0.38 0.10 260)',
    contour: 'oklch(0.88 0.015 220)',
    contourMajor: 'oklch(0.82 0.02 220)',
    elevText: 'oklch(0.72 0.015 220)',
    zone: 'oklch(0.60 0.02 250)',
    badgeBg: 'oklch(0.97 0.003 240)',
    badgeStroke: 'oklch(0.88 0.01 240)',
    white: 'oklch(1 0 0)',
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        style={{ minHeight: '210vh' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="rmv2-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rmv2-glowBig" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rmv2-nodeShadow" x="-20%" y="-10%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="oklch(0.30 0.02 260)" floodOpacity="0.10" />
          </filter>
          <linearGradient id="rmv2-trailGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.20" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="1" />
          </linearGradient>
          {terrainZones.map(z => (
            <linearGradient key={`zg-${z.id}`} id={`rmv2-zone-${z.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={z.color} stopOpacity="0.0" />
              <stop offset="50%" stopColor={z.color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={z.color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>

        {/* Terrain zone backgrounds */}
        {terrainZones.map(z => (
          <rect
            key={`zone-bg-${z.id}`}
            x="0"
            y={z.yEnd}
            width={VW}
            height={z.yStart - z.yEnd}
            fill={`url(#rmv2-zone-${z.id})`}
          />
        ))}

        {/* Zone labels */}
        {terrainZones.map(z => {
          const midY = (z.yStart + z.yEnd) / 2
          return (
            <g key={`zlabel-${z.id}`}>
              <text x="14" y={midY - 6} fill={C.zone} fontSize="8" fontWeight="500" letterSpacing="0.1em" opacity="0.6" className="font-sans">
                {z.label}
              </text>
              <text x="14" y={midY + 5} fill={C.zone} fontSize="7" opacity="0.4" className="font-sans">
                {z.elevationRange}
              </text>
            </g>
          )
        })}

        {/* Contour lines */}
        {contours.map((c, i) => (
          <g key={`contour-${i}`}>
            <path
              d={c.d}
              fill="none"
              stroke={c.isMajor ? C.contourMajor : C.contour}
              strokeWidth={c.isMajor ? 0.8 : 0.4}
              opacity={c.isMajor ? 0.7 : 0.45}
            />
            {c.isMajor && c.elevation > 0 && (
              <text x="370" y={40 + i * 55 - 3} textAnchor="end" fill={C.elevText} fontSize="7" opacity="0.6" className="font-mono">
                {`${c.elevation}m`}
              </text>
            )}
          </g>
        ))}

        {/* Grid lines */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <line
            key={`grid-${i}`}
            x1="0" y1={i * 250} x2={VW} y2={i * 250}
            stroke="oklch(0.86 0.01 240)"
            strokeWidth="0.3"
            strokeDasharray="2 6"
            opacity="0.4"
          />
        ))}

        {/* Map features */}
        {mapFeatures.map((f, i) => {
          switch (f.type) {
            case 'tree-cluster': return <TreeCluster key={`feat-${i}`} x={f.x} y={f.y} />
            case 'rock': return <Rock key={`feat-${i}`} x={f.x} y={f.y} />
            case 'stream': return <Stream key={`feat-${i}`} x={f.x} y={f.y} />
            case 'flag': return <Flag key={`feat-${i}`} x={f.x} y={f.y} />
            default: return null
          }
        })}

        {/* Compass rose */}
        <g transform="translate(355, 30)" opacity="0.35">
          <line x1="0" y1="-12" x2="0" y2="12" stroke={C.lockedText} strokeWidth="0.6" />
          <line x1="-12" y1="0" x2="12" y2="0" stroke={C.lockedText} strokeWidth="0.6" />
          <polygon points="0,-12 -2.5,-5 2.5,-5" fill={C.blue} opacity="0.8" />
          <text x="0" y="-15" textAnchor="middle" fill={C.blue} fontSize="6" fontWeight="600" opacity="0.8" className="font-sans">N</text>
        </g>

        {/* Route path (locked — dashed) */}
        <path
          d={fullPath}
          fill="none"
          stroke={C.lockedStroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="4 7"
          opacity="0.6"
        />

        {/* Route path (completed — solid) */}
        {completedPath && (
          <>
            <path d={completedPath} fill="none" stroke={C.blue} strokeWidth="7" strokeLinecap="round" opacity="0.06" />
            <path d={completedPath} fill="none" stroke="url(#rmv2-trailGrad)" strokeWidth="3" strokeLinecap="round" />
          </>
        )}

        {/* Distance markers */}
        {visibleSessions.filter((_, i) => i % 4 === 2).map(s => {
          const km = Math.round((s.id / 20) * 42)
          return (
            <g key={`dist-${s.id}`}>
              <rect x={s.x + 22} y={s.y - 6} width="26" height="12" rx="2" fill={C.white} fillOpacity="0.85" stroke={C.lockedStroke} strokeWidth="0.4" />
              <text x={s.x + 35} y={s.y + 1} textAnchor="middle" fill={C.lockedText} fontSize="6.5" className="font-mono">
                {`${km}km`}
              </text>
            </g>
          )
        })}

        {/* START / FINISH */}
        <g>
          <rect x={visibleSessions[0].x - 22} y={visibleSessions[0].y + 26} width="44" height="16" rx="3" fill={C.white} fillOpacity="0.9" stroke={C.lockedStroke} strokeWidth="0.5" />
          <text x={visibleSessions[0].x} y={visibleSessions[0].y + 37} textAnchor="middle" fill={C.label} fontSize="8" fontWeight="600" letterSpacing="0.15em" className="font-sans">
            {'START'}
          </text>
        </g>
        {visibleSessions.length > 0 && (
          <g>
            <rect x={visibleSessions[visibleSessions.length - 1].x - 24} y={visibleSessions[visibleSessions.length - 1].y - 40} width="48" height="16" rx="3" fill={C.blue} fillOpacity="0.12" stroke={C.blue} strokeWidth="0.6" />
            <text x={visibleSessions[visibleSessions.length - 1].x} y={visibleSessions[visibleSessions.length - 1].y - 29} textAnchor="middle" fill={C.blue} fontSize="8" fontWeight="600" letterSpacing="0.15em" className="font-sans">
              {'FINISH'}
            </text>
          </g>
        )}

        {/* Week dividers */}
        {[1140, 740, 350].map((y, i) => (
          <g key={`wdiv-${i}`}>
            <line x1="30" y1={y} x2={VW - 30} y2={y} stroke={C.lockedStroke} strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5" />
            <text x={VW - 18} y={y + 12} textAnchor="end" fill={C.lockedText} fontSize="7" opacity="0.55" className="font-sans">
              {`${i + 2}주차`}
            </text>
          </g>
        ))}

        {/* Session nodes */}
        {visibleSessions.map((session) => {
          const st = status(session.id)
          const r = session.type === 'milestone' ? MILESTONE_R : NODE_R
          const isMile = session.type === 'milestone'

          return (
            <g
              key={session.id}
              onClick={() => onNodeTap(session)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`세션 ${session.id}: ${session.label}${st === 'locked' ? ' (잠김)' : ''}`}
            >
              {st === 'current' && (
                <>
                  <circle cx={session.x} cy={session.y} r={r + 18} fill={C.blue} opacity="0.05">
                    <animate attributeName="r" values={`${r + 14};${r + 24};${r + 14}`} dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.04;0.10;0.04" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={session.x} cy={session.y} r={r + 8} fill="none" stroke={C.blue} strokeWidth="1.2" opacity="0.18">
                    <animate attributeName="r" values={`${r + 5};${r + 12};${r + 5}`} dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.15;0.30;0.15" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                </>
              )}

              {isMile ? (
                <rect
                  x={session.x - r * 0.7} y={session.y - r * 0.7}
                  width={r * 1.4} height={r * 1.4} rx="3"
                  transform={`rotate(45, ${session.x}, ${session.y})`}
                  fill={st === 'locked' ? C.locked : C.blue}
                  stroke={st === 'locked' ? C.lockedStroke : C.blueLight}
                  strokeWidth={st === 'locked' ? 0.8 : 1.5}
                  filter={st === 'current' ? 'url(#rmv2-glow)' : st !== 'locked' ? 'url(#rmv2-nodeShadow)' : undefined}
                />
              ) : (
                <rect
                  x={session.x - r} y={session.y - r}
                  width={r * 2} height={r * 2} rx="5"
                  fill={st === 'locked' ? C.locked : C.blue}
                  stroke={st === 'locked' ? C.lockedStroke : C.blueLight}
                  strokeWidth={st === 'locked' ? 0.6 : 1.5}
                  filter={st === 'current' ? 'url(#rmv2-glow)' : st !== 'locked' ? 'url(#rmv2-nodeShadow)' : undefined}
                />
              )}

              {st === 'completed' && (
                <path
                  d={`M ${session.x - 4.5} ${session.y} L ${session.x - 1} ${session.y + 3.5} L ${session.x + 5} ${session.y - 3.5}`}
                  fill="none" stroke={C.checkInner} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              )}
              {st === 'current' && (
                <polygon
                  points={`${session.x - 3},${session.y - 5} ${session.x - 3},${session.y + 5} ${session.x + 5},${session.y}`}
                  fill={C.checkInner}
                />
              )}
              {st === 'locked' && (
                <text x={session.x} y={session.y + 1} textAnchor="middle" dominantBaseline="central" fill={C.lockedText} fontSize="9" className="font-sans">
                  {session.id}
                </text>
              )}

              <text
                x={session.x}
                y={session.y + (isMile ? r + 20 : r + 18)}
                textAnchor="middle"
                fill={st === 'completed' ? C.completedLabel : st === 'current' ? C.currentLabel : C.lockedText}
                fontSize={isMile ? '10.5' : '9.5'}
                fontWeight={st === 'current' ? '600' : isMile ? '500' : '400'}
                letterSpacing="0.04em"
                className="font-sans"
              >
                {session.label}
              </text>

              {isMile && (
                <text x={session.x} y={session.y + r + 31} textAnchor="middle" fill={C.elevText} fontSize="6.5" opacity="0.6" className="font-mono">
                  {`${session.elevation}m`}
                </text>
              )}
            </g>
          )
        })}

        {/* Scale bar */}
        <g transform={`translate(${VW / 2 - 30}, ${VH - 20})`} opacity="0.35">
          <line x1="0" y1="0" x2="60" y2="0" stroke={C.lockedText} strokeWidth="0.8" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={C.lockedText} strokeWidth="0.8" />
          <line x1="60" y1="-3" x2="60" y2="3" stroke={C.lockedText} strokeWidth="0.8" />
          <text x="30" y="-5" textAnchor="middle" fill={C.lockedText} fontSize="6" className="font-mono">{'2km'}</text>
        </g>
      </svg>
    </div>
  )
}

export const JourneyMapV2 = memo(JourneyMapV2Inner)
