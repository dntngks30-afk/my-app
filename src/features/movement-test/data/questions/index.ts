/**
 * 움직임 타입 테스트 - 질문 데이터
 * 
 * 총 40개 질문:
 * - Part A: 몸의 기본 반응 & 긴장 성향 (1-8)
 * - Part B: 움직임 패턴 & 통증 이동 (9-18)
 * - Part C: 생활 습관 & 무의식 패턴 (19-30)
 * - Part D: 불균형 진단 (31-40) - 예/아니오
 */

import type { Question } from '../../../types/movement-test';

// ============================================
// PART A: 몸의 기본 반응 & 긴장 성향 (1-8)
// ============================================

export const questionsPartA: Question[] = [
  {
    id: 1,
    type: 'multiple',
    category: '자세',
    question: '가만히 서 있을 때 가장 먼저 느껴지는 감각은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q1_a',
        text: '몸이 전체적으로 무겁고 굳어 있음',
        type: '담직',
        score: 3,
      },
      {
        id: 'q1_b',
        text: '자세가 자꾸 바뀌고 불안함',
        type: '날림',
        score: 3,
      },
      {
        id: 'q1_c',
        text: '특정 부위에 힘이 계속 들어감',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q1_d',
        text: '중심이 잘 안 잡히는 느낌',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 2,
    type: 'multiple',
    category: '운동선호',
    question: '스트레칭 후 가장 자주 드는 느낌은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q2_a',
        text: '잠깐 좋아졌다가 금방 돌아옴',
        type: '담직',
        score: 3,
      },
      {
        id: 'q2_b',
        text: '시원하지만 안정감은 없음',
        type: '날림',
        score: 3,
      },
      {
        id: 'q2_c',
        text: '늘린 부위만 더 민감해짐',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q2_d',
        text: '시원한데 힘이 빠지는 느낌',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 3,
    type: 'multiple',
    category: '자세',
    question: '깊게 숨 쉬라는 말을 들으면?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q3_a',
        text: '어디로 숨을 넣어야 할지 모르겠다',
        type: '담직',
        score: 3,
        subTypeModifier: '호흡잠김',
      },
      {
        id: 'q3_b',
        text: '숨은 쉬는데 몸이 같이 안 움직인다',
        type: '흘림',
        score: 3,
      },
      {
        id: 'q3_c',
        text: '어깨나 가슴만 들썩인다',
        type: '버팀',
        score: 3,
        subTypeModifier: '목어깨과로',
      },
      {
        id: 'q3_d',
        text: '숨은 잘 쉬는데 자세가 흐트러진다',
        type: '날림',
        score: 3,
      },
    ],
  },
  {
    id: 4,
    type: 'multiple',
    category: '운동선호',
    question: '운동 전 몸 상태는 보통?',
    subTypeWeight: false,
    options: [
      {
        id: 'q4_a',
        text: '이미 굳어 있음',
        type: '담직',
        score: 3,
      },
      {
        id: 'q4_b',
        text: '가볍지만 불안정',
        type: '날림',
        score: 3,
      },
      {
        id: 'q4_c',
        text: '한 부위가 뻐근함',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q4_d',
        text: '힘은 있는데 정리가 안 됨',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 5,
    type: 'multiple',
    category: '운동선호',
    question: '운동을 시작하면 가장 먼저 나타나는 반응은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q5_a',
        text: '몸이 잘 안 풀린다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q5_b',
        text: '동작이 커지고 빨라진다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q5_c',
        text: '특정 부위에 힘이 몰린다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q5_d',
        text: '동작이 흐트러진다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 6,
    type: 'multiple',
    category: '통증불편',
    question: '운동 후 다음 날 몸 상태는?',
    subTypeWeight: false,
    options: [
      {
        id: 'q6_a',
        text: '전체적으로 묵직함',
        type: '담직',
        score: 3,
      },
      {
        id: 'q6_b',
        text: '여기저기 쑤심',
        type: '날림',
        score: 3,
      },
      {
        id: 'q6_c',
        text: '늘 같은 부위만 아픔',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q6_d',
        text: '힘이 빠진 느낌',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 7,
    type: 'multiple',
    category: '일상동작',
    question: '장시간 앉아 있다 일어나면?',
    subTypeWeight: false,
    options: [
      {
        id: 'q7_a',
        text: '몸이 잘 안 펴진다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q7_b',
        text: '휘청거린다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q7_c',
        text: '허리나 목이 먼저 아프다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q7_d',
        text: '균형이 잘 안 잡힌다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 8,
    type: 'multiple',
    category: '자세',
    question: '본인이 느끼는 \'내 몸 문제\'는?',
    subTypeWeight: false,
    options: [
      {
        id: 'q8_a',
        text: '뻣뻣함',
        type: '담직',
        score: 3,
      },
      {
        id: 'q8_b',
        text: '불안정함',
        type: '날림',
        score: 3,
      },
      {
        id: 'q8_c',
        text: '한 부위 통증',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q8_d',
        text: '효율 없음',
        type: '흘림',
        score: 3,
      },
    ],
  },
];

// ============================================
// PART B: 움직임 패턴 & 통증 이동 (9-18)
// ============================================

export const questionsPartB: Question[] = [
  {
    id: 9,
    type: 'multiple',
    category: '통증불편',
    question: '통증은 보통 어떻게 나타나는가?',
    subTypeWeight: false,
    options: [
      {
        id: 'q9_a',
        text: '전체적으로 뻐근함',
        type: '담직',
        score: 3,
      },
      {
        id: 'q9_b',
        text: '위치가 자주 바뀜',
        type: '날림',
        score: 3,
      },
      {
        id: 'q9_c',
        text: '항상 같은 부위',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q9_d',
        text: '좌우가 다르게 느낌',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 10,
    type: 'multiple',
    category: '일상동작',
    question: '스쿼트 동작에서 가장 힘든 점은?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q10_a',
        text: '내려가기가 뻣뻣함',
        type: '담직',
        score: 3,
        subTypeModifier: '하체고착',
      },
      {
        id: 'q10_b',
        text: '균형이 흔들림',
        type: '날림',
        score: 3,
        subTypeModifier: '중심이탈',
      },
      {
        id: 'q10_c',
        text: '허리나 무릎이 먼저 힘듦',
        type: '버팀',
        score: 3,
        subTypeModifier: '무릎허리',
      },
      {
        id: 'q10_d',
        text: '힘이 바닥으로 안 전달됨',
        type: '흘림',
        score: 3,
        subTypeModifier: '힘누수',
      },
    ],
  },
  {
    id: 11,
    type: 'multiple',
    category: '근력유연성',
    question: '팔을 머리 위로 들 때 느낌은?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q11_a',
        text: '어깨가 잘 안 올라감',
        type: '담직',
        score: 3,
        subTypeModifier: '상체고착',
      },
      {
        id: 'q11_b',
        text: '팔은 올라가는데 몸이 흔들림',
        type: '날림',
        score: 3,
      },
      {
        id: 'q11_c',
        text: '목이나 어깨가 뻐근함',
        type: '버팀',
        score: 3,
        subTypeModifier: '목어깨',
      },
      {
        id: 'q11_d',
        text: '좌우 느낌이 다름',
        type: '흘림',
        score: 3,
        subTypeModifier: '비대칭',
      },
    ],
  },
  {
    id: 12,
    type: 'multiple',
    category: '보행',
    question: '한 발로 서 있으면?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q12_a',
        text: '오래 못 버팀',
        type: '담직',
        score: 3,
      },
      {
        id: 'q12_b',
        text: '흔들림이 심함',
        type: '날림',
        score: 3,
      },
      {
        id: 'q12_c',
        text: '한쪽만 유난히 힘듦',
        type: '버팀',
        score: 3,
        subTypeModifier: '단측',
      },
      {
        id: 'q12_d',
        text: '중심이 흐트러짐',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 13,
    type: 'multiple',
    category: '일상동작',
    question: '동작 속도는 어떤 편인가?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q13_a',
        text: '느리고 조심스러움',
        type: '담직',
        score: 3,
      },
      {
        id: 'q13_b',
        text: '빠르고 즉흥적',
        type: '날림',
        score: 3,
        subTypeModifier: '동작과속',
      },
      {
        id: 'q13_c',
        text: '일정하지만 뻣뻣함',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q13_d',
        text: '속도는 괜찮은데 흐름이 없음',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 14,
    type: 'multiple',
    category: '근력유연성',
    question: '힘을 주라고 하면?',
    subTypeWeight: false,
    options: [
      {
        id: 'q14_a',
        text: '어디에 줘야 할지 모르겠다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q14_b',
        text: '여기저기 힘이 분산된다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q14_c',
        text: '특정 부위만 더 힘준다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q14_d',
        text: '힘을 줘도 전달이 안 된다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 15,
    type: 'multiple',
    category: '운동선호',
    question: '운동 중 가장 자주 듣는 말은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q15_a',
        text: '"좀 더 풀어야 해요"',
        type: '담직',
        score: 3,
      },
      {
        id: 'q15_b',
        text: '"천천히 해요"',
        type: '날림',
        score: 3,
      },
      {
        id: 'q15_c',
        text: '"거기 힘 빼세요"',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q15_d',
        text: '"연결해서 쓰세요"',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 16,
    type: 'multiple',
    category: '자세',
    question: '좌우 차이를 느끼는가?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q16_a',
        text: '크게 못 느낀다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q16_b',
        text: '자주 느낀다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q16_c',
        text: '통증 쪽만 확실히 다르다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q16_d',
        text: '움직임이 다르다',
        type: '흘림',
        score: 3,
        subTypeModifier: '비대칭',
      },
    ],
  },
  {
    id: 17,
    type: 'multiple',
    category: '운동선호',
    question: '운동 효과 체감은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q17_a',
        text: '느리다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q17_b',
        text: '들쭉날쭉',
        type: '날림',
        score: 3,
      },
      {
        id: 'q17_c',
        text: '특정 부위만 발달',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q17_d',
        text: '노력 대비 적다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 18,
    type: 'multiple',
    category: '운동선호',
    question: '반복 동작을 하면?',
    subTypeWeight: false,
    options: [
      {
        id: 'q18_a',
        text: '점점 더 굳는다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q18_b',
        text: '점점 더 흐트러진다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q18_c',
        text: '특정 부위만 피로',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q18_d',
        text: '자세가 무너진다',
        type: '흘림',
        score: 3,
      },
    ],
  },
];

// ============================================
// PART C: 생활 습관 & 무의식 패턴 (19-30)
// 🔥 서브타입 정확도를 끌어올리는 핵심 파트
// ============================================

export const questionsPartC: Question[] = [
  {
    id: 19,
    type: 'multiple',
    category: '자세',
    question: '집중할 때 호흡 패턴은?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q19_a',
        text: '숨을 참는 습관이 있다',
        type: '담직',
        score: 3,
        subTypeModifier: '호흡잠김',
      },
      {
        id: 'q19_b',
        text: '얕고 빠르게 쉰다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q19_c',
        text: '가슴으로만 쉰다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q19_d',
        text: '호흡이 불규칙하다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 20,
    type: 'multiple',
    category: '일상동작',
    question: '관절에서 소리가 나는 빈도는?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q20_a',
        text: '거의 안 난다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q20_b',
        text: '자주 난다',
        type: '날림',
        score: 3,
        subTypeModifier: '관절흐름',
      },
      {
        id: 'q20_c',
        text: '특정 관절만 난다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q20_d',
        text: '가끔 나지만 통증은 없다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 21,
    type: 'multiple',
    category: '자세',
    question: '서 있을 때 손의 위치는?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q21_a',
        text: '주머니에 넣거나 팔짱을 낀다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q21_b',
        text: '자주 바뀐다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q21_c',
        text: '허리에 손을 자주 얹는다',
        type: '버팀',
        score: 3,
        subTypeModifier: '허리의존',
      },
      {
        id: 'q21_d',
        text: '한쪽에만 힘이 실린다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 22,
    type: 'multiple',
    category: '보행',
    question: '신발 밑창 닳는 패턴은?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q22_a',
        text: '전체적으로 고르게 닳는다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q22_b',
        text: '앞쪽이나 뒤쪽만 닳는다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q22_c',
        text: '바깥쪽이나 안쪽만 닳는다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q22_d',
        text: '좌우 닳는 속도가 다르다',
        type: '흘림',
        score: 3,
        subTypeModifier: '비대칭',
      },
    ],
  },
  {
    id: 23,
    type: 'multiple',
    category: '자세',
    question: '스트레스를 받으면 몸은?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q23_a',
        text: '전체적으로 굳는다',
        type: '담직',
        score: 3,
        subTypeModifier: '전신둔화',
      },
      {
        id: 'q23_b',
        text: '안절부절 못한다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q23_c',
        text: '특정 부위가 긴장된다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q23_d',
        text: '힘이 빠진다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 24,
    type: 'multiple',
    category: '일상동작',
    question: '집중력이 필요한 작업을 할 때?',
    subTypeWeight: false,
    options: [
      {
        id: 'q24_a',
        text: '자세가 경직된다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q24_b',
        text: '자세가 무너진다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q24_c',
        text: '한 부위만 피로해진다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q24_d',
        text: '자세를 자주 바꾼다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 25,
    type: 'multiple',
    category: '통증불편',
    question: '오래 서 있으면?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q25_a',
        text: '전체적으로 피곤하다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q25_b',
        text: '자세를 계속 바꾸게 된다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q25_c',
        text: '한쪽이 먼저 아프다',
        type: '버팀',
        score: 3,
        subTypeModifier: '단측',
      },
      {
        id: 'q25_d',
        text: '중심이 한쪽으로 쏠린다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 26,
    type: 'multiple',
    category: '보행',
    question: '걷다 보면?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q26_a',
        text: '몸이 무겁게 느껴진다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q26_b',
        text: '속도가 자주 바뀐다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q26_c',
        text: '한쪽 다리가 더 힘들다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q26_d',
        text: '중심이 흐른다',
        type: '흘림',
        score: 3,
        subTypeModifier: '체인단절',
      },
    ],
  },
  {
    id: 27,
    type: 'multiple',
    category: '자세',
    question: '아침에 일어나면 몸 상태는?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q27_a',
        text: '특히 무겁고 굳어 있다',
        type: '담직',
        score: 3,
        subTypeModifier: '전신둔화',
      },
      {
        id: 'q27_b',
        text: '가볍지만 불안정하다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q27_c',
        text: '특정 부위가 결린다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q27_d',
        text: '몸이 개운하지 않다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 28,
    type: 'multiple',
    category: '통증불편',
    question: '통증의 지속성은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q28_a',
        text: '만성적으로 계속된다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q28_b',
        text: '가벼운 통증이 자주 생겼다 사라진다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q28_c',
        text: '특정 부위에 반복된다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q28_d',
        text: '둔하게 계속된다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 29,
    type: 'multiple',
    category: '운동선호',
    question: '운동 전 준비 루틴은?',
    subTypeWeight: false,
    options: [
      {
        id: 'q29_a',
        text: '충분한 워밍업이 필수다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q29_b',
        text: '바로 시작해도 괜찮다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q29_c',
        text: '특정 부위 마사지 없이는 힘들다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q29_d',
        text: '가볍게 풀고 시작한다',
        type: '흘림',
        score: 3,
      },
    ],
  },
  {
    id: 30,
    type: 'multiple',
    category: '운동선호',
    question: '운동 후 회복 느낌은?',
    subTypeWeight: true, // 서브타입 가중치
    options: [
      {
        id: 'q30_a',
        text: '회복이 느리다',
        type: '담직',
        score: 3,
      },
      {
        id: 'q30_b',
        text: '빨리 회복되지만 컨디션이 들쭉날쭉하다',
        type: '날림',
        score: 3,
      },
      {
        id: 'q30_c',
        text: '특정 부위만 회복이 느리다',
        type: '버팀',
        score: 3,
      },
      {
        id: 'q30_d',
        text: '힘이 빠지는 느낌이 크다',
        type: '흘림',
        score: 3,
        subTypeModifier: '효율저하',
      },
    ],
  },
];

// ============================================
// PART D: 불균형 진단 (31-40) - 예/아니오
// 🔥 5개 이상 YES → 서브타입 확정 가중치
// ============================================

export const questionsPartD: Question[] = [
  {
    id: 31,
    type: 'binary',
    category: '불균형진단',
    question: '한쪽 어깨 높이가 눈에 띄게 다르다',
    imbalanceFlag: 'shoulder_asymmetry',
    helpText: '거울을 보거나 사진을 찍었을 때 한쪽 어깨가 더 높아 보입니다.',
  },
  {
    id: 32,
    type: 'binary',
    category: '불균형진단',
    question: '한쪽 골반이 자주 불편하다',
    imbalanceFlag: 'pelvis_asymmetry',
    helpText: '앉거나 설 때 한쪽 골반 부위가 더 불편하거나 통증이 있습니다.',
  },
  {
    id: 33,
    type: 'binary',
    category: '불균형진단',
    question: '한쪽 다리로 체중을 싣는 습관이 있다',
    imbalanceFlag: 'weight_shift_habit',
    helpText: '서 있을 때 무의식적으로 한쪽 다리에 체중을 더 많이 싣습니다.',
  },
  {
    id: 34,
    type: 'binary',
    category: '불균형진단',
    question: '호흡 시 갈비뼈 움직임이 좌우 다르다',
    imbalanceFlag: 'rib_asymmetry',
    helpText: '깊게 숨을 쉴 때 한쪽 갈비뼈가 덜 움직이거나 답답합니다.',
  },
  {
    id: 35,
    type: 'binary',
    category: '불균형진단',
    question: '한쪽 무릎만 반복적으로 불편하다',
    imbalanceFlag: 'knee_unilateral_pain',
    helpText: '계단 오르내리기나 스쿼트 시 항상 같은 쪽 무릎이 불편합니다.',
  },
  {
    id: 36,
    type: 'binary',
    category: '불균형진단',
    question: '스쿼트 시 무게 중심이 한쪽으로 쏠린다',
    imbalanceFlag: 'squat_weight_shift',
    helpText: '스쿼트를 할 때 몸이 한쪽으로 기울거나 한쪽 다리에 무게가 더 실립니다.',
  },
  {
    id: 37,
    type: 'binary',
    category: '불균형진단',
    question: '팔을 들 때 한쪽만 불편하다',
    imbalanceFlag: 'shoulder_unilateral_restriction',
    helpText: '머리 위로 팔을 들 때 한쪽이 덜 올라가거나 불편합니다.',
  },
  {
    id: 38,
    type: 'binary',
    category: '불균형진단',
    question: '걷다 보면 몸이 한쪽으로 치우친다',
    imbalanceFlag: 'gait_lateral_shift',
    helpText: '걷다 보면 자연스럽게 한쪽 방향으로 치우치는 경향이 있습니다.',
  },
  {
    id: 39,
    type: 'binary',
    category: '불균형진단',
    question: '스트레칭 시 좌우 느낌 차이가 크다',
    imbalanceFlag: 'stretch_asymmetry',
    helpText: '같은 스트레칭을 해도 한쪽이 훨씬 더 뻣뻣하거나 불편합니다.',
  },
  {
    id: 40,
    type: 'binary',
    category: '불균형진단',
    question: '신발 바깥쪽/안쪽 닳음이 좌우 다르다',
    imbalanceFlag: 'shoe_wear_asymmetry',
    helpText: '신발 밑창이 좌우 다르게 닳거나, 한쪽만 바깥/안쪽이 심하게 닳습니다.',
  },
];

// ============================================
// 전체 질문 통합 (40개)
// ============================================

export const allQuestions: Question[] = [
  ...questionsPartA,  // 1-8
  ...questionsPartB,  // 9-18
  ...questionsPartC,  // 19-30
  ...questionsPartD,  // 31-40
];

// ============================================
// 유틸리티 함수
// ============================================

/**
 * ID로 질문 찾기
 */
export function getQuestionById(id: number): Question | undefined {
  return allQuestions.find(q => q.id === id);
}

/**
 * 카테고리별 질문 필터링
 */
export function getQuestionsByCategory(category: string): Question[] {
  return allQuestions.filter(q => q.category === category);
}

/**
 * 타입별 질문 필터링 (multiple만)
 */
export function getQuestionsByType(type: 'multiple' | 'binary'): Question[] {
  return allQuestions.filter(q => q.type === type);
}

/**
 * 서브타입 가중치 질문만 필터링
 */
export function getSubTypeWeightQuestions(): Question[] {
  return allQuestions.filter(q => q.subTypeWeight === true);
}

/**
 * 불균형 진단 질문만 필터링
 */
export function getImbalanceQuestions(): Question[] {
  return questionsPartD;
}

/**
 * 페이지별 질문 그룹화
 */
export function getQuestionsByPage(questionsPerPage: number = 5): Question[][] {
  const pages: Question[][] = [];
  for (let i = 0; i < allQuestions.length; i += questionsPerPage) {
    pages.push(allQuestions.slice(i, i + questionsPerPage));
  }
  return pages;
}

/**
 * 질문 총 개수
 */
export const TOTAL_QUESTIONS = allQuestions.length;
export const MULTIPLE_QUESTIONS_COUNT = questionsPartA.length + questionsPartB.length + questionsPartC.length;
export const BINARY_QUESTIONS_COUNT = questionsPartD.length;
