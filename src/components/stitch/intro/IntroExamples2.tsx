'use client';

/**
 * stitch code.html Screen 5 — Examples 2 (glass 비교 카드)
 */
import Image from 'next/image';
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroExamples2() {
  return (
    <IntroSceneShell currentPath="/intro/examples/2">
      <div className="w-full max-w-4xl px-2 text-center">
        <h2
          className="mb-6 text-[#dce1fb]"
          style={{
            fontFamily: '"Noto Serif KR"',
            fontSize: '22px',
            fontWeight: 600,
            lineHeight: '27px',
            letterSpacing: '-1.2px',
          }}
        >
          반복되는 보상 패턴은
          <br />
          몸에{' '}
          <span
            className="font-bold"
            style={{ color: 'rgba(252, 185, 115, 1)', fontSize: '24px' }}
          >
            흔적
          </span>을 남깁니다
        </h2>

        <p
          className="mb-12 font-light text-[#c6c6cd]"
          style={{
            fontFamily: '"Noto Sans KR"',
            fontSize: '14px',
            lineHeight: '18px',
            letterSpacing: '-1px',
          }}
        >
          한쪽으로 쏠린 힘의 불균형이
          <br />
          당신의 골격 구조를 변형시키고 있습니다.
        </p>

        <div className="flex flex-col items-stretch gap-8 md:flex-row md:justify-center">
          <div className="flex-1 overflow-hidden rounded-lg border border-white/10 bg-[rgba(46,52,71,0.4)] backdrop-blur-xl">
            <div className="relative h-[280px] overflow-hidden bg-[#2e3447] md:h-[360px]">
              <Image
                src="/intro/balanced-alignment.png"
                alt="균형 잡힌 정렬을 나타내는 정면 실루엣과 중앙 수직 정렬선"
                fill
                className="bg-[#2e3447] object-cover object-[center_31%]"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#0c1324]/95 via-[#0c1324]/50 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br from-cyan-400/10 to-transparent opacity-80"
              />
              <div className="absolute inset-x-0 bottom-0 top-px z-10 flex flex-col justify-end p-6 text-left md:p-8">
                <span className="mb-2 inline-block w-max bg-[#ffb77d]/20 px-3 py-1 text-xs uppercase tracking-widest text-[#ffb77d]">
                  Optimal
                </span>
                <p className="text-lg font-light text-white" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                  균형 잡힌 정렬
                </p>
                <p
                  className="mt-1 max-w-full text-left text-sm font-light text-[#c6c6cd]"
                  style={{ fontFamily: '"Noto Sans KR"', lineHeight: 1.5 }}
                >
                  무게 중심이 중앙에 위치하여
                  <br />
                  관절의 마모를 최소화합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-lg border border-white/10 bg-[rgba(46,52,71,0.4)] backdrop-blur-xl">
            <div className="relative h-[280px] overflow-hidden bg-[#2e3447] md:h-[360px]">
              <Image
                src="/intro/asymmetric-compensation.png"
                alt="비대칭적 보상을 나타내는 실루엣과 휘어진 중심선"
                fill
                className="bg-[#2e3447] object-cover object-[center_37%]"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#0c1324]/95 via-[#0c1324]/50 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br from-orange-500/25 to-transparent opacity-80"
              />
              <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 text-left md:p-8">
                <span className="mb-2 inline-block w-max bg-[#2e3447] px-3 py-1 text-xs uppercase tracking-widest text-[#c6c6cd]">
                  Pattern 02
                </span>
                <p className="text-lg font-light text-white" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                  비대칭적 보상
                </p>
                <p
                  className="mt-1 max-w-full text-left text-sm font-light text-[#c6c6cd]"
                  style={{ fontFamily: '"Noto Sans KR"', lineHeight: 1.2 }}
                >
                  특정 근육의 과사용으로 인해
                  <br />
                  골반이 회전된 상태입니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <IntroStepIndicator step={3} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
