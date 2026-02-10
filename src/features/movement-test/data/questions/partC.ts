import type { Question } from '@/types/movement-test'; 

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