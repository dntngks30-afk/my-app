/**
 * PR-RESET-BE-03 — 리셋 모달 표시용 텍스트 가이드(스코어링·세션 truth와 무관).
 * 의료 진단·치료·효과 보장 표현 없이, 가벼운 리셋 안내만 담는다.
 */
import type { ResetStretchGuide } from '@/lib/reset/types';

export const RESET_STRETCH_GUIDE_BY_KEY: Readonly<
  Record<string, ResetStretchGuide>
> = {
  sternocleidomastoid_stretch: {
    stretch_key: 'sternocleidomastoid_stretch',
    title: '흉쇄유돌근 스트레칭',
    description:
      '고개가 앞으로 많이 나온 듯할 때 목 앞쪽의 당김을 조금 줄여 줄 수 있는 편안한 리셋 동작입니다.',
    how_to: [
      '편하게 앉거나 선 상태에서 등을 세우고 어깨는 가볍게 내립니다.',
      '한 손으로 반대쪽 쇄골 근처를 살짝 고정한 뒤, 턱을 당기고 고개를 부드럽게 옆으로 기울입니다.',
      '목 앞쪽이 당기는 범위에서 천천히 호흡합니다.',
    ],
    safety_note:
      '숨 막히거나 어지럽거나 손목이 저리면 즉시 중단합니다. 무리하게 꺾지 마세요.',
  },
  quadriceps_stretch: {
    stretch_key: 'quadriceps_stretch',
    title: '대퇴 사두근 스트레칭',
    description:
      '앞쪽 허벅지 장력을 가볍게 풀어 주는 동작입니다. 허벅지 앞쪽이 당길 만큼만 천천히 진행하세요.',
    how_to: [
      '양손으로 발목을 살짝 잡거나 벽에 손으로 지지합니다.',
      '무릎이 정면을 향하도록 유지하면서 허벅지 앞쪽이 당김을 느낍니다.',
      '통증 없는 범위에서 30초 정도 호흡을 이어 가며 반대쪽도 같은 방식으로 진행합니다.',
    ],
    safety_note: '무릎에 통증이 있으면 깊게 굽히지 마세요.',
  },
  hamstring_stretch: {
    stretch_key: 'hamstring_stretch',
    title: '햄스트링 스트레칭',
    description:
      '뒤쪽 허벅지 라인을 천천히 늘려 주어 앉거나 걸을 때의 뻐근함 완화에 도움을 줄 수 있습니다.',
    how_to: [
      '한쪽 다리를 앞으로 곧게 내딛고 무릎을 살짝 구부립니다.',
      '가슴을 세운 채 무릎을 넘어 길게 뻗으며 뒷허벅지 긴장을 느낍니다.',
      '등이 둥글어지면 동작 깊이를 줄입니다.',
    ],
    safety_note: '허리가 과하게 접히면 중단합니다.',
  },
  seated_piriformis_stretch: {
    stretch_key: 'seated_piriformis_stretch',
    title: '이상근 스트레칭(앉아서)',
    description:
      '엉덩이 깊은 쪽 장력을 완만하게 줄여 줄 수 있는 바른 앉아서 동작입니다.',
    how_to: [
      '양반다리처럼 한쪽 종아리를 반대쪽 넓적다리 위에 올려 얹습니다.',
      '척추가 세워지도록 가볍게 앞팔을 내려 허벅지에 올립니다.',
      '엉덩이 바깥이 당김으로 느껴질 때까지 천천히 유지 후 반대로 바꿉니다.',
    ],
    safety_note: '무릎 불편이 있으면 각도나 높이를 조절하세요.',
  },
  gluteus_maximus_stretch: {
    stretch_key: 'gluteus_maximus_stretch',
    title: '대둔근 스트레칭',
    description:
      '엉덩이 후면 라인을 가볍게 늘리는 편안한 리셋으로, 무리 없는 범위에서 진행합니다.',
    how_to: [
      '눕거나 매트에 엎드린 뒤 한쪽 무릎을 접어 가슴 쪽으로 당겨 옵니다.',
      '반대 다리는 곧게 유지하여 골반에 무리 없는지 확인합니다.',
      '호흡을 따라 천천히 긴장만 풉니다.',
    ],
    safety_note: '허리에 부담이 가면 깊이를 줄입니다.',
  },
  supine_piriformis_stretch: {
    stretch_key: 'supine_piriformis_stretch',
    title: '이상근 스트레칭(누워서)',
    description:
      '누운 자세에서 엉덩이 후외측 라인의 긴장을 완만하게 풀어 줄 수 있는 동작입니다.',
    how_to: [
      '등을 바닥에 대고 무릎을 세운 뒤 한쪽 종아리를 반대쪽 넓적다리 앞쪽에 깃대기처럼 놓습니다.',
      '양손으로 무릎 뒤쪽을 가볍게 당겨 엉덩이 외쪽이 편하게 늘어납니다.',
      '등이 바짝 뜨면 바닥에 붙도록 조절합니다.',
    ],
    safety_note: '목이 당길 때는 깃털처럼 머리 아래 패드를 댑니다.',
  },
  cat_cow_spine_stretch: {
    stretch_key: 'cat_cow_spine_stretch',
    title: '캣카우(허리) 스트레칭',
    description:
      '척추를 부드럽게 굽히고 펴면서 허리·등 전체 긴장을 천천히 풀어 주는 움직임입니다.',
    how_to: [
      '네 발로 선 자세 또는 무릎 꿇음에서 허벅지가 골반보다 크게 놓이도록 합니다.',
      '머리 끝에서 꼬리까지 둥근 등(캣) 후에 천천히 허리를 중립으로 만들며 가슴 전진(카우).',
      '호흡에 맞춰 속도가 일정하게 흘러가게 합니다.',
    ],
    safety_note: '손목 무릎이 아프면 쿠션이나 담요를 받칩니다.',
  },
  foam_roller_lat_stretch: {
    stretch_key: 'foam_roller_lat_stretch',
    title: '폼롤러 광배근 스트레칭',
    description:
      '옆 허리·몸통 라인 당김을 완충되는 느낌으로 풀어 줄 수 있습니다. 과한 압은 피합니다.',
    how_to: [
      '옆으로 폼롤러 위에 무릎·팔 짚고 몸통 측선이 롤 위에 놓입니다.',
      '호흡을 내쉴 때부터 천천히 무게를 놓으며 짧게 오르내림 없이 속도 줄입니다.',
      '반대 옆 선으로도 같은 방식으로 진행합니다.',
    ],
    safety_note:
      '어지러움이 있거나 통증 신호가 있으면 멈추고, 롤 높낮이 또는 체중을 줄입니다.',
  },
  longitudinal_foam_roller_chest_opener: {
    stretch_key: 'longitudinal_foam_roller_chest_opener',
    title: '폼롤러 세로로 두고 위에 눕기',
    description:
      '등과 가슴을 동시에 열어 줄 수 있는 느낌으로 상체 라인 긴장을 완하게 합니다.',
    how_to: [
      '폼롤러를 세로로 두고 허리·목이 중앙축선에 놓도록 눕습니다.',
      '무릎을 세우거나 발바닥에 체중 균등히 펼칩니다.',
      '양팔을 비스듬하게 열거나 짧게 깍지 껴 무게를 천천히 내려놓으며 호흡합니다.',
    ],
    safety_note: '어지럼증이 나면 속도 줄이거나 한쪽 무릎을 세워 안정 후 재시작.',
  },
  levator_scapulae_upper_trap_stretch: {
    stretch_key: 'levator_scapulae_upper_trap_stretch',
    title: '견갑거근·상부 승모근 스트레칭',
    description:
      '목 옆과 어깨 윗쪽이 뻐근할 때 당김을 완하게 조절해 줄 수 있는 동작입니다.',
    how_to: [
      '앉거나 선 자세에서 팔 등 뒤로 살짝 내리거나 옆 허벅지에 놓습니다.',
      '머리를 대각선 앞쪽으로 숙였다가 같은 쪽 무릎 쪽까지 부드럽게 기울입니다.',
      '반대쪽 팔살 미세 당김으로 천천히 스트레칭 깊이를 조절합니다.',
    ],
    safety_note: '손끝 감각 이상 또는 큰 불편이면 즉시 멈춤.',
  },
};

export function getResetStretchGuide(stretch_key: string): ResetStretchGuide | undefined {
  return RESET_STRETCH_GUIDE_BY_KEY[stretch_key];
}

export function getAllStretchGuideKeys(): string[] {
  return Object.keys(RESET_STRETCH_GUIDE_BY_KEY);
}
