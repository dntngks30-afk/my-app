/**
 * PR-RESET-03: Reset Map flow lifecycle events.
 * service_role only. fire-and-forget.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const ATTRS_MAX_BYTES = 4096;

export type LogResetMapEventParams = {
  flowId: string;
  userId: string;
  name: 'started' | 'applied' | 'invalid_state_attempt' | 'aborted';
  attrs?: Record<string, unknown>;
};

/**
 * reset_map_events에 이벤트 기록. fire-and-forget.
 */
export async function logResetMapEvent(
  admin: SupabaseClient,
  params: LogResetMapEventParams
): Promise<void> {
  try {
    let attrs: Record<string, unknown> = params.attrs ?? {};
    const attrsStr = JSON.stringify(attrs);
    if (attrsStr.length > ATTRS_MAX_BYTES) {
      attrs = { _truncated: true, _size: attrsStr.length };
    }

    await admin.from('reset_map_events').insert({
      flow_id: params.flowId,
      user_id: params.userId,
      name: params.name,
      attrs,
    });
  } catch (err) {
    console.error('[reset-map-events] log failed', params.name, err);
  }
}
