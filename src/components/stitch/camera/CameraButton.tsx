'use client';

import type { ReactNode } from 'react';

export type StitchCameraPrimaryButtonProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
};

/** 카메라 챕터 primary/outline — 완료·촬영 화면 공통 */
export function StitchCameraPrimaryButton({
  children,
  onClick,
  disabled,
  variant = 'solid',
}: StitchCameraPrimaryButtonProps) {
  const base =
    'w-full min-h-[48px] rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none';
  if (variant === 'outline') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${base} border border-[#ffb77d]/35 text-[#dce1fb] hover:bg-white/5`}
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] hover:brightness-110`}
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      {children}
    </button>
  );
}

export type StitchCameraGhostButtonProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

/** 최저 위계 텍스트형 액션 (예: 홈으로) */
export function StitchCameraGhostButton({
  children,
  onClick,
  disabled,
}: StitchCameraGhostButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[44px] rounded-lg text-sm font-medium text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300 disabled:pointer-events-none disabled:opacity-50"
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      {children}
    </button>
  );
}

export type StitchCameraMutedOutlineButtonProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

/** 성공 분기에서 설문 등 보조 트랙용 — outline보다 한 단계 낮은 위계 */
export function StitchCameraMutedOutlineButton({
  children,
  onClick,
  disabled,
}: StitchCameraMutedOutlineButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[48px] rounded-lg border border-white/12 bg-transparent text-sm font-medium text-slate-400 transition-colors hover:border-white/18 hover:bg-white/[0.03] hover:text-slate-300 disabled:pointer-events-none disabled:opacity-50"
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      {children}
    </button>
  );
}
