'use client';

/**
 * ResetMapCard — 리셋 지도 (세션 여정 시각화)
 *
 * 배경 트랙 + 러너 overlay. completed_sessions에 따라 러너가 START→FINISH로 이동.
 * total_sessions: 8/12/16/20
 *
 * debugMap=1: 디버그 캘리브레이션 툴 (점 선택, 방향키, Copy TRACK 등)
 * ts/cs URL 파라미터: 러너 위치 강제 override
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { TRACK_V1 } from '@/lib/home/reset-map-track';

type TrackPoint = { x: number; y: number };

function segmentLength(a: TrackPoint, b: TrackPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getTrackLength(track: TrackPoint[]): number {
  let len = 0;
  for (let i = 1; i < track.length; i++) {
    len += segmentLength(track[i - 1], track[i]);
  }
  return len;
}

const RATIO_EPS = 1e-10;

function getRunnerPosition(track: TrackPoint[], progressRatio: number): TrackPoint {
  if (!track.length) return { x: 0, y: 0 };
  const lastIdx = track.length - 1;
  if (progressRatio <= 0) return track[0];
  if (progressRatio >= 1 - RATIO_EPS) return track[lastIdx];

  const totalLen = getTrackLength(track);
  const targetDist = progressRatio * totalLen;

  let acc = 0;
  for (let i = 1; i < track.length; i++) {
    const segLen = segmentLength(track[i - 1], track[i]);
    if (acc + segLen >= targetDist) {
      const t = segLen > 0 ? Math.min(1, (targetDist - acc) / segLen) : 1;
      return {
        x: track[i - 1].x + t * (track[i].x - track[i - 1].x),
        y: track[i - 1].y + t * (track[i].y - track[i - 1].y),
      };
    }
    acc += segLen;
  }
  return track[lastIdx];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const STEP_NORMAL = 0.005;
const STEP_SHIFT = 0.01;
const STEP_ALT = 0.001;

type ResetMapCardProps = {
  totalSessions: number;
  completedSessions: number;
  debugMap?: boolean;
  /** URL ts/cs override: ts=total, cs=completed */
  totalSessionsOverride?: number;
  completedSessionsOverride?: number;
};

