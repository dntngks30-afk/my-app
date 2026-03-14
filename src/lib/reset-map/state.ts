/**
 * PR-RESET-01: Reset Map Flow state transitions
 * PR-RESET-04: preview gate state check
 */

import type { ResetMapState } from './types';

const APPLY_FROM: ResetMapState[] = ['started', 'preview_ready'];

export function canApply(state: ResetMapState): boolean {
  return APPLY_FROM.includes(state);
}

/** Only started flows can receive preview evaluation. */
export function canReceivePreview(state: ResetMapState): boolean {
  return state === 'started';
}
