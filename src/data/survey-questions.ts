import { SurveyQuestion } from '@/types/survey';

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  // ========== 카테고리 1: 자세 관찰 (5문항) ==========
  {
    id: 'q1',
    category: 'posture',
    type: 'single',
    question: '거울을 볼 때, 고개가 어느 쪽으로 기울어져 있나요?',
    description: '정면에서 관찰했을 때',
    options: [
      { id: 'straight', label: '정면을 똑바로 보고 있다', value: 0 },
      { id: 'slight', label: '약간 앞으로 나와 있다', value: 1 },
      { id: 'moderate', label: '눈에 띄게 앞으로 나와 있다', value: 2 },
      { id: 'severe', label: '매우 심하게 앞으로 나와 있다', value: 3 }
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
    question: '옆에서 봤을 때, 어깨의 위치는 어떤가요?',
    description: '측면 사진을 찍어보거나 가족에게 물어보세요',
    options: [
      { id: 'aligned', label: '귀와 일직선상에 있다', value: 0 },
      { id: 'slight', label: '약간 앞으로 말려있다', value: 1 },
      { id: 'moderate', label: '눈에 띄게 둥글게 말려있다', value: 2 },
      { id: 'severe', label: '가슴이 많이 움츠러들어 있다', value: 3 }
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
    question: '서 있을 때, 허리(골반)의 각도는 어떤가요?',
    description: '측면에서 관찰 - 허리가 과도하게 꺾였거나 일자인지 확인',
    options: [
      { id: 'neutral', label: '자연스러운 S자 곡선', value: 0 },
      { id: 'forward', label: '허리가 많이 꺾여서 배가 나와 보임', value: 1 },
      { id: 'backward', label: '허리가 일자에 가까워 보임', value: 2 }
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
    description: '여러 개 선택 가능',
    options: [
      { id: 'head_forward', label: '모니터를 볼 때 고개를 자주 내민다', value: 'head_forward' },
      { id: 'shoulder_hunch', label: '어깨가 귀보다 앞에 있다', value: 'shoulder_hunch' },
      { id: 'chest_tight', label: '가슴을 펴기가 불편하다', value: 'chest_tight' },
      { id: 'back_round', label: '등이 둥글게 말려있다', value: 'back_round' },
      { id: 'hip_forward', label: '골반이 앞으로 기울어진 느낌', value: 'hip_forward' },
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
    question: '장시간 앉아있을 때, 자세가 무너지는 속도는?',
    description: '1시간 기준',
    options: [
      { id: '1', label: '거의 무너지지 않음', value: 1 },
      { id: '2', label: '30분 후 약간 무너짐', value: 2 },
      { id: '3', label: '15분 후 많이 무너짐', value: 3 },
      { id: '4', label: '처음부터 바른 자세가 힘듦', value: 4 }
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
  
  // ========== 카테고리 2: 불편함/통증 (5문항) ==========
  {
    id: 'q6',
    category: 'pain',
    type: 'multiple',
    question: '평소 불편함을 느끼는 부위를 모두 선택하세요',
    description: '통증이 아닌 뻐근함, 뻣뻣함도 포함',
    options: [
      { id: 'neck', label: '목', value: 'neck' },
      { id: 'shoulder', label: '어깨', value: 'shoulder' },
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
    question: '목/어깨 불편함의 정도는?',
    description: '0 = 전혀 없음, 10 = 매우 심함',
    options: [
      { id: '0-2', label: '0-2점 (거의 없음)', value: 1 },
      { id: '3-5', label: '3-5점 (가끔 불편)', value: 5 },
      { id: '6-8', label: '6-8점 (자주 불편)', value: 7 },
      { id: '9-10', label: '9-10점 (매우 불편)', value: 10 }
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
    question: '아침에 일어났을 때 목/어깨 상태는?',
    options: [
      { id: 'fresh', label: '개운하고 편안하다', value: 0 },
      { id: 'stiff', label: '약간 뻣뻣하다', value: 1 },
      { id: 'uncomfortable', label: '많이 불편하다', value: 2 },
      { id: 'painful', label: '매우 불편하고 움직이기 힘들다', value: 3 }
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
    question: '장시간 앉아있거나 서있으면 허리가 불편한가요?',
    options: [
      { id: 'yes', label: '예', value: 1 },
      { id: 'no', label: '아니오', value: 0 }
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
    options: [
      { id: 'never', label: '거의 없음', value: 0 },
      { id: 'sometimes', label: '가끔 (주 1-2회)', value: 1 },
      { id: 'often', label: '자주 (주 3-4회)', value: 2 },
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
  
  // ========== 카테고리 3: 생활 습관 (3문항) ==========
  {
    id: 'q11',
    category: 'lifestyle',
    type: 'single',
    question: '하루 평균 앉아있는 시간은?',
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
    question: '주로 사용하는 업무/공부 환경은?',
    options: [
      { id: 'ergonomic', label: '인체공학적 책상/의자 사용', value: 0 },
      { id: 'standard', label: '일반 책상/의자', value: 1 },
      { id: 'laptop', label: '노트북 주로 사용', value: 2 },
      { id: 'mobile', label: '스마트폰을 많이 사용', value: 3 }
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
    question: '규칙적인 운동 습관이 있나요?',
    description: '주 2회 이상, 30분 이상',
    options: [
      { id: 'regular', label: '규칙적으로 한다 (주 3회 이상)', value: 0 },
      { id: 'sometimes', label: '가끔 한다 (주 1-2회)', value: 1 },
      { id: 'rarely', label: '거의 안 한다 (월 1-2회)', value: 2 },
      { id: 'never', label: '전혀 안 한다', value: 3 }
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
  
  // ========== 카테고리 4: 목표 (2문항) ==========
  {
    id: 'q14',
    category: 'goal',
    type: 'single',
    question: '가장 개선하고 싶은 것은?',
    options: [
      { id: 'posture', label: '바른 자세 만들기', value: 'posture' },
      { id: 'pain', label: '불편함 줄이기', value: 'pain' },
      { id: 'appearance', label: '체형 개선 (외관)', value: 'appearance' },
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
    id: 'q15',
    category: 'goal',
    type: 'single',
    question: '자세 개선에 투자할 수 있는 시간은?',
    description: '주간 기준',
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
