/**
 * v2 Movement Test - 질문 데이터 (PR2-2)
 * 6영역 × 3문항 = 18문항
 * id 규칙: v2_{영역}{번호} (1=q1핵심체감, 2=q2불편피로, 3=q3습관관찰)
 */
import type { AnimalAxis, QuestionV2 } from '../scoring/types';

const DOMAIN_AXIS: Record<string, AnimalAxis> = {
  A: 'turtle',
  B: 'hedgehog',
  C: 'kangaroo',
  D: 'penguin',
  F: 'crab',
  G: 'meerkat',
};

function q(domain: string, slot: 1 | 2 | 3, text: string): QuestionV2 {
  const axis = DOMAIN_AXIS[domain];
  if (!axis) throw new Error(`Unknown domain: ${domain}`);
  return {
    id: `v2_${domain}${slot}`,
    text,
    weights: { [axis]: 1 },
  };
}

export const QUESTIONS_V2: QuestionV2[] = [
  // A. 상부 전방화 (거북이) / turtle
  q('A', 1, '스마트폰/노트북을\n오래 보면 목이 앞으로\n빠지는 느낌이 든다.'),
  q('A', 2, '하루가 끝나면 뒷목이 뻐근하거나 당기는 편이다.'),
  q('A', 3, '거울/사진에서\n고개가 어깨보다\n앞으로 나와 보인 적이 있다.'),

  // B. 가슴 닫힘·등 굽음 (고슴도치) / hedgehog
  q('B', 1, '가만히 서 있어도 어깨가 안쪽으로 말린 느낌이 든다.'),
  q('B', 2, '팔을 위로 올릴 때\n가슴 앞/겨드랑이 쪽이\n뻐근하거나 걸린다.'),
  q('B', 3, '상체를 펴려고 하면\n등보다 허리만\n꺾이는 느낌이 든다.'),

  // C. 허리 과부하 (캥거루) / kangaroo
  q('C', 1, '서 있을 때,\n허리가 과하게 꺾이고\n아랫배가 앞으로 나온다.'),
  q('C', 2, '오래 서 있거나 걷고 나면 허리 아래가 먼저 피로해진다.'),
  q('C', 3, '스쿼트/런지에서 엉덩이보다 허리·앞허벅지에 힘이 몰리는 편이다.'),

  // D. 무릎·발목 불안정 (펭귄) / penguin
  q('D', 1, '스쿼트/계단에서\n무릎이 안쪽으로\n모이는 느낌이 든다.'),
  q('D', 2, '신발 밑 창의\n안쪽이 더 빨리 닳는 편이다.'),
  q('D', 3, '계단/스쿼트에서\n무릎 또는 발목이\n불안정하게 느껴진다.'),

  // F. 편측 의존·비대칭 (게) / crab
  q('F', 1, '서 있을 때 한쪽 다리에 체중을 더 싣는 편이다.'),
  q('F', 2, '통증/뻐근함이\n늘 한 쪽(좌/우)으로\n더 자주 온다.'),
  q('F', 3, '생활 습관이 한 쪽 사용\n(가방/휴대폰/다리 꼬기 등)에\n치우쳐 있다.'),

  // G. 전신 긴장 (미어캣) / meerkat
  q('G', 1, '쉬고 있는데도\n몸이 잘 안풀리고\n긴장감이 남아있다.'),
  q('G', 2, '스트레스 받으면\n턱·목·어깨에 힘이 들어간다.'),
  q('G', 3, '잠들기 전에도\n턱·목·어깨가 긴장되어 있다.'),
];

export const ANSWER_CHOICES_V2 = [
  { value: 0 as const, label: '전혀 아니다' },
  { value: 1 as const, label: '거의 아니다' },
  { value: 2 as const, label: '보통' },
  { value: 3 as const, label: '자주' },
  { value: 4 as const, label: '거의 항상' },
] as const;