export default function ResetMapCard({
  totalSessions,
  completedSessions,
  debugMap = false,
  totalSessionsOverride,
  completedSessionsOverride,
}: ResetMapCardProps) {
  const [trackImgError, setTrackImgError] = useState(false);
  const [runnerImgError, setRunnerImgError] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const effTotal = totalSessionsOverride ?? totalSessions;
  const effCompleted = completedSessionsOverride ?? completedSessions;
  const ratioRaw = effTotal > 0 ? effCompleted / effTotal : 0;
  const progressRatio = Math.max(0, Math.min(1, ratioRaw));

  const weeklyFrequency = totalSessions / 4;

  const [track, setTrack] = useState<TrackPoint[]>(TRACK_V1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeTrack = debugMap ? track : TRACK_V1;
  const runnerPos = getRunnerPosition(activeTrack, progressRatio);

  useEffect(() => {
    if (!debugMap || process.env.NODE_ENV === 'production') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.altKey ? STEP_ALT : e.shiftKey ? STEP_SHIFT : STEP_NORMAL;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;

      e.preventDefault();
      setTrack((prev) => {
        const next = [...prev];
        const p = next[selectedIndex];
        next[selectedIndex] = {
          x: clamp(p.x + dx),
          y: clamp(p.y + dy),
        };
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debugMap, selectedIndex]);

  const handleCopyTrack = async () => {
    const text = JSON.stringify(
      track.map((p) => ({ x: p.x, y: p.y })),
      null,
      2
    );
    await navigator.clipboard.writeText(text);
    setCopyToast('TRACK 복사됨');
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleReset = () => {
    setTrack([...TRACK_V1]);
    setCopyToast('Reset됨');
    setTimeout(() => setCopyToast(null), 1500);
  };

  const handleCopySelected = async () => {
    const p = track[selectedIndex];
    const text = `${selectedIndex}, { x: ${p.x.toFixed(3)}, y: ${p.y.toFixed(3)} }`;
    await navigator.clipboard.writeText(text);
    setCopyToast('선택점 복사됨');
    setTimeout(() => setCopyToast(null), 1500);
  };

  const stepLabel = 'Alt:0.001 / 기본:0.005 / Shift:0.01';

  return (
    <section className="relative rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">리셋 지도</h3>
        <span className="text-xs font-medium text-slate-500">
          주당 {weeklyFrequency}회 · 4주 여정(총 {totalSessions}회)
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-xl bg-slate-100"
        style={{ aspectRatio: '2048/1529' }}
      >
        {/* 배경: 이미지 또는 SVG 트랙 */}
        <div className="absolute inset-0">
          {!trackImgError ? (
            <Image
              src="/ui/reset-map-track.png"
              alt="리셋 트랙"
              fill
              className="object-cover"
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

        {/* 러너 overlay — 모바일 45px, 데스크톱 180px */}
        <div
          className="absolute z-10 w-[75px] h-[75px] md:w-[180px] md:h-[180px] transition-all duration-[350ms] ease-out"
          style={{
            left: `${runnerPos.x * 100}%`,
            top: `${runnerPos.y * 100}%`,
            transform: 'translate(-50%, -65%)',
          }}
        >
          {!runnerImgError ? (
            <Image
              src="/ui/reset-map-runner.png"
              alt="러너"
              fill
              className="object-contain mix-blend-multiply drop-shadow-md"
              onError={() => setRunnerImgError(true)}
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-full bg-orange-400 text-white shadow-lg">
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

        {/* 디버그 오버레이 — debugMap=1일 때만 */}
        {debugMap && process.env.NODE_ENV !== 'production' && (
          <>
            {track.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={`absolute rounded-full outline-none transition-all focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
                  selectedIndex === i
                    ? 'size-4 border-2 border-orange-500 bg-orange-400'
                    : 'size-2 bg-blue-500 hover:size-3'
                }`}
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-label={`점 ${i} 선택`}
              />
            ))}
            {track.map((p, i) => (
              <span
                key={`label-${i}`}
                className="absolute z-20 text-[10px] font-mono font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  transform: 'translate(4px, -50%)',
                }}
              >
                {i}
              </span>
            ))}
            <div
              className="absolute z-20 size-4 rounded-full border-2 border-red-500 bg-red-500/30"
              style={{
                left: `${runnerPos.x * 100}%`,
                top: `${runnerPos.y * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </>
        )}
      </div>

      {/* 디버그 패널 — debugMap=1일 때만 (지도 바깥, 하단) */}
      {debugMap && process.env.NODE_ENV !== 'production' && (
        <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100 p-3 text-xs">
          <div className="mb-2 font-mono text-slate-700">
            effCompleted={effCompleted} effTotal={effTotal} · ratio=
            {progressRatio.toFixed(3)}
          </div>
          <div className="mb-1 font-mono text-slate-700">
            pos.x={runnerPos.x.toFixed(3)} pos.y={runnerPos.y.toFixed(3)}
          </div>
          <div className="mb-2 font-mono text-slate-700">
            selectedIndex={selectedIndex} · x={track[selectedIndex]?.x.toFixed(3)} y=
            {track[selectedIndex]?.y.toFixed(3)}
          </div>
          <div className="mb-2 text-slate-600">{stepLabel}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyTrack}
              className="rounded bg-slate-800 px-2 py-1 font-medium text-white hover:bg-slate-700"
            >
              Copy TRACK
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded bg-slate-600 px-2 py-1 font-medium text-white hover:bg-slate-500"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleCopySelected}
              className="rounded bg-slate-600 px-2 py-1 font-medium text-white hover:bg-slate-500"
            >
              Copy Selected
            </button>
          </div>
          <p className="mt-2 text-slate-500">
            Copy TRACK → reset-map-track.ts의 TRACK_V1 배열에 교체
          </p>
          {copyToast && (
            <p className="mt-1 text-green-600 font-medium">{copyToast}</p>
          )}
        </div>
      )}
    </section>
  );
}
