/**
 * PR-RESET-09: Server/client reconciliation for reset-map flow.
 * Server truth precedence. Centralized repair/clear logic.
 */

import type { ResetMapClientState } from './clientStorage';

const ACTIVE_STATES = ['started', 'preview_ready'];

export type LatestFlow = {
  id: string;
  state: string;
};

export type ReconcileResult =
  | { action: 'repair'; flow_id: string; state: string; clearApplyKey: boolean }
  | { action: 'clear' }
  | { action: 'none'; flow_id: string };

function isActive(state: string): boolean {
  return ACTIVE_STATES.includes(state);
}

/**
 * Reconcile local state with server latest. Server truth wins.
 *
 * Policy:
 * - Server active flow → repair local if mismatched; clear stale apply key if flow changed
 * - Server terminal or null → clear local and keys
 * - Local stale (server null + local active) → clear before new start
 */
export function reconcileResetMapClientState(
  latestFlow: LatestFlow | null,
  localState: ResetMapClientState | null
): ReconcileResult {
  if (latestFlow && isActive(latestFlow.state)) {
    const serverFlowId = latestFlow.id;
    if (!localState || localState.flow_id !== serverFlowId) {
      return {
        action: 'repair',
        flow_id: serverFlowId,
        state: latestFlow.state,
        clearApplyKey: !!localState,
      };
    }
    return { action: 'none', flow_id: serverFlowId };
  }

  return { action: 'clear' };
}
