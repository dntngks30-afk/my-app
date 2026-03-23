'use client';

import type { ReactNode } from 'react';
import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';

export type BaselineResultStep1Props = {
  /** "지금의 시작점" 등 스테이지 eyebrow 텍스트 */
  titlePrefix: string;
  /** PRIMARY_TYPE_DISPLAY_NAMES 기반 사용자 친화적 타입 표시명 */
  typeLabel: string;
  typeColor: string;
  secondaryTendencyLine: string | null;
  /** PRIMARY_TYPE_BRIEF — 현재 몸 상태를 행동 언어로 설명하는 단락 */
  brief: string;
  /** PRIMARY_TYPE_CAREFUL_MOVEMENTS 첫 2개 — 주의할 점 블록용 */
  carefulItems: string[];
  /** PRIMARY_TYPE_START_HOOK — 첫 리셋 방향 quote */
  hook: string;
  onNext: () => void;
};

/**
 * stitch screen 28 — 기준점 타입 영웅 씬 (PR-BASELINE-TYPE-TRANSPLANT-05A)
 * Stitch 디자인 레퍼런스 이식: 히어로 + bento-glow 인사이트 + 주의 + 리셋 방향.
 * 단계 계약·동적 슬롯 의미·result truth 유지.
 */
export function BaselineResultStep1({
  titlePrefix,
  typeLabel,
  typeColor,
  secondaryTendencyLine,
  brief,
  carefulItems,
  hook,
  onNext,
}: BaselineResultStep1Props) {
  const cautionRows = carefulItems.slice(0, 2);

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pt-2">

        {/* ── 히어로 섹션 ── */}
        <section className="text-center">
          <span
            className="block text-sm italic text-[#ffb77d]/80 tracking-wide [font-family:var(--font-display)]"
          >
            {titlePrefix}
          </span>
          <h2
            className="mt-3 break-keep text-[1.95rem] font-light leading-[1.2] tracking-wide [font-family:var(--font-display)]"
            style={{ color: typeColor }}
          >
            {typeLabel}
          </h2>
          {secondaryTendencyLine ? (
            <p
              className="mt-2 break-keep text-xs text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {secondaryTendencyLine}
            </p>
          ) : null}
          <div className="mx-auto mt-5 h-px w-10 bg-[#ffb77d]/20" />
        </section>

        {/* ── Primary Insight Block (Type Essence, bento-glow) ── */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(255,183,125,0.09), transparent 65%), #23293c',
          }}
        >
          <p
            className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#fcb973]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            지금의 패턴
          </p>
          <p
            className="break-keep text-sm leading-relaxed text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {brief}
          </p>
        </div>

        {/* ── Caution Block (주의할 점) ── */}
        {cautionRows.length > 0 ? (
          <div className="rounded-2xl bg-[#2e3447] px-5 py-5">
            <p
              className="mb-4 text-[10px] uppercase tracking-[0.22em] text-[#fcb973]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              주의할 점
            </p>
            <ul className="space-y-3">
              {cautionRows.map((item, i) => (
                <li key={i} className="flex gap-3 break-keep text-sm leading-relaxed text-[#c6c6cd]">
                  <span className="mt-0.5 shrink-0 text-[#fcb973]/50" aria-hidden>
                    ·
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans-noto)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ── Reset Direction Block (첫 리셋 방향) ── */}
        <div className="rounded-2xl border-l-2 border-[#ffb77d]/20 bg-[#151b2d] px-5 py-5">
          <p
            className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#ffb68e]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            첫 리셋 방향
          </p>
          <p
            className="break-keep text-base italic leading-relaxed text-[#dce1fb] [font-family:var(--font-display)]"
          >
            "{hook}"
          </p>
        </div>

      </div>

      <ResultStitchFooter>
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
      </ResultStitchFooter>
    </>
  );
}

function ResultStitchFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[#0c1324]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
      {children}
    </div>
  );
}
