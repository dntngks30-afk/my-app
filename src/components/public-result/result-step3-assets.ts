/**
 * PR-RESULT-STEP3-ACTION-IMAGE-ASSETS-01 — Step3 시작 순서 카드용 정적 이미지 경로.
 * 파일명은 public/images/result-step3 와 1:1 (변경 금지).
 * Copy alignment: CORE ① iliopsoas; DECONDITIONED/STABLE slot ③ examples match box-squat asset; others partial; UNKNOWN uses STABLE assets.
 */

import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';

/** [먼저 풀기, 그다음 깨우기, 움직임 연결하기] */
export type ResultStep3Assets = readonly [string, string, string];

function assetPath(filename: string): string {
  return `/images/result-step3/${filename}`;
}

const STABLE_ASSETS: ResultStep3Assets = [
  assetPath('stable-release-pec-stretch.png'),
  assetPath('stable-activate-band-pull-apart.png'),
  assetPath('stable-integrate-box-squat.png'),
];

export const RESULT_STEP3_ASSETS_BY_PRIMARY: Record<UnifiedPrimaryType, ResultStep3Assets> = {
  LOWER_INSTABILITY: [
    assetPath('lower_instability_release_calf_foam_rolling.png'),
    assetPath('lower_instability_activate_glute_bridge.png'),
    assetPath('lower_instability_integrate_box_squat.png'),
  ],
  LOWER_MOBILITY_RESTRICTION: [
    assetPath('lower_mobility_release_iliopsoas_stretch.png'),
    assetPath('lower-mobility-activate-glute-bridge.png'),
    assetPath('lower_mobility_integrate_hip_hinge.png'),
  ],
  UPPER_IMMOBILITY: [
    assetPath('upper_immobility_release_pec_stretch.png'),
    assetPath('upper_immobility_activate_band_pull_apart.png'),
    assetPath('upper_immobility_integrate_wall_overhead_reach.png'),
  ],
  CORE_CONTROL_DEFICIT: [
    assetPath('core_control_release_iliopsoas_stretch.png'),
    assetPath('core_control_activate_dead_bug.png'),
    assetPath('core-control-integrate-hip-hinge.png'),
  ],
  DECONDITIONED: [
    assetPath('deconditioned-release-calf-foam.png'),
    assetPath('deconditioned_activate_wall_push.png'),
    assetPath('deconditioned-integrate-box-squat.png'),
  ],
  STABLE: STABLE_ASSETS,
  UNKNOWN: STABLE_ASSETS,
};

export function getResultStep3Assets(pt: UnifiedPrimaryType): ResultStep3Assets {
  return RESULT_STEP3_ASSETS_BY_PRIMARY[pt] ?? STABLE_ASSETS;
}
