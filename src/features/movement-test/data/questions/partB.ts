import type { Question } from '@/types/movement-test';

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