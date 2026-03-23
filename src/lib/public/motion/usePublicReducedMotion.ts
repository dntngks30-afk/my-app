'use client';

import { useEffect, useState } from 'react';

/**
 * `prefers-reduced-motion` (공개 퍼널 장식용).
 * SSR 및 첫 페인트 직전에는 `null` — 장식 비디오/모션은 이 값이 `false`일 때만 재생하는 것이 안전하다.
 */
export function usePublicReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}
