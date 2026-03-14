/**
 * PR-RESET-01: Reset Map Flow state transitions
 * PR-RESET-04: preview gate state check
 * PR-RESET-08: apply only from preview_ready (true execution-entry gate)
 */

import type { ResetMapState } from './types';

/** PR-RESET-08: Apply allowed only when preview has passed. */
export function canApply(state: ResetMapState): boolean {
  return state === 'preview_ready';
}

/** Only started flows can receive preview evaluation. */
export function canReceivePreview(state: ResetMapState): boolean {
  return state === 'started';
}
