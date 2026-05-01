/**
 * Client-only image URL warmup: fills HTTP cache before next/image mounts.
 * Duplicate-safe, non-throwing, deferred to idle time when available.
 */

const warmed = new Set<string>();

export type WarmupImagesOptions = {
  /** Delay before scheduling idle work (default 250). */
  delayMs?: number;
};

function scheduleIdleLoad(load: () => void): { handle: number; kind: 'idle' | 'timeout' } {
  const w = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
    };
  if (typeof w.requestIdleCallback === 'function') {
    return { handle: w.requestIdleCallback(() => load(), { timeout: 2000 }), kind: 'idle' };
  }
  return { handle: window.setTimeout(load, 0), kind: 'timeout' };
}

export function warmupImages(srcs: readonly string[], options?: WarmupImagesOptions): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const delayMs = options?.delayMs ?? 250;
  let secondPhase: { handle: number; kind: 'idle' | 'timeout' } | undefined;
  const delayHandle = window.setTimeout(() => {
    secondPhase = scheduleIdleLoad(() => {
      for (const src of srcs) {
        if (!src || warmed.has(src)) continue;
        warmed.add(src);
        try {
          const img = new window.Image();
          img.decoding = 'async';
          img.src = src;
        } catch {
          /* ignore — warmup is best-effort */
        }
      }
    });
  }, delayMs);

  return () => {
    window.clearTimeout(delayHandle);
    if (!secondPhase) return;
    const w = window as Window &
      typeof globalThis & { cancelIdleCallback?: (handle: number) => void };
    if (secondPhase.kind === 'idle' && typeof w.cancelIdleCallback === 'function') {
      w.cancelIdleCallback(secondPhase.handle);
    } else {
      window.clearTimeout(secondPhase.handle);
    }
  };
}
