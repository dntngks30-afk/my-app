/**
 * PR-RESET-01: Reset Map Flow types
 */

export const RESET_MAP_STATES = [
  'started',
  'preview_ready',
  'applied',
  'aborted',
] as const;

export type ResetMapState = (typeof RESET_MAP_STATES)[number];

export const RESET_MAP_RESULTS = ['pending', 'applied', 'aborted'] as const;

export type ResetMapResult = (typeof RESET_MAP_RESULTS)[number];

export interface ResetMapFlowRow {
  id: string;
  user_id: string;
  session_id: string | null;
  state: ResetMapState;
  result: ResetMapResult | null;
  flow_version: string;
  variant_tag: string | null;
  started_at: string;
  applied_at: string | null;
  aborted_at: string | null;
  created_at: string;
  updated_at: string;
}
