/**
 * PR-RESET-04: Preview gate evaluation.
 * Simple explicit thresholds. No ML, no device intelligence.
 */

export const BLOCK_REASONS = {
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  LOW_TRACKING_CONF: 'LOW_TRACKING_CONF',
  LOW_LANDMARK_COVERAGE: 'LOW_LANDMARK_COVERAGE',
} as const;

export type BlockReason = (typeof BLOCK_REASONS)[keyof typeof BLOCK_REASONS];

const TRACKING_CONF_MIN = 0.35;
const LANDMARK_COVERAGE_MIN = 0.5;

export type PreviewPayload = {
  tracking_conf?: number;
  landmark_coverage?: number;
  permission_state?: 'granted' | 'denied' | 'limited' | 'unknown';
};

export type PreviewResult = {
  proceed: boolean;
  reasons: BlockReason[];
};

/**
 * Evaluate preview quality. Returns proceed and block reasons.
 */
export function evaluatePreview(payload: PreviewPayload): PreviewResult {
  const reasons: BlockReason[] = [];

  if (payload.permission_state !== 'granted') {
    reasons.push(BLOCK_REASONS.PERMISSION_REQUIRED);
  }

  if (
    typeof payload.tracking_conf === 'number' &&
    payload.tracking_conf < TRACKING_CONF_MIN
  ) {
    reasons.push(BLOCK_REASONS.LOW_TRACKING_CONF);
  }

  if (
    typeof payload.landmark_coverage === 'number' &&
    payload.landmark_coverage < LANDMARK_COVERAGE_MIN
  ) {
    reasons.push(BLOCK_REASONS.LOW_LANDMARK_COVERAGE);
  }

  return {
    proceed: reasons.length === 0,
    reasons,
  };
}
