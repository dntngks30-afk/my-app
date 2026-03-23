'use client';

import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';

export type BaselineResultStep1Props = {
  titlePrefix: string;
  typeLabel: string;
  typeColor: string;
  secondaryTendencyLine: string | null;
  brief: string;
  bullets: string[];
  onNext: () => void;
};

/**
 * stitch screen 28 — 시작점 타입 영웅 씬 (PR-UI-RESULT-BENTO-05)
 * 동심원 차트 제거, 히어로 아이덴티티 블록 + 벤토 신호 타일로 개편.
 * 단계 계약·동적 슬롯 의미 유지.
 */
export function BaselineResultStep1({
  titlePrefix,
  typeLabel,
  typeColor,
  secondaryTendencyLine,
  brief,
  bullets,
  onNext,
}: BaselineResultStep1Props) {
  const [tile0, tile1, tile2] = bullets;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pt-1">

        {/* ── 히어로 아이덴티티 블록 ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1520]/70 px-5 py-6 backdrop-blur-sm">
          <span
            className="block text-[10px] font-light uppercase tracking-[0.28em] text-[#ffb77d]/70"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {titlePrefix}
          </span>
          <h2
            className="mt-3 break-keep text-[2.1rem] font-light leading-[1.18] tracking-wide md:text-[2.6rem]"
            style={{ color: typeColor, fontFamily: 'var(--font-display)' }}
          >
            {typeLabel}
          </h2>
          <p
            className="mt-3 break-keep text-sm leading-relaxed text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {brief}
          </p>
          {secondaryTendencyLine ? (
            <p
              className="mt-2 break-keep text-xs text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {secondaryTendencyLine}
            </p>
          ) : null}
        </div>

        {/* ── 벤토 신호 타일 ── */}
        {bullets.length > 0 && (
          <div className="space-y-2.5">
            {/* 첫 두 타일: 2열 사이드-바이-사이드 */}
            {tile0 && tile1 ? (
              <div className="grid grid-cols-2 gap-2.5">
                <BentoSignalTile accent>{tile0}</BentoSignalTile>
                <BentoSignalTile>{tile1}</BentoSignalTile>
              </div>
            ) : tile0 ? (
              <BentoSignalTile accent>{tile0}</BentoSignalTile>
            ) : null}
            {/* 세 번째 타일: 전폭 스트립 */}
            {tile2 ? (
              <BentoSignalTile>{tile2}</BentoSignalTile>
            ) : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-[#0c1324]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
        <StitchBottomNavRow
          right={
            <button
              type="button"
              onClick={onNext}
              className="w-full min-h-[52px] rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-3.5 text-sm font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음 — 왜 이런 패턴인지 보기
            </button>
          }
        />
      </div>
    </>
  );
}

type BentoSignalTileProps = {
  children: string;
  accent?: boolean;
};

function BentoSignalTile({ children, accent }: BentoSignalTileProps) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3.5 backdrop-blur-sm ${
        accent
          ? 'border-[#ffb77d]/18 bg-[#ffb77d]/[0.07]'
          : 'border-white/[0.06] bg-[#151b2d]/45'
      }`}
    >
      <p
        className={`break-keep text-sm leading-relaxed ${
          accent ? 'text-[#fce9dc]' : 'text-[#c6c6cd]'
        }`}
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {children}
      </p>
    </div>
  );
}
