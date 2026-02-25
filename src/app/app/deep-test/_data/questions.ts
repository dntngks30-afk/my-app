/**
 * Deep Test v2 - 14문항 (고정 ID)
 * DEEP_V2_QUESTION_IDS와 1:1 매칭
 */

export type DeepQuestionType = 'number' | 'single' | 'multi';

export interface DeepQuestionOption {
  label: string;
  value: string;
}

export interface DeepQuestion {
  id: string;
  title: string;
  type: DeepQuestionType;
  options?: DeepQuestionOption[];
  helperText?: string;
}

export const DEEP_V2_QUESTIONS: DeepQuestion[] = [
  { id: 'deep_basic_age', type: 'number', title: '나이' },
  {
    id: 'deep_basic_gender',
    type: 'single',
    title: '성별',
    options: [{ label: '남', value: '남' }, { label: '여', value: '여' }],
  },
  {
    id: 'deep_basic_experience',
    type: 'single',
    title: '운동경험이 있으신가요?',
    options: [
      { label: '없음', value: '없음' },
      { label: '어렸을 때 조금', value: '어렸을 때 조금' },
      { label: '지금도 자주함', value: '지금도 자주함' },
      { label: '매일함', value: '매일함' },
    ],
  },
  {
    id: 'deep_basic_workstyle',
    type: 'single',
    title: '주로 어떤 자세로 일하시나요?',
    options: [
      { label: '대부분 서서', value: '대부분 서서' },
      { label: '대부분 앉아서', value: '대부분 앉아서' },
      { label: '균형', value: '균형' },
      { label: '대부분 누움', value: '대부분 누움' },
    ],
  },
  {
    id: 'deep_basic_primary_discomfort',
    type: 'single',
    title: '현재 가장 불편한 부위가 있으신가요?',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '손목·팔꿈치', value: '손목·팔꿈치' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '해당 없음', value: '해당 없음' },
    ],
  },
  {
    id: 'deep_squat_pain_intensity',
    type: 'single',
    title: '동작 진행 시 불편함이 있으신가요?',
    helperText: '맨몸 스쿼트 5회(통증 있으면 중단)',
    options: [
      { label: '없음', value: '없음' },
      { label: '약간(0~3)', value: '약간(0~3)' },
      { label: '중간(4~6)', value: '중간(4~6)' },
      { label: '강함(7~10)', value: '강함(7~10)' },
    ],
  },
  {
    id: 'deep_squat_pain_location',
    type: 'multi',
    title: '불편함이 있다면 어떤 부위에 느껴지시나요?',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '손목·팔꿈치', value: '손목·팔꿈치' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '전신(애매)', value: '전신(애매)' },
      { label: '없음', value: '없음' },
    ],
  },
  {
    id: 'deep_squat_knee_alignment',
    type: 'single',
    title: '쪼그려 앉는 자세를 유지하기 어려우신가요?',
    options: [
      { label: '무릎이 발 앞으로 잘 감', value: '무릎이 발 앞으로 잘 감' },
      { label: '가끔 무릎이 안쪽·바깥쪽으로 흔들림', value: '가끔 무릎이 안쪽·바깥쪽으로 흔들림' },
      { label: '자주 크게 흔들림', value: '자주 크게 흔들림' },
    ],
  },
  {
    id: 'deep_wallangel_pain_intensity',
    type: 'single',
    title: '동작 진행 시 불편함이 있으신가요?',
    helperText: "벽에 등을 대고 '벽천사(팔 올리기)' 5회. 허리 꺾임/통증 있으면 중단.",
    options: [
      { label: '없음', value: '없음' },
      { label: '약간(0~3)', value: '약간(0~3)' },
      { label: '중간(4~6)', value: '중간(4~6)' },
      { label: '강함(7~10)', value: '강함(7~10)' },
    ],
  },
  {
    id: 'deep_wallangel_pain_location',
    type: 'multi',
    title: '불편함이 있다면 어떤 부위에 느껴지시나요?',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '손목·팔꿈치', value: '손목·팔꿈치' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '전신(애매)', value: '전신(애매)' },
      { label: '없음', value: '없음' },
    ],
  },
  {
    id: 'deep_wallangel_quality',
    type: 'single',
    title: '팔을 올리는 동작을 유지하기 어려우신가요?',
    options: [
      { label: '팔이 잘 올라가고 목/허리 불편함 없음', value: '문제 없음' },
      { label: '어깨가 위로 들리거나 목이 긴장됨', value: '어깨가 위로 들리거나 목이 긴장됨' },
      { label: '팔꿈치가 굽거나 손목·팔꿈치가 불편해서 팔을 못 올림', value: '팔꿈치가 굽거나 손목·팔꿈치가 불편해서 팔을 못 올림' },
      { label: '허리가 꺾이거나 갈비뼈가 들리며 "허리로" 버티는 느낌', value: '허리가 꺾이거나 갈비뼈가 들리며 "허리로" 버티는 느낌' },
      { label: '전신이 너무 뻣뻣/피곤해서 동작 유지가 어려움', value: '전신이 너무 뻣뻣/피곤해서 동작 유지가 어려움' },
    ],
  },
  {
    id: 'deep_sls_pain_intensity',
    type: 'single',
    title: '동작 진행 시 불편함이 있으신가요?',
    helperText: '한발서기 좌/우 10초(더 어려운 쪽 기준). 통증 있으면 중단.',
    options: [
      { label: '없음', value: '없음' },
      { label: '약간(0~3)', value: '약간(0~3)' },
      { label: '중간(4~6)', value: '중간(4~6)' },
      { label: '강함(7~10)', value: '강함(7~10)' },
    ],
  },
  {
    id: 'deep_sls_pain_location',
    type: 'multi',
    title: '불편함이 있다면 어떤 부위에 느껴지시나요?',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '전신(애매)', value: '전신(애매)' },
      { label: '없음', value: '없음' },
    ],
  },
  {
    id: 'deep_sls_quality',
    type: 'single',
    title: '한발로 버티는 동작을 유지하기 어려우신가요?',
    options: [
      { label: '흔들림 없이 10초 동안 안정적으로 가능', value: '10초 안정적으로 가능' },
      { label: '무릎이 안쪽/바깥쪽으로 흔들리거나 발목이 꺾이며 흔들림', value: '무릎이 안쪽/바깥쪽으로 흔들리거나 발목이 꺾이며 흔들림' },
      { label: '골반이 한쪽으로 꺼지거나 허리가 비틀리며 버팀', value: '골반이 한쪽으로 꺼지거나 허리가 비틀리며 버팀' },
      { label: '상체가 크게 흔들리고 팔을 휘저어야 하며, 10초 유지가 어려움', value: '상체가 크게 흔들리고 팔을 휘저어야 하며, 10초 유지가 어려움' },
      { label: '바닥을 디디거나 지지 없이는 거의 불가능', value: '바닥을 디디거나 지지 없이는 거의 불가능' },
    ],
  },
];

export const DEEP_SECTIONS = [
  { id: 'basic', title: '기본', questionIds: ['deep_basic_age', 'deep_basic_gender', 'deep_basic_experience', 'deep_basic_workstyle', 'deep_basic_primary_discomfort'] },
  { id: 'squat', title: '스쿼트', questionIds: ['deep_squat_pain_intensity', 'deep_squat_pain_location', 'deep_squat_knee_alignment'] },
  { id: 'wallangel', title: '벽천사', questionIds: ['deep_wallangel_pain_intensity', 'deep_wallangel_pain_location', 'deep_wallangel_quality'] },
  { id: 'sls', title: '한발서기', questionIds: ['deep_sls_pain_intensity', 'deep_sls_pain_location', 'deep_sls_quality'] },
] as const;
