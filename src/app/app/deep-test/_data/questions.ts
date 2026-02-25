/**
 * Deep Test v1 문항 (d1~d5)
 * 2~3 섹션으로 분할
 */

export interface DeepQuestion {
  id: string;
  text: string;
  options?: { value: number; label: string }[];
}

export const DEEP_SECTIONS = [
  {
    id: 'section1',
    title: '움직임 패턴',
    questions: [
      { id: 'd1', text: '일상에서 상체(목·어깨)가 먼저 쓰이는 편인가요?', options: [
        { value: 0, label: '전혀 아니다' },
        { value: 1, label: '아니다' },
        { value: 2, label: '보통' },
        { value: 3, label: '그렇다' },
        { value: 4, label: '매우 그렇다' },
      ]},
      { id: 'd2', text: '가슴·등이 닫히거나 말리는 느낌이 자주 있나요?', options: [
        { value: 0, label: '전혀 아니다' },
        { value: 1, label: '아니다' },
        { value: 2, label: '보통' },
        { value: 3, label: '그렇다' },
        { value: 4, label: '매우 그렇다' },
      ]},
    ],
  },
  {
    id: 'section2',
    title: '힘의 흐름',
    questions: [
      { id: 'd3', text: '허리가 먼저 동작에 개입하는 느낌이 있나요?', options: [
        { value: 0, label: '전혀 아니다' },
        { value: 1, label: '아니다' },
        { value: 2, label: '보통' },
        { value: 3, label: '그렇다' },
        { value: 4, label: '매우 그렇다' },
      ]},
      { id: 'd4', text: '한쪽(좌/우)에 더 의존하는 느낌이 있나요?', options: [
        { value: 0, label: '전혀 아니다' },
        { value: 1, label: '아니다' },
        { value: 2, label: '보통' },
        { value: 3, label: '그렇다' },
        { value: 4, label: '매우 그렇다' },
      ]},
    ],
  },
  {
    id: 'section3',
    title: '마무리',
    questions: [
      { id: 'd5', text: '몸을 똑바로 세우려는 의식이 강한 편인가요?', options: [
        { value: 0, label: '전혀 아니다' },
        { value: 1, label: '아니다' },
        { value: 2, label: '보통' },
        { value: 3, label: '그렇다' },
        { value: 4, label: '매우 그렇다' },
      ]},
    ],
  },
] as const;

export const ALL_QUESTION_IDS = ['d1', 'd2', 'd3', 'd4', 'd5'] as const;
