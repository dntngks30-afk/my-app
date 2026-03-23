'use client';

/**
 * 카메라 진입 prep scene — stitch screen 31
 */
import { Camera } from 'lucide-react';
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';

export type CameraEntryProps = {
  onStart: () => void;
};

export default function CameraEntry({ onStart }: CameraEntryProps) {
  return (
    <StitchSceneShell contentEnter="off">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center">
        <div className="mx-auto w-full max-w-md space-y-10">
          <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-[#ffb77d]/30 bg-[#151b2d]/60">
            <Camera className="size-14 text-[#ffb77d]" strokeWidth={1.25} aria-hidden />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-light text-[#dce1fb] md:text-4xl [font-family:var(--font-display)]">
              AI 기반 카메라 분석
            </h1>
            <div className="space-y-3 text-sm font-light leading-relaxed text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              <p>
                카메라를 사용해 2가지 동작을 촬영합니다.
                <br />
                전신이 보이도록 프레임에 맞춰 주세요.
              </p>
              <p className="text-xs text-slate-500">본 분석은 의학적 진단이 아니며 참고용입니다.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="w-full max-w-xs rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-4 text-base font-medium text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.06)] transition-all hover:brightness-110"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            시작하기
          </button>
        </div>
      </main>
    </StitchSceneShell>
  );
}
