import { SurveyQuestion } from '@/types/survey';

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  // ========== A. 자세 경향 체크 (5문항) ==========
  {
    id: 'q1',
    category: 'posture',
    type: 'single',
    question: '거울을 볼 때, 본인의 고개 위치는 어디에 가까운가요?',
    description: '정면에서 봤을 때의 느낌',
    options: [
      { id: 'straight', label: '귀와 어깨가 일직선인 것 같다', value: 0 },
      { id: 'slight', label: '고개가 약간 앞에 있는 것 같다', value: 1 },
      { id: 'moderate', label: '고개가 눈에 띄게 앞에 있는 것 같다', value: 2 },
      { id: 'severe', label: '고개가 많이 앞에 나와 있는 것 같다', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 1.0,
      mapping: {
        'straight': 0,
        'slight': 33,
        'moderate': 66,
        'severe': 100
      }
    }
  },
  
  {
    id: 'q2',
    category: 'posture',
    type: 'single',
    question: '옆에서 봤을 때, 본인의 어깨는 어디에 가까운가요?',
    description: '측면 사진을 찍거나 가족에게 물어보세요',
    options: [
      { id: 'aligned', label: '귀와 어깨가 수직선상에 있는 것 같다', value: 0 },
      { id: 'slight', label: '어깨가 약간 앞에 있는 것 같다', value: 1 },
      { id: 'moderate', label: '어깨가 귀보다 확실히 앞에 있는 것 같다', value: 2 },
      { id: 'severe', label: '가슴이 많이 움츠러든 느낌이다', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'rounded_shoulder',
      weight: 1.0,
      mapping: {
        'aligned': 0,
        'slight': 33,
        'moderate': 66,
        'severe': 100
      }
    }
  },
  
  {
    id: 'q3',
    category: 'posture',
    type: 'single',
    question: '서 있을 때, 본인의 허리 곡선은 어떤가요?',
    description: '측면에서 관찰 - 가족이나 친구에게 물어보세요',
    options: [
      { id: 'neutral', label: '자연스러운 곡선인 것 같다', value: 0 },
      { id: 'forward', label: '허리가 많이 휘어서 배가 나와 보이는 것 같다', value: 1 },
      { id: 'backward', label: '허리가 일자에 가까운 것 같다', value: 2 }
    ],
    required: true,
    scoring: {
      dimension: 'anterior_pelvic_tilt',
      weight: 0.7,
      mapping: {
        'neutral': 0,
        'forward': 80,
        'backward': 0
      }
    }
  },
  
  {
    id: 'q4',
    category: 'posture',
    type: 'multiple',
    question: '다음 중 본인에게 해당하는 것을 모두 선택하세요',
    description: '일상에서 자주 느끼는 경향',
    options: [
      { id: 'head_forward', label: '모니터를 볼 때 고개를 내미는 경향이 있다', value: 'head_forward' },
      { id: 'shoulder_hunch', label: '어깨가 귀보다 앞에 있다는 말을 들은 적 있다', value: 'shoulder_hunch' },
      { id: 'chest_tight', label: '가슴을 펴는 게 불편하게 느껴진다', value: 'chest_tight' },
      { id: 'back_round', label: '등이 둥글다는 말을 들은 적 있다', value: 'back_round' },
      { id: 'hip_forward', label: '골반이 앞으로 기운 느낌이 든다', value: 'hip_forward' },
      { id: 'none', label: '해당 없음', value: 'none' }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.5,
      mapping: {
        'head_forward': 20,
        'shoulder_hunch': 20,
        'chest_tight': 15,
        'back_round': 15,
        'hip_forward': 10,
        'none': 0
      }
    }
  },
  
  {
    id: 'q5',
    category: 'posture',
    type: 'scale',
    question: '앉아있을 때, 처음 자세를 유지하기가 어떤가요?',
    description: '1시간 기준으로 생각해보세요',
    options: [
      { id: '1', label: '1시간 내내 편안하게 유지할 수 있다', value: 1 },
      { id: '2', label: '30분 정도 지나면 자세가 흐트러지는 것 같다', value: 2 },
      { id: '3', label: '15분 정도면 자세가 흐트러지는 것 같다', value: 3 },
      { id: '4', label: '처음부터 편한 자세를 찾기 어렵다', value: 4 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.6,
      mapping: {
        '1': 0,
        '2': 30,
        '3': 60,
        '4': 90
      }
    }
  },
  
  // ========== B. 불편함 경험 (5문항) ==========
  {
    id: 'q6',
    category: 'pain',
    type: 'multiple',
    question: '평소 뻐근함이나 불편함을 느끼는 부위가 있나요?',
    description: '⚠️ 통증이 아니어도 피로감, 뻣뻣함 포함 (통증이 있다면 의료기관을 방문하세요)',
    options: [
      { id: 'neck', label: '목 부위', value: 'neck' },
      { id: 'shoulder', label: '어깨 부위', value: 'shoulder' },
      { id: 'upper_back', label: '등 위쪽', value: 'upper_back' },
      { id: 'lower_back', label: '허리', value: 'lower_back' },
      { id: 'hip', label: '골반/엉덩이', value: 'hip' },
      { id: 'none', label: '없음', value: 'none' }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.8,
      mapping: {
        'neck': 25,
        'shoulder': 20,
        'upper_back': 15,
        'lower_back': 10,
        'hip': 10,
        'none': 0
      }
    }
  },
  
  {
    id: 'q7',
    category: 'pain',
    type: 'scale',
    question: '목이나 어깨 부위의 불편함을 얼마나 자주 느끼나요?',
    description: '지난 한 달 기준 (⚠️ 통증이 심하다면 의료기관을 방문하세요)',
    options: [
      { id: '0-2', label: '거의 느끼지 않는다', value: 1 },
      { id: '3-5', label: '가끔 느낀다 (주 1-2회)', value: 5 },
      { id: '6-8', label: '자주 느낀다 (주 3-5회)', value: 7 },
      { id: '9-10', label: '거의 매일 느낀다', value: 10 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.9,
      mapping: {
        '0-2': 0,
        '3-5': 40,
        '6-8': 70,
        '9-10': 100
      }
    }
  },
  
  {
    id: 'q8',
    category: 'pain',
    type: 'single',
    question: '아침에 일어났을 때 목이나 어깨는 어떤가요?',
    description: '⚠️ 지속적인 불편함이 있다면 전문가 상담을 권장합니다',
    options: [
      { id: 'fresh', label: '개운하고 편안하다', value: 0 },
      { id: 'stiff', label: '약간 뻣뻣한 느낌이 든다', value: 1 },
      { id: 'uncomfortable', label: '불편한 느낌이 자주 있다', value: 2 },
      { id: 'painful', label: '움직이기가 불편한 경우가 많다', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.7,
      mapping: {
        'fresh': 0,
        'stiff': 30,
        'uncomfortable': 60,
        'painful': 90
      }
    }
  },
  
  {
    id: 'q9',
    category: 'pain',
    type: 'boolean',
    question: '장시간 앉거나 서 있으면 허리가 불편한가요?',
    description: '⚠️ 허리 통증이 있다면 의료기관을 방문하세요',
    options: [
      { id: 'yes', label: '자주 그렇다', value: 1 },
      { id: 'no', label: '그렇지 않다', value: 0 }
    ],
    required: true,
    scoring: {
      dimension: 'anterior_pelvic_tilt',
      weight: 0.6,
      mapping: {
        'yes': 50,
        'no': 0
      }
    }
  },
  
  {
    id: 'q10',
    category: 'pain',
    type: 'single',
    question: '두통이나 눈의 피로를 얼마나 자주 느끼나요?',
    description: '지난 한 달 기준 (💡 두통은 다양한 원인이 있을 수 있으며, 자세와 직접적인 관련이 없을 수 있습니다)',
    options: [
      { id: 'never', label: '거의 없다', value: 0 },
      { id: 'sometimes', label: '가끔 있다 (주 1-2회)', value: 1 },
      { id: 'often', label: '자주 있다 (주 3-4회)', value: 2 },
      { id: 'always', label: '거의 매일', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.5,
      mapping: {
        'never': 0,
        'sometimes': 25,
        'often': 50,
        'always': 75
      }
    }
  },
  
  // ========== C. 생활 패턴 (4문항) ==========
  {
    id: 'q11',
    category: 'lifestyle',
    type: 'single',
    question: '하루 평균 얼마나 앉아있나요?',
    description: '업무, 공부, 운전, 식사 등 모두 포함',
    options: [
      { id: 'short', label: '4시간 미만', value: 0 },
      { id: 'medium', label: '4-8시간', value: 1 },
      { id: 'long', label: '8-12시간', value: 2 },
      { id: 'very_long', label: '12시간 이상', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.6,
      mapping: {
        'short': 0,
        'medium': 30,
        'long': 60,
        'very_long': 90
      }
    }
  },
  
  {
    id: 'q12',
    category: 'lifestyle',
    type: 'single',
    question: '주로 어떤 환경에서 일하거나 공부하나요?',
    options: [
      { id: 'ergonomic', label: '인체공학적 책상과 의자를 사용한다', value: 0 },
      { id: 'standard', label: '일반 책상과 의자를 사용한다', value: 1 },
      { id: 'laptop', label: '노트북을 주로 사용한다', value: 2 },
      { id: 'mobile', label: '스마트폰을 많이 사용하는 편이다', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.7,
      mapping: {
        'ergonomic': 0,
        'standard': 20,
        'laptop': 50,
        'mobile': 70
      }
    }
  },
  
  {
    id: 'q13',
    category: 'lifestyle',
    type: 'single',
    question: '규칙적으로 운동을 하시나요?',
    description: '주 2회 이상, 30분 이상 기준 (💡 규칙적인 운동은 전반적인 건강에 도움이 될 수 있습니다)',
    options: [
      { id: 'regular', label: '주 3회 이상 한다', value: 0 },
      { id: 'sometimes', label: '주 1-2회 정도 한다', value: 1 },
      { id: 'rarely', label: '월 1-2회 정도 한다', value: 2 },
      { id: 'never', label: '거의 하지 않는다', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.5,
      mapping: {
        'regular': -20,
        'sometimes': 0,
        'rarely': 20,
        'never': 40
      }
    }
  },
  
  {
    id: 'q14',
    category: 'lifestyle',
    type: 'single',
    question: '일상에서 스트레칭이나 몸풀기를 하시나요?',
    options: [
      { id: 'frequent', label: '하루 여러 번 한다', value: 0 },
      { id: 'daily', label: '하루 1번 정도 한다', value: 1 },
      { id: 'sometimes', label: '가끔 생각날 때 한다', value: 2 },
      { id: 'never', label: '거의 하지 않는다', value: 3 }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.3,
      mapping: {
        'frequent': -10,
        'daily': 0,
        'sometimes': 10,
        'never': 20
      }
    }
  },
  
  // ========== D. 참고 정보 (2문항) ==========
  {
    id: 'q15',
    category: 'goal',
    type: 'single',
    question: '어떤 부분에 가장 관심이 있으신가요?',
    options: [
      { id: 'posture', label: '자세 습관 만들기', value: 'posture' },
      { id: 'pain', label: '불편함 줄이기', value: 'pain' },
      { id: 'appearance', label: '외관 개선', value: 'appearance' },
      { id: 'performance', label: '운동 능력 향상', value: 'performance' }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.0,
      mapping: {}
    }
  },
  
  {
    id: 'q16',
    category: 'goal',
    type: 'single',
    question: '주간 몇 시간 정도 투자할 수 있나요?',
    description: '운동이나 스트레칭 시간',
    options: [
      { id: 'minimal', label: '주 1-2시간 (하루 10-15분)', value: 'minimal' },
      { id: 'moderate', label: '주 3-4시간 (하루 30분)', value: 'moderate' },
      { id: 'dedicated', label: '주 5시간 이상 (하루 1시간)', value: 'dedicated' }
    ],
    required: true,
    scoring: {
      dimension: 'forward_head',
      weight: 0.0,
      mapping: {}
    }
  }
];
