/**
 * Deep Test v2 - Question registry (UI/copy)
 * IDs must match lib/deep-test/question-ids.ts (SSOT).
 * Drift guard: npm run test:deep-id-check
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
    title: '최근 운동 빈도는 어느 정도인가요?',
    helperText: '최근 3개월 기준, 가장 가까운 항목을 골라주세요.',
    options: [
      { label: '거의 하지 않음', value: '없음' },
      { label: '가끔 함 (예전엔 했지만 최근엔 거의 안 함)', value: '어렸을 때 조금' },
      { label: '주 1~3회', value: '지금도 자주함' },
      { label: '주 4회 이상', value: '매일함' },
    ],
  },
  {
    id: 'deep_basic_workstyle',
    type: 'single',
    title: '하루 대부분 어떤 자세로 보내시나요?',
    helperText: '일·생활에서 가장 오래 있는 자세를 골라주세요.',
    options: [
      { label: '대부분 서서/이동하며', value: '대부분 서서' },
      { label: '대부분 앉아서', value: '대부분 앉아서' },
      { label: '앉기와 서기가 비슷함', value: '균형' },
      { label: '대부분 누워서/기대서', value: '대부분 누움' },
    ],
  },
  {
    id: 'deep_basic_primary_discomfort',
    type: 'single',
    title: '최근 가장 신경 쓰이는 부위는 어디인가요?',
    helperText: '하나만 고른다면, 요즘 가장 자주 느끼는 부위를 골라주세요.',
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
    title: '스쿼트 중 통증이나 뻣뻣함이 얼마나 있었나요?',
    helperText: '아픔·불편·뻣뻣함이 전혀 없는지, 약간인지, 확실한지 기준으로 답해주세요.',
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
    title: '불편감이 느껴졌다면 어디였나요?',
    helperText: '가장 먼저 느껴진 부위 1~2개만 골라주세요.',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '손목·팔꿈치', value: '손목·팔꿈치' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '여러 부위가 골고루 불편함', value: '전신(애매)' },
      { label: '특별히 없음', value: '없음' },
    ],
  },
  {
    id: 'deep_squat_knee_alignment',
    type: 'single',
    title: '스쿼트할 때 무릎이 안쪽으로 몰리거나 흔들렸나요?',
    helperText: '발 방향과 비슷하게 무릎이 움직였는지, 안쪽으로 꺾이거나 흔들렸는지 기준으로 답해주세요.',
    options: [
      { label: '발바닥이 바닥에 잘 붙은 채로 편하게 내려가서 2–3초 유지 가능', value: '발바닥이 바닥에 잘 붙은 채로 편하게 내려가서 2–3초 유지 가능' },
      { label: '내려갈 때 무릎이 가끔 안쪽·바깥쪽으로 흔들림', value: '가끔 무릎이 안쪽·바깥쪽으로 흔들림' },
      { label: '내려가거나 버틸 때 무릎이 자주 크게 흔들림', value: '자주 크게 흔들림' },
    ],
  },
  {
    id: 'deep_wallangel_pain_intensity',
    type: 'single',
    title: '벽천사 중 통증이나 뻣뻣함이 얼마나 있었나요?',
    helperText: '아픔·뻣뻣함·움직이기 어려움 중 무엇에 가깝게 느꼈는지 기준으로 답해주세요.',
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
    title: '불편감이 느껴졌다면 어디였나요?',
    helperText: '가장 뚜렷했던 부위 1~2개만 골라주세요.',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '손목·팔꿈치', value: '손목·팔꿈치' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '여러 부위가 골고루 불편함', value: '전신(애매)' },
      { label: '특별히 없음', value: '없음' },
    ],
  },
  {
    id: 'deep_wallangel_quality',
    type: 'single',
    title: '벽천사에서 팔 올리기·몸통 움직임이 어땠나요?',
    helperText: '막힘·뻣뻣함·올리기 어려움 등 관찰 가능한 느낌을 기준으로 답해주세요.',
    options: [
      { label: '팔이 잘 올라가고 목/허리 불편함이 거의 없음', value: '문제 없음' },
      { label: '어깨가 위로 들리거나 목이 긴장됨', value: '어깨가 위로 들리거나 목이 긴장됨' },
      { label: '팔꿈치가 굽거나 손목·팔꿈치가 불편해서 팔을 못 올림', value: '팔꿈치가 굽거나 손목·팔꿈치가 불편해서 팔을 못 올림' },
      { label: '허리가 꺾이거나 갈비뼈가 들리며 "허리로" 버티는 느낌', value: '허리가 꺾이거나 갈비뼈가 들리며 "허리로" 버티는 느낌' },
      { label: '전신이 너무 뻣뻣/피곤해서 동작 유지가 어려움', value: '전신이 너무 뻣뻣/피곤해서 동작 유지가 어려움' },
    ],
  },
  {
    id: 'deep_sls_pain_intensity',
    type: 'single',
    title: '한발서기 중 통증이나 뻣뻣함이 얼마나 있었나요?',
    helperText: '힘든 느낌과 별도로, 아픔·불편이 전혀 없는지·있는지 기준으로 답해주세요.',
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
    title: '불편감이 느껴졌다면 어디였나요?',
    helperText: '가장 뚜렷했던 부위 1~2개만 골라주세요.',
    options: [
      { label: '목·어깨', value: '목·어깨' },
      { label: '허리·골반', value: '허리·골반' },
      { label: '무릎·발목', value: '무릎·발목' },
      { label: '여러 부위가 골고루 불편함', value: '전신(애매)' },
      { label: '특별히 없음', value: '없음' },
    ],
  },
  {
    id: 'deep_sls_quality',
    type: 'single',
    title: '한발서기에서 균형이 어땠나요?',
    helperText: '흔들림이 컸는지, 중심 잡기가 어려웠는지, 좌우 차이가 있었는지 기준으로 답해주세요.',
    options: [
      { label: '10초 동안 비교적 안정적으로 버틸 수 있었음', value: '10초 안정적으로 가능' },
      { label: '무릎이 안쪽/바깥쪽으로 흔들리거나 발목이 꺾이며 흔들림', value: '무릎이 안쪽/바깥쪽으로 흔들리거나 발목이 꺾이며 흔들림' },
      { label: '골반이 한쪽으로 꺼지거나 허리가 비틀리며 버팀', value: '골반이 한쪽으로 꺼지거나 허리가 비틀리며 버팀' },
      { label: '상체가 크게 흔들리고 팔을 써야 해서 10초 유지가 어려움', value: '상체가 크게 흔들리고 팔을 휘저어야 하며, 10초 유지가 어려움' },
      { label: '발을 디디거나 지지 없이는 거의 유지가 어려움', value: '바닥을 디디거나 지지 없이는 거의 불가능' },
    ],
  },
];

export const DEEP_SECTIONS = [
  { id: 'basic', title: '기본', questionIds: ['deep_basic_experience', 'deep_basic_workstyle', 'deep_basic_primary_discomfort'] },
  { id: 'squat', title: '스쿼트', questionIds: ['deep_squat_pain_intensity', 'deep_squat_pain_location', 'deep_squat_knee_alignment'] },
  { id: 'wallangel', title: '벽천사', questionIds: ['deep_wallangel_pain_intensity', 'deep_wallangel_pain_location', 'deep_wallangel_quality'] },
  { id: 'sls', title: '한발서기', questionIds: ['deep_sls_pain_intensity', 'deep_sls_pain_location', 'deep_sls_quality'] },
  { id: 'final', title: '마지막 단계', questionIds: ['deep_basic_age', 'deep_basic_gender'] },
] as const;
