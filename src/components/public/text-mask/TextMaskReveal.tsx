'use client';

/**
 * 공개 퍼널 랜드마크 헤드라인용 — 좌→우 clip 마스크 진입 (1회).
 * /app·실행 UI에는 사용하지 말 것.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { usePublicReducedMotion } from '@/lib/public/motion';
import { cn } from '@/lib/utils';

export type TextMaskRevealProps = {
  children: ReactNode;
  /** 타이포/레이아웃용 — 보통 부모 제목에 두고 inner에만 부착 */
  className?: string;
  /** 씬 콘텐츠 레이어 전환(~260ms) 직후 겹침 완화 */
  delaySec?: number;
  /** 마스크 스윕 시간 */
  durationSec?: number;
};

export function TextMaskReveal({
  children,
  className,
  delaySec = 0.1,
  durationSec = 0.7,
}: TextMaskRevealProps) {
  const reduced = usePublicReducedMotion();

  if (reduced !== false) {
    return <span className={cn('block w-full', className)}>{children}</span>;
  }

  return (
    <motion.span
      className={cn('block w-full', className)}
      initial={{ clipPath: 'inset(-0.06em 100% -0.06em 0)' }}
      animate={{ clipPath: 'inset(-0.06em 0% -0.06em 0)' }}
      transition={{
        duration: durationSec,
        delay: delaySec,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.span>
  );
}
