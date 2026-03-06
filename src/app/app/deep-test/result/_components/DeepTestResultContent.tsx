'use client';

/**
 * Deep Test 결과 UI - 앱/데모 공통 (SSOT)
 *
 * [앞으로 result 수정할 때]
 * 이 파일만 수정하면 /app/deep-test/result(로그인), /deep-test/result(데모) 둘 다 반영됨.
 * - page.tsx, DemoResultClient.tsx는 데이터 소스만 연결하고 UI는 이 컴포넌트에 위임함.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Target,
  Activity,
  ChevronRight,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { getCopy } from '@/lib/deep-result/copy';
import { toRadarScores } from '@/lib/deep-result/score-utils';
import {
  detectMissingExplainabilityFields,
  warnExplainabilityFallback,
} from '@/lib/deep-result/explainability-fallback';
import TagChips from './TagChips';

type Variant = 'app' | 'demo';

export interface DeepTestResultContentProps {
  resultType: string | null;
  confidence?: number | null;
  focusTags: string[];
  avoidTags: string[];
  algorithmScores?: {
    upper_score?: number;
    lower_score?: number;
    core_score?: number;
    balance_score?: number;
    pain_risk?: number;
  } | null;
  scoringVersion?: string;
  attemptId?: string | null;
  variant: Variant;
  onReset?: () => void;
  showPwaSection?: boolean;
  isStandalone?: boolean;
  canPromptInstall?: boolean;
  onInstallClick?: () => void;
}

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type MetricStatus = '정상' | '주의' | '위험';

function statusForPositive(score: number): { status: MetricStatus; color: string } {
  if (score >= 7) return { status: '정상', color: '#34D399' };
  if (score >= 4) return { status: '주의', color: '#FF8A00' };
  return { status: '위험', color: '#F87171' };
}

function statusForPainRisk(risk: number): { status: MetricStatus; color: string } {
  if (risk <= 3) return { status: '정상', color: '#34D399' };
  if (risk <= 6) return { status: '주의', color: '#FF8A00' };
  return { status: '위험', color: '#F87171' };
}

const TAG_LABEL: Record<string, string> = {
  thoracic_mobility: '흉추 모빌리티',
  scapular_control: '견갑 안정화',
  neck_stability: '목/경추 안정화',
  hip_mobility: '고관절 리셋',
  ankle_mobility: '발목 가동성',
  glute_medius: '중둔근 활성화',
  core_bracing: '코어 브레이싱',
  breathing_reset: '호흡 리셋',
};

function labelTag(tag: string) {
  return TAG_LABEL[tag] ?? tag.replace(/_/g, ' ');
}

function asString(v: unknown, fallback: string) {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

const center = 50;
const maxRadius = 40;
const angles = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6];

function getPos(score: number, angleIdx: number, radius = maxRadius) {
  const r = (Math.max(score, 0.4) / 10) * radius;
  return {
    x: center + r * Math.cos(angles[angleIdx]),
    y: center - r * Math.sin(angles[angleIdx]),
  };
}

export default function DeepTestResultContent({
  resultType,
  focusTags,
  avoidTags,
  algorithmScores,
  scoringVersion = 'DEEP v2',
  attemptId,
  variant,
  onReset,
  showPwaSection = false,
  isStandalone = false,
  canPromptInstall = false,
  onInstallClick,
}: DeepTestResultContentProps) {
  const [animate, setAnimate] = useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 250);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    const missing = detectMissingExplainabilityFields({
      resultType,
      focusTags,
      avoidTags,
    });
    if (missing.length > 0) {
      warnExplainabilityFallback(missing, { resultType, attemptId });
    }
  }, [resultType, focusTags, avoidTags, attemptId]);

  const radar = toRadarScores(algorithmScores ?? null);
  const r = radar as unknown as Record<string, unknown> | null;
  const mobility = clamp(
    toNum(r?.mobility ?? r?.Mobility ?? algorithmScores?.upper_score ?? 0),
    0,
    10
  );
  const stability = clamp(
    toNum(r?.stability ?? r?.Stability ?? algorithmScores?.core_score ?? 0),
    0,
    10
  );
  const painRisk = clamp(
    toNum(r?.painRisk ?? r?.pain_risk ?? algorithmScores?.pain_risk ?? 0),
    0,
    10
  );

  const mMob = statusForPositive(mobility);
  const mSta = statusForPositive(stability);
  const mPain = statusForPainRisk(painRisk);

  const metrics = [
    { id: 'mobility' as const, label: '가동성', score: mobility, status: mMob.status, statusColor: mMob.color },
    { id: 'stability' as const, label: '안정성', score: stability, status: mSta.status, statusColor: mSta.color },
    { id: 'pain' as const, label: '통증', score: painRisk, status: mPain.status, statusColor: mPain.color },
  ];

  const copy = getCopy(resultType);
  const copyAny = copy as unknown as Record<string, unknown>;

  const mainTag = asString(
    copyAny?.badgeTitle ?? copyAny?.tag ?? copyAny?.badge ?? copyAny?.bannerTag,
    '우선순위 확인'
  );
  const mainTitle = asString(
    copyAny?.headline ?? copyAny?.title ?? copyAny?.name,
    '나의 움직임 경향 요약'
  );
  const mainSummary = asString(
    copyAny?.subhead ??
      copyAny?.summary ??
      copyAny?.desc ??
      copyAny?.short ??
      (copyAny?.narrative as Record<string, unknown>)?.summary,
    '지금은 "진단"이 아니라, 오늘부터 바꿀 수 있는 우선순위를 정리한 결과입니다.'
  );

  const insightsText = (() => {
    const fromCopy = asStringArray(
      copyAny?.symptoms ?? copyAny?.insights ?? copyAny?.keyPoints ?? copyAny?.bullets
    );
    if (fromCopy.length > 0) return fromCopy.slice(0, 3);
    const a = focusTags[0]
      ? `${labelTag(focusTags[0])}이(가) 우선순위로 보입니다.`
      : '가장 약한 고리를 먼저 보강하는 게 효율적입니다.';
    const b = focusTags[1]
      ? `${labelTag(focusTags[1])}을(를) 같이 잡으면 체감이 빨라질 수 있어요.`
      : '짧게 자주(5~8분)하는 쪽이 지속에 유리합니다.';
    const c = avoidTags[0]
      ? `당분간 ${labelTag(avoidTags[0])}은(는) 강하게 밀지 않는 걸 권장해요.`
      : '통증 신호가 올라오면 범위를 줄이고 강도를 낮추세요.';
    return [a, b, c];
  })();

  const actionPlan = (() => {
    const fromCopy = asStringArray(
      copyAny?.goals7d ?? copyAny?.actionPlan ?? copyAny?.plan ?? copyAny?.nextSteps
    );
    if (fromCopy.length > 0) return fromCopy.slice(0, 3);
    if (focusTags.length > 0) return focusTags.slice(0, 3).map((t) => `${labelTag(t)} 루틴`);
    return ['가동성 5분', '안정화 5분', '호흡 2분'];
  })();

  const caution = asString(
    copyAny?.caution ?? copyAny?.disclaimer,
    '저림/방사통이 있으면 무리한 범위 확장은 피하고, 통증 없는 범위에서 진행해요.'
  );

  const reportDate = new Date().toLocaleString('ko-KR');
  const reportId = attemptId
    ? `DX-${attemptId.slice(0, 4).toUpperCase()}-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`
    : `DEMO-0000-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`;

  const labelOffset = 54;
  const labelPositions = useMemo(
    () =>
      angles.map((angle) => ({
        x: center + labelOffset * Math.cos(angle),
        y: center - labelOffset * Math.sin(angle),
      })),
    []
  );

  const actualPoints = metrics.map((m, i) => getPos(m.score, i));
  const actualPath = actualPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const nbBtnPrimaryBlock =
    'block w-full rounded-[24px] border-[3px] border-black bg-[#FFB800] py-5 text-center text-lg font-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition active:translate-x-[4px] active:translate-y-[4px] active:shadow-none uppercase tracking-widest';
  const nbBtnSecondaryBlock =
    'block w-full rounded-full border-2 border-slate-900 bg-white py-4 text-center text-base font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]';

  const isApp = variant === 'app';

  return (
    <div className="max-w-md mx-auto space-y-6">
      {variant === 'demo' && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">
          DEMO (NO LOGIN)
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#FFB800] border-[3px] border-black rounded-xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <ShieldCheck size={20} strokeWidth={3} />
          </div>
          <span className="font-black text-base tracking-tighter italic">
            심층 분석 결과
          </span>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
            {`CORE ENGINE ${scoringVersion}`}
          </p>
          <p className="text-[10px] font-black">{reportDate}</p>
        </div>
      </div>

      {/* Hero Diagnosis Card */}
      <div className="bg-white border-[3px] border-black rounded-[32px] p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 bg-[#FF8A00] text-white px-3 py-1.5 rounded-full border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Zap size={12} fill="currentColor" />
            <span className="text-base font-black tracking-wider">{mainTag}</span>
          </div>
        </div>

        <h1 className="text-[22px] font-black leading-tight mb-3 break-keep text-black">
          {mainTitle}
        </h1>
        <p className="text-gray-600 text-[13px] font-bold leading-relaxed break-keep">
          {mainSummary}
        </p>

        <div className="mt-5 flex items-center justify-between text-[10px] font-black text-gray-400">
          <span className="uppercase tracking-widest">Report</span>
          <span className="text-black">{reportId}</span>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="bg-white border-[3px] border-black rounded-[40px] p-12 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] relative overflow-visible">
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-xl font-black text-black tracking-wide">
            움직임 지표
          </h2>
          <p className="mt-2 text-[11px] font-bold text-black/60 break-keep text-center">
            통증은 낮을수록 좋음 축으로 표시됩니다.
          </p>
        </div>

        <div className="relative w-full aspect-square flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.01)_0%,transparent_70%)]" />
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible relative z-10">
            {[1, 0.66, 0.33].map((scale, i) => (
              <polygon
                key={i}
                points={`50,${50 - maxRadius * scale} ${50 + maxRadius * 0.866 * scale},${50 + maxRadius * 0.5 * scale} ${50 - maxRadius * 0.866 * scale},${50 + maxRadius * 0.5 * scale}`}
                fill="none"
                stroke="#000"
                strokeWidth="1"
                strokeOpacity="0.06"
                strokeDasharray={i === 0 ? 'none' : '2,2'}
              />
            ))}
            {angles.map((angle, i) => (
              <line
                key={i}
                x1="50"
                y1="50"
                x2={50 + maxRadius * Math.cos(angle)}
                y2={50 - maxRadius * Math.sin(angle)}
                stroke="#000"
                strokeWidth="1"
                strokeOpacity="0.04"
              />
            ))}
            <polygon
              points={actualPath}
              fill="#FF8A00"
              fillOpacity="0.55"
              stroke="#FF8A00"
              strokeWidth="2.5"
              strokeLinejoin="round"
              className={`transition-all duration-1000 ease-out ${animate ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} origin-center`}
            />
            {actualPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="1.5"
                fill="white"
                stroke="#FF8A00"
                strokeWidth="1.5"
                className={`transition-all duration-1000 delay-500 ${animate ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
          </svg>
          {metrics.map((metric, i) => (
            <div
              key={metric.id}
              style={{
                position: 'absolute',
                top: `${labelPositions[i].y}%`,
                left: `${labelPositions[i].x}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="z-20"
            >
              <div className="bg-white border-[2.5px] border-black px-3 py-1.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center min-w-[72px] transition-transform hover:-translate-y-1">
                <p className="text-[10px] font-black text-gray-500 mb-0.5 whitespace-nowrap">
                  {metric.label}
                </p>
                <div className="flex items-center gap-1 flex-nowrap">
                  <span
                    className="text-lg font-black italic tracking-tighter text-black shrink-0"
                  >
                    {metric.score.toFixed(1)}
                  </span>
                  <span
                    className="text-[8px] font-black px-1 py-0.5 rounded bg-gray-50 border border-black/10 whitespace-nowrap shrink-0"
                    style={{ color: metric.statusColor }}
                  >
                    {metric.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white border-[3px] border-black rounded-[32px] p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-lg font-black text-black mb-8 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-black rounded-full" />
          움직임 경고 신호
        </h3>
        <div className="space-y-6">
          {insightsText.map((text, i) => {
            const icon =
              i === 0 ? (
                <Activity size={20} strokeWidth={3} />
              ) : i === 1 ? (
                <Zap size={20} strokeWidth={3} />
              ) : (
                <Target size={20} strokeWidth={3} />
              );
            return (
              <div key={i} className="flex gap-5 items-start group">
                <div className="w-12 h-12 rounded-2xl bg-[#F7F3EE] border-[3px] border-black flex items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:bg-[#FFB800] transition-all">
                  {icon}
                </div>
                <p className="text-[14px] font-black text-black leading-tight pt-2 break-keep">
                  {text}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Plan */}
      <div className="bg-[#FF8A00] border-[3px] border-black rounded-[32px] p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute top-[-20px] right-[-20px] p-4 opacity-10 rotate-12 pointer-events-none">
          <Activity size={160} strokeWidth={1} />
        </div>
        <h3 className="text-lg font-black text-black mb-6 flex items-center gap-2">
          <Target size={18} strokeWidth={3} />
          7일 움직임 리셋
        </h3>
        <div className="space-y-3 relative z-10">
          {actionPlan.map((plan, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white border-[3px] border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group hover:translate-x-1 hover:-translate-y-1 transition-all active:shadow-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center text-[12px] font-black italic">
                  0{i + 1}
                </div>
                <span className="text-[14px] font-black tracking-tight break-keep">
                  {plan}
                </span>
              </div>
              <ChevronRight size={18} strokeWidth={3} className="text-gray-300 group-hover:text-black" />
            </div>
          ))}
        </div>
        <div className="mt-8 pt-5 border-t-[2.5px] border-black/10 flex items-start gap-3">
          <AlertCircle size={18} strokeWidth={3} className="shrink-0 mt-0.5" />
          <p className="text-[12px] font-black leading-snug italic opacity-90 break-keep">
            &quot;{caution}&quot;
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white border-[3px] border-black rounded-[24px] p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] mb-4">
          Tags
        </h3>
        <TagChips focusTags={focusTags} avoidTags={avoidTags} />
      </div>

      {/* CTA */}
      <div className="text-center pt-2 pb-2 space-y-4">
        <div className="inline-block px-4 py-1.5 bg-black text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_rgba(255,184,0,1)]">
          Powered by MOVE RE
        </div>

        {isApp ? (
          <>
            <Link href="/app/home" className={nbBtnPrimaryBlock}>
              움직임 리셋 시작하기
            </Link>
            <Link href="/app/home" className={nbBtnSecondaryBlock}>
              홈으로
            </Link>
            <Link
              href="/app/deep-test"
              className="block w-full rounded-full border-2 border-slate-300 bg-white py-3 text-center text-sm font-medium text-slate-600 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
            >
              심화 테스트 다시하기
            </Link>
          </>
        ) : (
          <div className="flex gap-3">
            <Link href="/deep-test/run" className={nbBtnPrimaryBlock}>
              다시 하기
            </Link>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="block w-full rounded-full border-2 border-slate-900 bg-white py-4 text-center text-base font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
              >
                초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* PWA Section (app only) */}
      {showPwaSection && (
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] space-y-3">
          <h2 className="text-sm font-bold text-slate-800">앱으로 설치하기</h2>
          <p className="text-xs text-stone-600">
            {isStandalone ? '앱에서 실행 중' : '홈 화면에 설치하면 앱처럼 실행'}
          </p>
          <div className="flex flex-wrap gap-2">
            {canPromptInstall && onInstallClick && (
              <button
                type="button"
                onClick={onInstallClick}
                className="flex-1 min-w-[120px] rounded-full border-2 border-slate-900 bg-slate-800 py-3 text-center text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
              >
                바로 설치하기
              </button>
            )}
            <Link
              href="/app/install?from=/app/deep-test/result"
              className="flex-1 min-w-[120px] rounded-full border-2 border-slate-900 bg-white py-3 text-center text-sm font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
            >
              설치 방법 보기
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
