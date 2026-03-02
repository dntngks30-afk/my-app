'use client';

/**
 * 3축 레이더 차트 (순수 SVG, 라이브러리 없음)
 * mobility / stability / painRisk
 */

import type { RadarScores } from '@/lib/deep-result/score-utils';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';

interface RadarChartProps {
  scores: RadarScores | null;
  maxScore?: number;
  size?: number;
}

const AXES = [
  { key: 'mobility' as const, label: '가동성', angleDeg: -90 },
  { key: 'stability' as const, label: '안정성', angleDeg: 30 },
  { key: 'painRisk' as const, label: '통증 위험', angleDeg: 150 },
];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export default function RadarChart({
  scores,
  maxScore = 10,
  size = 240,
}: RadarChartProps) {
  if (!scores) {
    return (
      <div className={`${nbCard} flex items-center justify-center min-h-[280px]`}>
        <p className="text-sm text-stone-500">스코어를 계산 중이에요</p>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;

  const points = AXES.map((axis) => {
    const raw = scores[axis.key];
    const clamped = clamp(raw, 0, maxScore);
    const normalized = clamped / maxScore;
    const r = radius * normalized;
    const rad = degToRad(axis.angleDeg);
    const x = cx + r * Math.cos(rad);
    const y = cy - r * Math.sin(rad);
    return { x, y, label: axis.label };
  });

  const pathData = points.map((p) => `${p.x},${p.y}`).join(' ');

  const gridLevels = [0.33, 0.66, 1.0];
  const gridPaths = gridLevels.map((level) => {
    const pts = AXES.map((axis) => {
      const r = radius * level;
      const rad = degToRad(axis.angleDeg);
      const x = cx + r * Math.cos(rad);
      const y = cy - r * Math.sin(rad);
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')} Z`;
  });

  const labelRadius = radius * 1.15;
  const labels = AXES.map((axis) => {
    const rad = degToRad(axis.angleDeg);
    const x = cx + labelRadius * Math.cos(rad);
    const y = cy - labelRadius * Math.sin(rad);
    return { x, y, label: axis.label };
  });

  return (
    <div className={nbCard}>
      <div className="flex flex-col items-center">
        <svg
          role="img"
          aria-label="가동성, 안정성, 통증 위험 레이더 차트"
          width={size}
          height={size}
          className="overflow-visible"
        >
          {/* 배경 그리드 */}
          <g stroke="rgb(203 213 225)" strokeWidth="1" fill="none">
            {gridPaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* 데이터 영역 */}
          <polygon
            points={pathData}
            fill="rgba(251 146 60 / 0.5)"
            stroke="rgb(251 146 60)"
            strokeWidth="2"
          />

          {/* 축 라벨 */}
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-medium fill-slate-600"
            >
              {l.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
