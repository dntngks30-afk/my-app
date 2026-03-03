'use client';

/**
 * ResetMapCard — 리셋 지도 (세션 여정 시각화)
 *
 * 배경 트랙 + 러너 overlay. completed_sessions에 따라 러너가 START→FINISH로 이동.
 * total_sessions: 8/12/16/20
 */

import { useMemo, useState } from 'react';
import Image from 'next/image';

/** 폴리라인 기반 트랙 좌표 (0~1 비율, 컨테이너 기준) */
const TRACK: { x: number; y: number }[] = [
  { x: 0.16, y: 0.12 },
  { x: 0.88, y: 0.12 },
  { x: 0.88, y: 0.32 },
  { x: 0.2, y: 0.32 },
  { x: 0.2, y: 0.52 },
  { x: 0.86, y: 0.52 },
  { x: 0.86, y: 0.72 },
  { x: 0.21, y: 0.72 },
  { x: 0.21, y: 0.88 },
  { x: 0.86, y: 0.88 },
];

function segmentLength(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getTrackLength(): number {
  let len = 0;
  for (let i = 1; i < TRACK.length; i++) {
    len += segmentLength(TRACK[i - 1], TRACK[i]);
  }
  return len;
}

function getRunnerPosition(progressRatio: number): { x: number; y: number } {
  if (progressRatio <= 0) return TRACK[0];
  if (progressRatio >= 1) return TRACK[TRACK.length - 1];

  const totalLen = getTrackLength();
  const targetDist = progressRatio * totalLen;

  let acc = 0;
  for (let i = 1; i < TRACK.length; i++) {
    const segLen = segmentLength(TRACK[i - 1], TRACK[i]);
    if (acc + segLen >= targetDist) {
      const t = (targetDist - acc) / segLen;
      return {
        x: TRACK[i - 1].x + t * (TRACK[i].x - TRACK[i - 1].x),
        y: TRACK[i - 1].y + t * (TRACK[i].y - TRACK[i - 1].y),
      };
    }
    acc += segLen;
  }
  return TRACK[TRACK.length - 1];
}

type ResetMapCardProps = {
  totalSessions: number;
  completedSessions: number;
  debugMap?: boolean;
};

export default function ResetMapCard({
  totalSessions,
  completedSessions,
  debugMap = false,
}: ResetMapCardProps) {
  const [trackImgError, setTrackImgError] = useState(false);
  const [runnerImgError, setRunnerImgError] = useState(false);

  const weeklyFrequency = totalSessions / 4;
  const progressRatio =
    totalSessions === 0 ? 0 : Math.min(1, completedSessions / totalSessions);
  const runnerPos = useMemo(() => getRunnerPosition(progressRatio), [progressRatio]);

  return (
    <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">리셋 지도</h3>
        <span className="text-xs font-medium text-slate-500">
          주당 {weeklyFrequency}회 · 4주 여정(총 {totalSessions}회)
        </span>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        {/* 배경: 이미지 또는 SVG 트랙 */}
        <div className="absolute inset-0">
          {!trackImgError ? (
            <Image
              src="/ui/reset-map-track.png"
              alt="리셋 트랙"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 400px"
              onError={() => setTrackImgError(true)}
            />
          ) : null}
          {trackImgError && (
            <svg
              className="absolute inset-0 w-full h-full object-contain"
              viewBox="0 0 400 300"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
              </defs>
              <path
                d="M 64 36 L 352 36 L 352 96 L 80 96 L 80 156 L 344 156 L 344 216 L 84 216 L 84 264 L 344 264"
                fill="none"
                stroke="url(#trackGrad)"
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text x="64" y="36" fontSize="10" fontWeight="bold" fill="#64748b">
                START
              </text>
              <text x="320" y="264" fontSize="10" fontWeight="bold" fill="#64748b">
                FINISH
              </text>
            </svg>
          )}
        </div>

        {/* 러너 overlay */}
        <div
          className="absolute z-10 transition-all duration-[350ms] ease-out"
          style={{
            left: `${runnerPos.x * 100}%`,
            top: `${runnerPos.y * 100}%`,
            transform: 'translate(-50%, -70%)',
          }}
        >
          {!runnerImgError ? (
            <Image
              src="/ui/reset-map-runner.png"
              alt="러너"
              width={48}
              height={48}
              className="object-contain"
              onError={() => setRunnerImgError(true)}
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-orange-400 text-white shadow-lg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          )}
        </div>

        {/* 디버그 오버레이 */}
        {debugMap && process.env.NODE_ENV !== 'production' && (
          <>
            {TRACK.map((p, i) => (
              <div
                key={i}
                className="absolute size-2 rounded-full bg-blue-500"
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
            <div
              className="absolute size-4 rounded-full border-2 border-red-500 bg-red-500/30"
              style={{
                left: `${runnerPos.x * 100}%`,
                top: `${runnerPos.y * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}
