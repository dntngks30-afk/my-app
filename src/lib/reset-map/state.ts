/**
 * PR-RESET-01: Reset Map Flow state transitions
 */

import type { ResetMapState } from './types';

const APPLY_FROM: ResetMapState[] = ['started', 'preview_ready'];

export function canApply(state: ResetMapState): boolean {
  return APPLY_FROM.includes(state);
}
