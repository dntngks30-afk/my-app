'use client';

/**
 * 카메라 진입 prep scene — stitch screen 31
 */
import { Camera } from 'lucide-react';
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';

export type CameraEntryProps = {
  onStart: () => void;
};

const INFO_LINES = [
  '짧은 동작 촬영 후 움직임을 확인합니다.',
  '영상은 저장하지 않습니다.',
  '몸의 주요 관절 위치를 점으로 읽어 움직임만 분석합니다.',
] as const;

export default function CameraEntry({ onStart }: CameraEntryProps) {
  return (
    <StitchSceneShell contentEnter="off">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-5 text-center md:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 md:gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[#ffb77d]/30 bg-[#151b2d]/60 md:h-28 md:w-28">
            <Camera className="size-11 text-[#ffb77d] md:size-[3.25rem]" strokeWidth={1.25} aria-hidden />
          </div>

          <div className="space-y-2.5">
            <h1 className="text-[1.65rem] font-light leading-tight text-[#dce1fb] md:text-4xl [font-family:var(--font-display)]">
              AI 기반 카메라 분석
            </h1>
            <p
              className="text-[13px] font-light leading-snug text-[#dce1fb]/82 md:text-sm md:leading-relaxed"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              카메라를 사용해 2가지 동작을 촬영합니다.
              <br />
              스쿼트와 팔 들어올리기 동작을 통해 움직임 패턴을 확인합니다.
            </p>
          </div>

          <div className="w-full rounded-xl border border-[#ffb77d]/22 bg-[#151b2d]/75 px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,183,125,0.06)] md:px-4">
            <p
              className="mb-2 text-[13px] font-medium text-[#dce1fb]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              분석은 이렇게 진행돼요
            </p>
            <ul className="space-y-1.5" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {INFO_LINES.map((line) => (
                <li key={line} className="flex gap-2 text-[11.5px] font-light leading-snug text-[#c6c6cd] md:text-xs">
                  <span className="shrink-0 text-[#ffb77d]/85" aria-hidden>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex w-full flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={onStart}
              className="w-full max-w-xs rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-3.5 text-base font-medium text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.06)] transition-all hover:brightness-110 md:py-4"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              시작하기
            </button>
            <p
              className="max-w-[280px] text-[11px] font-light leading-snug text-[#c6c6cd]/95 md:max-w-xs"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              본 분석은 의학적 진단이 아닌 운동 참고용입니다.
            </p>
          </div>
        </div>
      </main>
    </StitchSceneShell>
  );
}
