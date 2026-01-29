# 🔄 자동 설문 → PDF 생성 시스템 설계서

> **작성일:** 2026-01-29  
> **목적:** Free 플랜 핵심 기능 구현  
> **법적 준수:** 의료법 위반 방지 철저

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [설문 설계](#2-설문-설계)
3. [결과 분석 로직](#3-결과-분석-로직)
4. [PDF 생성 시스템](#4-pdf-생성-시스템)
5. [이메일 발송 플로우](#5-이메일-발송-플로우)
6. [구현 코드](#6-구현-코드)

---

## 1. 시스템 개요

### 1.1 전체 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                      1. 사용자 설문 작성                      │
│                  (15개 질문, 소요 시간: 3분)                  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. 결과 자동 분석 (AI)                    │
│           - 체형 유형 판단 (8가지 패턴)                       │
│           - 심각도 평가 (경미/보통/심각)                      │
│           - 맞춤 콘텐츠 선택                                  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                     3. PDF 자동 생성                         │
│           - 5페이지 전문 리포트                               │
│           - 개인 맞춤 운동 가이드 3가지                       │
│           - 업그레이드 유도 CTA                               │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  4. 이메일 즉시 발송                         │
│           - PDF 첨부 (3MB 이하)                              │
│           - 요약 + 다음 단계 안내                            │
│           - Basic 플랜 프로모션                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 기술 스택

| 컴포넌트 | 기술 | 용도 |
|----------|------|------|
| **설문 UI** | React + TailwindCSS | 인터랙티브 설문 |
| **분석 로직** | TypeScript | 결과 계산 |
| **PDF 생성** | @react-pdf/renderer | 서버사이드 PDF |
| **이메일** | SendGrid / AWS SES | 자동 발송 |
| **스토리지** | Supabase Storage | PDF 임시 저장 |

---

## 2. 설문 설계

### 2.1 설문 JSON 구조

```typescript
// types/survey.ts

export interface SurveyQuestion {
  id: string;
  category: 'posture' | 'pain' | 'lifestyle' | 'goal';
  type: 'single' | 'multiple' | 'scale' | 'boolean';
  question: string;
  description?: string;
  options: SurveyOption[];
  required: boolean;
  scoring: QuestionScoring;
}

export interface SurveyOption {
  id: string;
  label: string;
  value: string | number;
  image?: string;  // 선택적 이미지
}

export interface QuestionScoring {
  dimension: 'forward_head' | 'rounded_shoulder' | 'anterior_pelvic_tilt' | 'posterior_pelvic_tilt';
  weight: number;  // 가중치 (0-1)
  mapping: Record<string, number>;  // 선택지 → 점수
}

export interface SurveyResponse {
  userId: string;
  responses: Record<string, string | string[]>;
  completedAt: Date;
}

export interface AnalysisResult {
  postureType: string;
  severity: 'mild' | 'moderate' | 'severe';
  scores: {
    forwardHead: number;
    roundedShoulder: number;
    anteriorPelvicTilt: number;
    posteriorPelvicTilt: number;
  };
  primaryIssues: string[];
  recommendations: string[];
}
```

### 2.2 실제 설문 데이터

```typescript
// data/survey-questions.ts

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
        'regular': -20,  // 운동하면 점수 감소
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
      weight: 0.0,  // 점수에 반영 안 함 (목표 식별용)
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
      weight: 0.0,  // 점수에 반영 안 함 (추천 플랜 결정용)
      mapping: {}
    }
  }
];
```

---

## 3. 결과 분석 로직

### 3.1 점수 계산 알고리즘

```typescript
// lib/survey-analyzer.ts

export interface PostureScores {
  forwardHead: number;        // 0-100
  roundedShoulder: number;    // 0-100
  anteriorPelvicTilt: number; // 0-100
  posteriorPelvicTilt: number;// 0-100
}

export interface AnalysisResult {
  // 체형 유형
  postureType: PostureType;
  
  // 심각도
  overallSeverity: 'mild' | 'moderate' | 'severe';
  
  // 각 부위별 점수
  scores: PostureScores;
  
  // 주요 문제점 (최대 3개)
  primaryIssues: Array<{
    area: string;
    severity: 'mild' | 'moderate' | 'severe';
    description: string;
  }>;
  
  // 맞춤 권장사항
  recommendations: string[];
  
  // 추천 플랜
  recommendedPlan: 'basic' | 'standard' | 'premium';
  
  // 사용자 목표
  userGoal: string;
  timeCommitment: string;
}

export type PostureType = 
  | 'forward_head'              // 거북목형
  | 'rounded_shoulder'          // 라운드숄더형
  | 'upper_cross_syndrome'      // 상부교차증후군 (거북목+라운드숄더)
  | 'anterior_pelvic_tilt'      // 골반전방경사형
  | 'posterior_pelvic_tilt'     // 골반후방경사형
  | 'swayback'                  // 요추만곡형
  | 'flat_back'                 // 평평한등형
  | 'neutral';                  // 양호한형

// 메인 분석 함수
export function analyzeSurveyResults(
  responses: Record<string, string | string[]>
): AnalysisResult {
  
  // 1. 각 차원별 점수 계산
  const scores = calculateDimensionScores(responses);
  
  // 2. 체형 유형 판단
  const postureType = determinePostureType(scores);
  
  // 3. 전체 심각도 평가
  const overallSeverity = calculateOverallSeverity(scores);
  
  // 4. 주요 문제점 추출
  const primaryIssues = identifyPrimaryIssues(scores, responses);
  
  // 5. 맞춤 권장사항 생성
  const recommendations = generateRecommendations(postureType, scores, responses);
  
  // 6. 추천 플랜 결정
  const recommendedPlan = determineRecommendedPlan(overallSeverity, responses);
  
  // 7. 사용자 목표 추출
  const userGoal = responses['q14'] as string;
  const timeCommitment = responses['q15'] as string;
  
  return {
    postureType,
    overallSeverity,
    scores,
    primaryIssues,
    recommendations,
    recommendedPlan,
    userGoal,
    timeCommitment
  };
}

// 차원별 점수 계산
function calculateDimensionScores(
  responses: Record<string, string | string[]>
): PostureScores {
  
  const dimensionScores: Record<string, number[]> = {
    forward_head: [],
    rounded_shoulder: [],
    anterior_pelvic_tilt: [],
    posterior_pelvic_tilt: []
  };
  
  // 각 질문의 답변을 점수로 변환
  SURVEY_QUESTIONS.forEach(question => {
    const response = responses[question.id];
    if (!response) return;
    
    const { dimension, weight, mapping } = question.scoring;
    
    if (question.type === 'multiple') {
      // 복수 선택
      const selections = response as string[];
      const totalScore = selections.reduce((sum, selection) => {
        return sum + (mapping[selection] || 0);
      }, 0);
      dimensionScores[dimension].push(totalScore * weight);
      
    } else {
      // 단일 선택
      const score = mapping[response as string] || 0;
      dimensionScores[dimension].push(score * weight);
    }
  });
  
  // 각 차원별 평균 점수 계산 (0-100)
  return {
    forwardHead: calculateAverage(dimensionScores.forward_head),
    roundedShoulder: calculateAverage(dimensionScores.rounded_shoulder),
    anteriorPelvicTilt: calculateAverage(dimensionScores.anterior_pelvic_tilt),
    posteriorPelvicTilt: calculateAverage(dimensionScores.posterior_pelvic_tilt)
  };
}

function calculateAverage(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = sum / scores.length;
  return Math.min(100, Math.max(0, avg)); // 0-100 범위로 제한
}

// 체형 유형 판단
function determinePostureType(scores: PostureScores): PostureType {
  const { forwardHead, roundedShoulder, anteriorPelvicTilt, posteriorPelvicTilt } = scores;
  
  // 모든 점수가 30 미만이면 양호
  if (Math.max(forwardHead, roundedShoulder, anteriorPelvicTilt, posteriorPelvicTilt) < 30) {
    return 'neutral';
  }
  
  // 상부교차증후군 (거북목 + 라운드숄더 둘 다 50 이상)
  if (forwardHead >= 50 && roundedShoulder >= 50) {
    return 'upper_cross_syndrome';
  }
  
  // 가장 높은 점수의 유형 반환
  const maxScore = Math.max(forwardHead, roundedShoulder, anteriorPelvicTilt, posteriorPelvicTilt);
  
  if (maxScore === forwardHead) return 'forward_head';
  if (maxScore === roundedShoulder) return 'rounded_shoulder';
  if (maxScore === anteriorPelvicTilt) return 'anterior_pelvic_tilt';
  if (maxScore === posteriorPelvicTilt) return 'posterior_pelvic_tilt';
  
  return 'neutral';
}

// 전체 심각도 평가
function calculateOverallSeverity(scores: PostureScores): 'mild' | 'moderate' | 'severe' {
  const values = Object.values(scores);
  const maxScore = Math.max(...values);
  const avgScore = values.reduce((a, b) => a + b, 0) / values.length;
  
  // 평균 기준
  if (avgScore >= 60 || maxScore >= 80) return 'severe';
  if (avgScore >= 40 || maxScore >= 60) return 'moderate';
  return 'mild';
}

// 주요 문제점 식별
function identifyPrimaryIssues(
  scores: PostureScores,
  responses: Record<string, string | string[]>
): Array<{ area: string; severity: 'mild' | 'moderate' | 'severe'; description: string }> {
  
  const issues: Array<{ area: string; score: number; severity: 'mild' | 'moderate' | 'severe'; description: string }> = [];
  
  // 거북목
  if (scores.forwardHead >= 30) {
    issues.push({
      area: '목/경추',
      score: scores.forwardHead,
      severity: getSeverityLevel(scores.forwardHead),
      description: ISSUE_DESCRIPTIONS.forward_head[getSeverityLevel(scores.forwardHead)]
    });
  }
  
  // 라운드숄더
  if (scores.roundedShoulder >= 30) {
    issues.push({
      area: '어깨/흉추',
      score: scores.roundedShoulder,
      severity: getSeverityLevel(scores.roundedShoulder),
      description: ISSUE_DESCRIPTIONS.rounded_shoulder[getSeverityLevel(scores.roundedShoulder)]
    });
  }
  
  // 골반 전방 경사
  if (scores.anteriorPelvicTilt >= 30) {
    issues.push({
      area: '골반/허리',
      score: scores.anteriorPelvicTilt,
      severity: getSeverityLevel(scores.anteriorPelvicTilt),
      description: ISSUE_DESCRIPTIONS.anterior_pelvic_tilt[getSeverityLevel(scores.anteriorPelvicTilt)]
    });
  }
  
  // 골반 후방 경사
  if (scores.posteriorPelvicTilt >= 30) {
    issues.push({
      area: '골반/허리',
      score: scores.posteriorPelvicTilt,
      severity: getSeverityLevel(scores.posteriorPelvicTilt),
      description: ISSUE_DESCRIPTIONS.posterior_pelvic_tilt[getSeverityLevel(scores.posteriorPelvicTilt)]
    });
  }
  
  // 점수 높은 순으로 정렬, 최대 3개
  return issues
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ area, severity, description }) => ({ area, severity, description }));
}

function getSeverityLevel(score: number): 'mild' | 'moderate' | 'severe' {
  if (score >= 70) return 'severe';
  if (score >= 45) return 'moderate';
  return 'mild';
}

// 문제별 설명 (법적 준수)
const ISSUE_DESCRIPTIONS = {
  forward_head: {
    mild: '고개가 약간 앞으로 나온 상태입니다. 목 주변 근육의 균형이 필요합니다.',
    moderate: '고개가 눈에 띄게 앞으로 나온 상태입니다. 목과 어깨 근육의 긴장이 관찰됩니다.',
    severe: '고개가 많이 앞으로 나온 상태입니다. 목, 어깨, 등 상부의 근육 불균형이 심화된 상태입니다.'
  },
  rounded_shoulder: {
    mild: '어깨가 약간 앞으로 말린 상태입니다. 가슴 근육이 짧아지고 있습니다.',
    moderate: '어깨가 눈에 띄게 앞으로 말린 상태입니다. 가슴과 등 근육의 불균형이 관찰됩니다.',
    severe: '어깨가 많이 앞으로 말린 상태입니다. 상체 전면과 후면의 근육 불균형이 심화되었습니다.'
  },
  anterior_pelvic_tilt: {
    mild: '골반이 약간 앞으로 기울어진 상태입니다. 허리 주변 근육의 균형이 필요합니다.',
    moderate: '골반이 눈에 띄게 앞으로 기울어진 상태입니다. 복부와 엉덩이 근육의 약화가 관찰됩니다.',
    severe: '골반이 많이 앞으로 기울어진 상태입니다. 허리 과긴장과 복부/둔근의 약화가 심화되었습니다.'
  },
  posterior_pelvic_tilt: {
    mild: '골반이 약간 뒤로 기울어진 상태입니다. 허리의 자연스러운 곡선이 줄어들고 있습니다.',
    moderate: '골반이 눈에 띄게 뒤로 기울어진 상태입니다. 허리가 평평해지고 있습니다.',
    severe: '골반이 많이 뒤로 기울어진 상태입니다. 허리의 자연스러운 곡선이 거의 사라졌습니다.'
  }
};

// 맞춤 권장사항 생성
function generateRecommendations(
  postureType: PostureType,
  scores: PostureScores,
  responses: Record<string, string | string[]>
): string[] {
  
  const recommendations: string[] = [];
  
  // 체형 유형별 기본 권장사항
  const baseRecommendations = POSTURE_TYPE_RECOMMENDATIONS[postureType];
  recommendations.push(...baseRecommendations);
  
  // 생활 습관 기반 추가 권장사항
  const sittingTime = responses['q11'];
  if (sittingTime === 'long' || sittingTime === 'very_long') {
    recommendations.push('장시간 앉아있는 경우가 많으니, 50분마다 5분씩 일어나서 스트레칭하는 습관을 들이세요.');
  }
  
  const workEnvironment = responses['q12'];
  if (workEnvironment === 'laptop' || workEnvironment === 'mobile') {
    recommendations.push('노트북이나 스마트폰 사용 시 화면을 눈높이까지 올려서 사용하세요.');
  }
  
  // 운동 습관 기반
  const exercise = responses['q13'];
  if (exercise === 'rarely' || exercise === 'never') {
    recommendations.push('주 2-3회, 20-30분 정도의 가벼운 운동부터 시작하세요.');
  }
  
  return recommendations.slice(0, 5); // 최대 5개
}

const POSTURE_TYPE_RECOMMENDATIONS: Record<PostureType, string[]> = {
  neutral: [
    '현재 상태가 양호합니다! 이 상태를 유지하는 것이 중요합니다.',
    '규칙적인 스트레칭으로 예방하세요.',
    '올바른 자세 습관을 계속 유지하세요.'
  ],
  forward_head: [
    '목 뒤쪽 근육을 강화하고, 가슴 근육을 이완하는 운동이 필요합니다.',
    '턱 당기기 운동을 하루 3회, 10회씩 반복하세요.',
    '모니터 높이를 눈높이에 맞추세요.'
  ],
  rounded_shoulder: [
    '가슴을 펴는 스트레칭과 등 근육 강화 운동이 필요합니다.',
    '벽에 등을 대고 어깨를 뒤로 당기는 동작을 자주 하세요.',
    '가슴 앞 근육(대흉근)을 충분히 이완하세요.'
  ],
  upper_cross_syndrome: [
    '목, 어깨, 등 전체의 근육 균형 회복이 필요합니다.',
    '턱 당기기와 어깨 뒤로 당기기를 동시에 수행하세요.',
    '체계적인 4단계 운동 프로그램을 추천합니다.'
  ],
  anterior_pelvic_tilt: [
    '복부와 둔근 강화, 허리와 고관절 굴근 이완이 필요합니다.',
    '플랭크와 데드버그 운동으로 코어를 강화하세요.',
    '엉덩이 스트레칭을 꾸준히 하세요.'
  ],
  posterior_pelvic_tilt: [
    '허리 신전근 강화와 햄스트링 이완이 필요합니다.',
    '고양이-소 자세로 척추 움직임을 회복하세요.',
    '허리의 자연스러운 곡선을 찾는 연습이 필요합니다.'
  ],
  swayback: [
    '전신의 자세 정렬 조정이 필요합니다.',
    '체계적인 평가와 맞춤 운동 프로그램을 권장합니다.'
  ],
  flat_back: [
    '척추의 자연스러운 곡선을 회복하는 운동이 필요합니다.',
    '골반 기울이기와 흉추 신전 운동을 하세요.'
  ]
};

// 추천 플랜 결정
function determineRecommendedPlan(
  severity: 'mild' | 'moderate' | 'severe',
  responses: Record<string, string | string[]>
): 'basic' | 'standard' | 'premium' {
  
  // 심각도 기반
  if (severity === 'severe') {
    return 'premium';  // Zoom 코칭 필요
  }
  
  if (severity === 'moderate') {
    return 'standard';  // 주간 피드백 필요
  }
  
  // 시간 투자 의향 기반
  const timeCommitment = responses['q15'];
  if (timeCommitment === 'dedicated') {
    return 'standard';  // 적극적인 개선 의지
  }
  
  return 'basic';  // 기본 가이드로 충분
}
```

---

## 4. PDF 생성 시스템

### 4.1 PDF 템플릿 구조

```typescript
// lib/pdf-generator.ts

import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';

// 폰트 등록 (한글 지원)
Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: '/fonts/NotoSansKR-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/NotoSansKR-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/NotoSansKR-Light.ttf', fontWeight: 'light' }
  ]
});

// 스타일 정의
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    lineHeight: 1.6
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #f97316',
    paddingBottom: 15
  },
  logo: {
    width: 120,
    height: 40,
    marginBottom: 10
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20
  },
  section: {
    marginBottom: 25
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #e2e8f0'
  },
  paragraph: {
    fontSize: 10,
    color: '#334155',
    marginBottom: 10,
    lineHeight: 1.7
  },
  highlight: {
    backgroundColor: '#fef3c7',
    padding: '15px',
    borderRadius: 8,
    marginBottom: 15
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8
  },
  highlightText: {
    fontSize: 10,
    color: '#78350f',
    lineHeight: 1.6
  },
  scoreBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  scoreItem: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    border: '1px solid #e2e8f0'
  },
  scoreLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 4
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  scoreBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden'
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4
  },
  bulletList: {
    marginLeft: 15
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8
  },
  bullet: {
    width: 16,
    color: '#f97316',
    fontWeight: 'bold'
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.6
  },
  comparisonTable: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 15
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e2e8f0'
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold'
  },
  tableCell: {
    flex: 1,
    padding: 10,
    fontSize: 9
  },
  ctaBox: {
    backgroundColor: '#f97316',
    padding: 20,
    borderRadius: 12,
    marginTop: 20
  },
  ctaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center'
  },
  ctaText: {
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12
  },
  ctaButton: {
    backgroundColor: '#ffffff',
    padding: '10px 20px',
    borderRadius: 8,
    textAlign: 'center',
    marginTop: 10
  },
  ctaButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f97316'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 15,
    borderTop: '1px solid #e2e8f0',
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center'
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    fontSize: 8,
    color: '#94a3b8'
  }
});

// PDF 문서 컴포넌트
export const PostureAnalysisReport = ({ analysis, userInfo }: {
  analysis: AnalysisResult;
  userInfo: { name: string; email: string; analyzedAt: Date };
}) => (
  <Document>
    {/* 페이지 1: 커버 + 요약 */}
    <Page size="A4" style={styles.page}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Image src="/logo.png" style={styles.logo} />
        <Text style={styles.title}>자세 분석 리포트</Text>
        <Text style={styles.subtitle}>
          {userInfo.name}님의 맞춤 자세 평가 결과
        </Text>
        <Text style={styles.subtitle}>
          분석일: {userInfo.analyzedAt.toLocaleDateString('ko-KR')}
        </Text>
      </View>
      
      {/* 현재 상태 요약 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 현재 상태 요약</Text>
        
        <View style={styles.highlight}>
          <Text style={styles.highlightTitle}>
            🎯 주요 체형 유형: {POSTURE_TYPE_NAMES[analysis.postureType]}
          </Text>
          <Text style={styles.highlightText}>
            {POSTURE_TYPE_DESCRIPTIONS[analysis.postureType]}
          </Text>
        </View>
        
        {/* 점수 박스 */}
        <View style={styles.scoreBox}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>목/경추</Text>
            <Text style={styles.scoreValue}>{analysis.scores.forwardHead.toFixed(0)}점</Text>
            <View style={styles.scoreBar}>
              <View style={[
                styles.scoreBarFill,
                { width: `${analysis.scores.forwardHead}%`, backgroundColor: getScoreColor(analysis.scores.forwardHead) }
              ]} />
            </View>
          </View>
          
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>어깨/흉추</Text>
            <Text style={styles.scoreValue}>{analysis.scores.roundedShoulder.toFixed(0)}점</Text>
            <View style={styles.scoreBar}>
              <View style={[
                styles.scoreBarFill,
                { width: `${analysis.scores.roundedShoulder}%`, backgroundColor: getScoreColor(analysis.scores.roundedShoulder) }
              ]} />
            </View>
          </View>
        </View>
        
        <View style={styles.scoreBox}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>골반 전방</Text>
            <Text style={styles.scoreValue}>{analysis.scores.anteriorPelvicTilt.toFixed(0)}점</Text>
            <View style={styles.scoreBar}>
              <View style={[
                styles.scoreBarFill,
                { width: `${analysis.scores.anteriorPelvicTilt}%`, backgroundColor: getScoreColor(analysis.scores.anteriorPelvicTilt) }
              ]} />
            </View>
          </View>
          
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>골반 후방</Text>
            <Text style={styles.scoreValue}>{analysis.scores.posteriorPelvicTilt.toFixed(0)}점</Text>
            <View style={styles.scoreBar}>
              <View style={[
                styles.scoreBarFill,
                { width: `${analysis.scores.posteriorPelvicTilt}%`, backgroundColor: getScoreColor(analysis.scores.posteriorPelvicTilt) }
              ]} />
            </View>
          </View>
        </View>
        
        <Text style={styles.paragraph}>
          * 0-30점: 양호 | 30-60점: 주의 필요 | 60-100점: 개선 필요
        </Text>
      </View>
      
      {/* 주요 발견사항 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔍 주요 발견사항</Text>
        <View style={styles.bulletList}>
          {analysis.primaryIssues.map((issue, index) => (
            <View key={index} style={styles.bulletItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: 'bold' }}>[{issue.area}]</Text> {issue.description}
              </Text>
            </View>
          ))}
        </View>
      </View>
      
      <Text style={styles.footer}>
        © 2026 포스처랩 | 본 리포트는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.
      </Text>
      <Text style={styles.pageNumber}>1 / 5</Text>
    </Page>
    
    {/* 페이지 2: 방치 시 리스크 */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>⚠️ 방치 시 리스크</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          현재 상태를 방치할 경우, 다음과 같은 변화가 나타날 수 있습니다:
        </Text>
        
        <View style={styles.highlight}>
          <Text style={styles.highlightTitle}>
            ⏰ 단기 (1-3개월 내)
          </Text>
          <View style={styles.bulletList}>
            {getShortTermRisks(analysis.postureType).map((risk, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{risk}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.highlight}>
          <Text style={styles.highlightTitle}>
            📅 중기 (3-12개월 내)
          </Text>
          <View style={styles.bulletList}>
            {getMidTermRisks(analysis.postureType).map((risk, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{risk}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.highlight}>
          <Text style={styles.highlightTitle}>
            ⚡ 장기 (1년 이상)
          </Text>
          <View style={styles.bulletList}>
            {getLongTermRisks(analysis.postureType).map((risk, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{risk}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      
      <Text style={styles.footer}>
        © 2026 포스처랩 | 본 리포트는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.
      </Text>
      <Text style={styles.pageNumber}>2 / 5</Text>
    </Page>
    
    {/* 페이지 3: 혼자 vs 관리 비교 */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>🤔 혼자 할 때 vs 관리 받을 때</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          자세 개선 방법에 따른 예상 결과 비교:
        </Text>
        
        <View style={styles.comparisonTable}>
          {/* 헤더 */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>구분</Text>
            <Text style={styles.tableCell}>혼자 할 때</Text>
            <Text style={styles.tableCell}>관리 받을 때</Text>
          </View>
          
          {/* 데이터 행 */}
          {COMPARISON_DATA.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5, fontWeight: 'bold' }]}>{row.category}</Text>
              <Text style={styles.tableCell}>{row.alone}</Text>
              <Text style={styles.tableCell}>{row.managed}</Text>
            </View>
          ))}
        </View>
        
        <View style={[styles.highlight, { marginTop: 20 }]}>
          <Text style={styles.highlightTitle}>💡 알고 계셨나요?</Text>
          <Text style={styles.highlightText}>
            • 잘못된 운동은 오히려 자세를 악화시킬 수 있습니다{'\n'}
            • 전문가의 피드백은 운동 효과를 3배 이상 높입니다{'\n'}
            • 체계적인 4단계 프로그램은 재발을 80% 감소시킵니다
          </Text>
        </View>
      </View>
      
      <Text style={styles.footer}>
        © 2026 포스처랩 | 본 리포트는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.
      </Text>
      <Text style={styles.pageNumber}>3 / 5</Text>
    </Page>
    
    {/* 페이지 4: 맞춤 개선 방향 */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>✨ {userInfo.name}님을 위한 맞춤 개선 방향</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 우선순위 개선 방향</Text>
        <View style={styles.bulletList}>
          {analysis.recommendations.map((rec, i) => (
            <View key={i} style={styles.bulletItem}>
              <Text style={styles.bullet}>{i + 1}.</Text>
              <Text style={styles.bulletText}>{rec}</Text>
            </View>
          ))}
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💪 추천 운동 (기본 3가지)</Text>
        <View style={styles.bulletList}>
          {getRecommendedExercises(analysis.postureType).map((exercise, i) => (
            <View key={i} style={[styles.bulletItem, { marginBottom: 12 }]}>
              <Text style={styles.bullet}>•</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bulletText, { fontWeight: 'bold', marginBottom: 4 }]}>
                  {exercise.name}
                </Text>
                <Text style={[styles.bulletText, { fontSize: 9, color: '#64748b' }]}>
                  {exercise.description}
                </Text>
                <Text style={[styles.bulletText, { fontSize: 9, color: '#64748b', marginTop: 2 }]}>
                  {exercise.frequency}
                </Text>
              </View>
            </View>
          ))}
        </View>
        
        <Text style={[styles.paragraph, { marginTop: 15, fontStyle: 'italic', color: '#64748b' }]}>
          * 더 상세한 영상 가이드와 맞춤 프로그램은 Basic 플랜에서 제공됩니다.
        </Text>
      </View>
      
      <Text style={styles.footer}>
        © 2026 포스처랩 | 본 리포트는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.
      </Text>
      <Text style={styles.pageNumber}>4 / 5</Text>
    </Page>
    
    {/* 페이지 5: 다음 단계 + CTA */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>🚀 다음 단계</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          {userInfo.name}님의 현재 상태({SEVERITY_NAMES[analysis.overallSeverity]})를 고려했을 때,{' '}
          <Text style={{ fontWeight: 'bold', color: '#f97316' }}>
            {PLAN_NAMES[analysis.recommendedPlan]}
          </Text>{' '}
          플랜을 추천드립니다.
        </Text>
        
        {/* 플랜별 비교 */}
        <View style={styles.comparisonTable}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>플랜</Text>
            <Text style={styles.tableCell}>제공 내용</Text>
            <Text style={styles.tableCell}>가격</Text>
          </View>
          
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Free</Text>
            <Text style={styles.tableCell}>설문 + PDF (이 리포트)</Text>
            <Text style={styles.tableCell}>무료</Text>
          </View>
          
          <View style={[styles.tableRow, analysis.recommendedPlan === 'basic' && { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Basic</Text>
            <Text style={styles.tableCell}>사진 2장 + 영상 피드백 1회</Text>
            <Text style={styles.tableCell}>₩29,900</Text>
          </View>
          
          <View style={[styles.tableRow, analysis.recommendedPlan === 'standard' && { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Standard</Text>
            <Text style={styles.tableCell}>주 1회 피드백 + 월 2회 재평가</Text>
            <Text style={styles.tableCell}>₩49,900</Text>
          </View>
          
          <View style={[styles.tableRow, analysis.recommendedPlan === 'premium' && { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Premium</Text>
            <Text style={styles.tableCell}>Zoom 코칭 + 일정 관리</Text>
            <Text style={styles.tableCell}>₩99,000/월</Text>
          </View>
        </View>
      </View>
      
      {/* CTA */}
      <View style={styles.ctaBox}>
        <Text style={styles.ctaTitle}>
          🎉 지금 업그레이드하면 20% 할인!
        </Text>
        <Text style={styles.ctaText}>
          이 리포트를 받은 후 7일 내 업그레이드 시 특별 할인을 드립니다.
        </Text>
        <View style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>
            www.posturelab.com/upgrade
          </Text>
        </View>
      </View>
      
      {/* 면책 조항 */}
      <View style={[styles.highlight, { marginTop: 20, backgroundColor: '#fef2f2' }]}>
        <Text style={[styles.highlightTitle, { color: '#991b1b' }]}>
          ⚠️ 중요 안내
        </Text>
        <Text style={[styles.highlightText, { color: '#7f1d1d', fontSize: 8 }]}>
          • 본 리포트는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.{'\n'}
          • 통증, 질병, 부상이 있는 경우 반드시 의료 전문가와 상담하세요.{'\n'}
          • 운동 중 발생하는 부상은 이용자 본인의 책임입니다.{'\n'}
          • 운동 효과는 개인차가 있을 수 있으며, 결과를 보장하지 않습니다.
        </Text>
      </View>
      
      <Text style={[styles.footer, { marginTop: 20 }]}>
        © 2026 포스처랩 | 고객센터: contact@posturelab.com | 이용약관 및 개인정보처리방침: www.posturelab.com/terms
      </Text>
      <Text style={styles.pageNumber}>5 / 5</Text>
    </Page>
  </Document>
);

// 헬퍼 함수들
function getScoreColor(score: number): string {
  if (score >= 70) return '#ef4444';  // red
  if (score >= 40) return '#f59e0b';  // amber
  return '#10b981';  // green
}

const POSTURE_TYPE_NAMES: Record<PostureType, string> = {
  neutral: '양호한 자세',
  forward_head: '거북목형 자세',
  rounded_shoulder: '라운드숄더형 자세',
  upper_cross_syndrome: '상부 교차 증후군',
  anterior_pelvic_tilt: '골반 전방 경사형',
  posterior_pelvic_tilt: '골반 후방 경사형',
  swayback: '요추 만곡형',
  flat_back: '평평한 등형'
};

const POSTURE_TYPE_DESCRIPTIONS: Record<PostureType, string> = {
  neutral: '전체적으로 균형 잡힌 자세를 유지하고 계십니다. 현재 상태를 유지하는 것이 중요합니다.',
  forward_head: '고개가 앞으로 나온 자세로, 목과 어깨 주변 근육의 불균형이 관찰됩니다.',
  rounded_shoulder: '어깨가 앞으로 말린 자세로, 가슴과 등 근육의 불균형이 관찰됩니다.',
  upper_cross_syndrome: '고개와 어깨가 모두 앞으로 나온 상태로, 상체 전체의 근육 균형 회복이 필요합니다.',
  anterior_pelvic_tilt: '골반이 앞으로 기울어진 자세로, 허리와 복부 주변 근육의 균형이 필요합니다.',
  posterior_pelvic_tilt: '골반이 뒤로 기울어진 자세로, 허리의 자연스러운 곡선 회복이 필요합니다.',
  swayback: '전신의 자세 정렬 조정이 필요한 상태입니다.',
  flat_back: '척추의 자연스러운 곡선을 회복하는 운동이 필요한 상태입니다.'
};

function getShortTermRisks(postureType: PostureType): string[] {
  const risks: Record<PostureType, string[]> = {
    neutral: ['현재 상태가 양호하므로 특별한 리스크는 없습니다.'],
    forward_head: [
      '목 뒤쪽과 어깨 상부의 긴장 증가',
      '두통과 눈의 피로 빈도 증가',
      '집중력 저하 가능성'
    ],
    rounded_shoulder: [
      '가슴 앞 근육의 지속적 단축',
      '등 위쪽 근육의 약화 진행',
      '호흡 용량 감소 가능성'
    ],
    upper_cross_syndrome: [
      '목과 어깨 불편함의 일상화',
      '상체 전체의 근육 불균형 심화',
      '업무 집중도 저하'
    ],
    anterior_pelvic_tilt: [
      '허리 주변 근육의 지속적 긴장',
      '복부 근육의 약화 진행',
      '장시간 서있기 불편함 증가'
    ],
    posterior_pelvic_tilt: [
      '허리의 자연스러운 곡선 추가 감소',
      '햄스트링 긴장 증가',
      '앉은 자세에서의 불편함 증가'
    ],
    swayback: ['전신 근육 불균형의 점진적 악화'],
    flat_back: ['척추 충격 흡수 능력 감소']
  };
  return risks[postureType];
}

function getMidTermRisks(postureType: PostureType): string[] {
  const risks: Record<PostureType, string[]> = {
    neutral: ['예방 운동을 게을리할 경우 자세가 무너질 수 있습니다.'],
    forward_head: [
      '목 디스크 부담 증가',
      '만성적인 어깨 결림',
      '팔로 방사되는 불편함 가능성'
    ],
    rounded_shoulder: [
      '어깨 관절 가동 범위 제한',
      '상체 유연성 지속적 감소',
      '등이 둥글게 굳어지는 경향'
    ],
    upper_cross_syndrome: [
      '상체 전반의 만성적 불편함',
      '일상 활동 제한 증가',
      '자세 교정 난이도 상승'
    ],
    anterior_pelvic_tilt: [
      '만성 허리 불편함',
      '골반 주변 근육의 심한 불균형',
      '자세 유지 능력 저하'
    ],
    posterior_pelvic_tilt: [
      '척추의 유연성 감소',
      '앉은 자세 유지 어려움',
      '허리 근육 약화'
    ],
    swayback: ['복합적 자세 문제로 발전 가능성'],
    flat_back: ['척추 관절 부담 증가']
  };
  return risks[postureType];
}

function getLongTermRisks(postureType: PostureType): string[] {
  const risks: Record<PostureType, string[]> = {
    neutral: ['지속적인 관리로 건강한 자세를 평생 유지할 수 있습니다.'],
    forward_head: [
      '목 구조의 변형 가능성',
      '만성 두통의 일상화',
      '상체 전체로 문제 확산 가능성'
    ],
    rounded_shoulder: [
      '어깨 관절 구조적 변화',
      '등의 영구적 둥근 형태 고착',
      '심폐 기능 저하 가능성'
    ],
    upper_cross_syndrome: [
      '상체 구조적 변형',
      '일상생활 동작 제한',
      '자가 교정 매우 어려운 상태로 진행'
    ],
    anterior_pelvic_tilt: [
      '만성 허리 문제',
      '골반 및 고관절 구조 변화',
      '하체 기능 저하 가능성'
    ],
    posterior_pelvic_tilt: [
      '척추의 자연스러운 곡선 상실',
      '장시간 활동 시 빠른 피로',
      '체형의 영구적 변화'
    ],
    swayback: ['전신 자세 불균형 고착화'],
    flat_back: ['척추 퇴행 가속화 가능성']
  };
  return risks[postureType];
}

const COMPARISON_DATA = [
  {
    category: '정확도',
    alone: '자가 판단 (50-60%)',
    managed: '전문가 분석 (95%+)'
  },
  {
    category: '운동 선택',
    alone: '일반적인 운동',
    managed: '개인 맞춤 4단계 프로그램'
  },
  {
    category: '동작 정확도',
    alone: '스스로 판단 (불확실)',
    managed: '영상 피드백으로 실시간 교정'
  },
  {
    category: '개선 속도',
    alone: '느림 (3-6개월)',
    managed: '빠름 (1-2개월)'
  },
  {
    category: '재발 방지',
    alone: '어려움 (70% 재발)',
    managed: '체계적 관리 (20% 재발)'
  },
  {
    category: '비용',
    alone: '무료 (시간 비용 높음)',
    managed: '₩29,900~ (효율적)'
  }
];

function getRecommendedExercises(postureType: PostureType): Array<{
  name: string;
  description: string;
  frequency: string;
}> {
  const exercises: Record<PostureType, Array<{ name: string; description: string; frequency: string }>> = {
    neutral: [
      {
        name: '예방 스트레칭',
        description: '전신을 가볍게 이완하는 스트레칭',
        frequency: '매일 5분'
      },
      {
        name: '코어 강화',
        description: '플랭크와 버드독으로 코어 안정성 유지',
        frequency: '주 3회, 10분'
      },
      {
        name: '자세 체크',
        description: '거울 앞에서 자세 확인하는 습관',
        frequency: '매일 아침'
      }
    ],
    forward_head: [
      {
        name: '턱 당기기 (Chin Tuck)',
        description: '턱을 뒤로 당겨 목 뒤 근육 강화',
        frequency: '하루 3회, 10회씩'
      },
      {
        name: '목 신전근 스트레칭',
        description: '목 앞쪽을 부드럽게 늘려주는 스트레칭',
        frequency: '하루 2회, 30초씩'
      },
      {
        name: '상부 등 강화',
        description: '밴드를 이용한 로우 동작',
        frequency: '주 3회, 12회 × 3세트'
      }
    ],
    rounded_shoulder: [
      {
        name: '가슴 스트레칭',
        description: '벽이나 문틀을 이용한 대흉근 이완',
        frequency: '하루 2회, 30초씩'
      },
      {
        name: '어깨 뒤로 당기기',
        description: '견갑골을 모으는 동작 반복',
        frequency: '하루 3회, 15회씩'
      },
      {
        name: '등 중부 강화',
        description: '프론 Y-T-W 운동',
        frequency: '주 3회, 10회 × 3세트'
      }
    ],
    upper_cross_syndrome: [
      {
        name: '복합 신전 운동',
        description: '턱 당기기와 어깨 뒤로 당기기 동시 수행',
        frequency: '하루 3회, 10회씩'
      },
      {
        name: '흉추 신전',
        description: '폼롤러를 이용한 등 위쪽 이완',
        frequency: '하루 1회, 2분'
      },
      {
        name: '체계적 4단계 프로그램',
        description: '억제-신장-활성화-통합 순서로 진행',
        frequency: '주 4회, 30분 (전문가 가이드 권장)'
      }
    ],
    anterior_pelvic_tilt: [
      {
        name: '데드버그 (Dead Bug)',
        description: '누워서 복부 코어 안정화',
        frequency: '하루 2회, 10회씩'
      },
      {
        name: '고관절 굴근 스트레칭',
        description: '런지 자세로 앞 허벅지 앞쪽 이완',
        frequency: '하루 2회, 30초씩'
      },
      {
        name: '글루트 브릿지',
        description: '누워서 엉덩이 들어올리기',
        frequency: '주 3회, 15회 × 3세트'
      }
    ],
    posterior_pelvic_tilt: [
      {
        name: '고양이-소 자세',
        description: '척추를 구부렸다 펴는 동작 반복',
        frequency: '하루 2회, 10회씩'
      },
      {
        name: '햄스트링 스트레칭',
        description: '앉아서 다리 뒤쪽 늘리기',
        frequency: '하루 2회, 30초씩'
      },
      {
        name: '허리 신전',
        description: '엎드려서 상체 들어올리기 (Cobra)',
        frequency: '주 3회, 10회 × 2세트'
      }
    ],
    swayback: [
      {
        name: '전신 자세 정렬',
        description: '벽에 등을 대고 전신 정렬 연습',
        frequency: '하루 2회, 1분씩'
      },
      {
        name: '코어 안정화',
        description: '플랭크와 사이드 플랭크',
        frequency: '주 3회, 30초 × 3세트'
      },
      {
        name: '전문가 평가',
        description: '복합적 문제로 개인 맞춤 프로그램 필요',
        frequency: 'Standard 플랜 권장'
      }
    ],
    flat_back: [
      {
        name: '골반 기울이기',
        description: '누워서 골반을 앞뒤로 기울이기',
        frequency: '하루 2회, 15회씩'
      },
      {
        name: '흉추 신전',
        description: '폼롤러로 등 위쪽 이완',
        frequency: '하루 1회, 2분'
      },
      {
        name: '척추 가동성 운동',
        description: '고양이-소 자세와 변형 동작',
        frequency: '주 4회, 10회씩'
      }
    ]
  };
  
  return exercises[postureType];
}

const SEVERITY_NAMES = {
  mild: '경미한 상태',
  moderate: '보통 상태',
  severe: '개선 필요 상태'
};

const PLAN_NAMES = {
  basic: 'Basic 플랜',
  standard: 'Standard 플랜',
  premium: 'Premium 플랜'
};

// PDF 생성 함수
export async function generatePDF(
  analysis: AnalysisResult,
  userInfo: { name: string; email: string; analyzedAt: Date }
): Promise<Buffer> {
  const doc = <PostureAnalysisReport analysis={analysis} userInfo={userInfo} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer);
}
```

---

## 5. 이메일 발송 플로우

### 5.1 이메일 템플릿

```typescript
// lib/email-sender.ts

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAnalysisReport(
  userEmail: string,
  userName: string,
  pdfBuffer: Buffer,
  analysis: AnalysisResult
) {
  const emailHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>자세 분석 리포트</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <!-- 이메일 컨테이너 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- 메인 콘텐츠 박스 -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- 헤더 -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🎉 분석이 완료되었습니다!
              </h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">
                ${userName}님의 맞춤 자세 분석 리포트를 확인하세요
              </p>
            </td>
          </tr>
          
          <!-- 본문 -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- 인사말 -->
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                안녕하세요, ${userName}님!<br>
                포스처랩 자세 분석 설문에 참여해 주셔서 감사합니다.
              </p>
              
              <!-- 결과 요약 박스 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; margin: 25px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 12px; color: #92400e; font-size: 18px; font-weight: bold;">
                      📊 분석 결과 요약
                    </h2>
                    <p style="margin: 0 0 8px; color: #78350f; font-size: 14px; line-height: 1.6;">
                      <strong>체형 유형:</strong> ${POSTURE_TYPE_NAMES[analysis.postureType]}
                    </p>
                    <p style="margin: 0 0 8px; color: #78350f; font-size: 14px; line-height: 1.6;">
                      <strong>전체 상태:</strong> ${SEVERITY_NAMES[analysis.overallSeverity]}
                    </p>
                    <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                      <strong>추천 플랜:</strong> ${PLAN_NAMES[analysis.recommendedPlan]}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- 주요 발견사항 -->
              <h3 style="margin: 30px 0 15px; color: #0f172a; font-size: 18px; font-weight: bold;">
                🔍 주요 발견사항
              </h3>
              <ul style="margin: 0 0 25px; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
                ${analysis.primaryIssues.map(issue => `
                  <li style="margin-bottom: 8px;">
                    <strong>[${issue.area}]</strong> ${issue.description}
                  </li>
                `).join('')}
              </ul>
              
              <!-- PDF 첨부 안내 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 12px; margin: 25px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                      📎 <strong>상세 리포트가 첨부되어 있습니다</strong>
                    </p>
                    <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                      5페이지 분량의 맞춤 분석 리포트에는<br>
                      현재 상태, 리스크, 개선 방향, 추천 운동이 포함되어 있습니다.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA 버튼 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 12px; padding: 16px 40px;">
                          <a href="https://posturelab.com/upgrade?email=${encodeURIComponent(userEmail)}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; display: block;">
                            🚀 지금 업그레이드하고 20% 할인받기
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                리포트 발송 후 7일 내 업그레이드 시 특별 할인이 적용됩니다.
              </p>
              
            </td>
          </tr>
          
          <!-- 푸터 -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px; color: #64748b; font-size: 12px; text-align: center;">
                © 2026 포스처랩 | 자세 개선 운동 플랫폼
              </p>
              <p style="margin: 0 0 10px; color: #64748b; font-size: 12px; text-align: center;">
                <a href="https://posturelab.com/terms" style="color: #f97316; text-decoration: none;">이용약관</a> | 
                <a href="https://posturelab.com/privacy" style="color: #f97316; text-decoration: none;">개인정보처리방침</a>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-align: center; line-height: 1.6;">
                ⚠️ 본 리포트는 운동 가이드 제공을 목적으로 하며, 의료 진단이 아닙니다.<br>
                통증이나 질병이 있는 경우 반드시 의료 전문가와 상담하세요.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  
  try {
    const { data, error } = await resend.emails.send({
      from: '포스처랩 <noreply@posturelab.com>',
      to: [userEmail],
      subject: `${userName}님의 자세 분석 리포트가 도착했습니다 🎯`,
      html: emailHtml,
      attachments: [
        {
          filename: `자세분석리포트_${userName}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }
      ]
    });
    
    if (error) {
      throw new Error(`이메일 발송 실패: ${error.message}`);
    }
    
    return { success: true, emailId: data?.id };
  } catch (error) {
    console.error('이메일 발송 에러:', error);
    throw error;
  }
}
```

### 5.2 전체 플로우 통합 API

```typescript
// app/api/survey/submit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { analyzeSurveyResults } from '@/lib/survey-analyzer';
import { generatePDF } from '@/lib/pdf-generator';
import { sendAnalysisReport } from '@/lib/email-sender';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId, responses } = await req.json();
    
    const supabase = getServerSupabase();
    
    // 1. 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('*, user_profiles(*)')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // 2. 설문 결과 분석
    const analysis = analyzeSurveyResults(responses);
    
    // 3. PDF 생성
    const pdfBuffer = await generatePDF(analysis, {
      name: user.user_profiles?.full_name || user.email.split('@')[0],
      email: user.email,
      analyzedAt: new Date()
    });
    
    // 4. PDF를 Supabase Storage에 저장 (24시간 후 자동 삭제)
    const fileName = `reports/${userId}/${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`PDF 저장 실패: ${uploadError.message}`);
    }
    
    // 5. assessment 레코드 생성
    const { data: assessment } = await supabase
      .from('assessments')
      .insert({
        user_id: userId,
        assessment_type: 'initial',
        diagnoses: analysis.scores,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // 6. feedback 레코드 생성 (PDF)
    await supabase
      .from('feedbacks')
      .insert({
        assessment_id: assessment.id,
        user_id: userId,
        trainer_id: null,  // 자동 생성이므로 null
        feedback_type: 'pdf',
        pdf_url: fileName,
        notes: `자동 생성된 리포트 - ${POSTURE_TYPE_NAMES[analysis.postureType]}`
      });
    
    // 7. 이메일 발송
    await sendAnalysisReport(
      user.email,
      user.user_profiles?.full_name || user.email.split('@')[0],
      pdfBuffer,
      analysis
    );
    
    // 8. 알림 생성
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'feedback_ready',
        title: '자세 분석 리포트가 도착했습니다',
        message: `${POSTURE_TYPE_NAMES[analysis.postureType]} 유형으로 분석되었습니다. 이메일을 확인하세요.`,
        action_url: `/my-report`,
        sent_via_email: true
      });
    
    return NextResponse.json({
      success: true,
      analysis: {
        postureType: analysis.postureType,
        severity: analysis.overallSeverity,
        recommendedPlan: analysis.recommendedPlan
      },
      pdfUrl: fileName,
      message: '분석이 완료되었습니다. 이메일을 확인해주세요.'
    });
    
  } catch (error: any) {
    console.error('설문 제출 에러:', error);
    return NextResponse.json({
      error: '설문 처리 중 오류가 발생했습니다.',
      details: error.message
    }, { status: 500 });
  }
}
```

---

## 6. 구현 코드

### 6.1 프론트엔드 설문 폼

```typescript
// app/survey/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SURVEY_QUESTIONS } from '@/data/survey-questions';

export default function SurveyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentQuestion = SURVEY_QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / SURVEY_QUESTIONS.length) * 100;
  
  const handleAnswer = (value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };
  
  const handleNext = () => {
    if (currentStep < SURVEY_QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const userId = localStorage.getItem('userId'); // 또는 context에서 가져오기
      
      const response = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, responses })
      });
      
      const data = await response.json();
      
      if (data.success) {
        router.push(`/survey/result?type=${data.analysis.postureType}`);
      } else {
        alert('오류가 발생했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('제출 에러:', error);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isAnswered = !!responses[currentQuestion.id];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* 진행 바 */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-slate-400">
            <span>질문 {currentStep + 1} / {SURVEY_QUESTIONS.length}</span>
            <span>{Math.round(progress)}% 완료</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* 질문 카드 */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-sm">
          {/* 카테고리 배지 */}
          <div className="mb-4">
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">
              {currentQuestion.category === 'posture' && '자세 관찰'}
              {currentQuestion.category === 'pain' && '불편함/통증'}
              {currentQuestion.category === 'lifestyle' && '생활 습관'}
              {currentQuestion.category === 'goal' && '목표'}
            </span>
          </div>
          
          {/* 질문 */}
          <h2 className="mb-2 text-2xl font-bold text-slate-100">
            {currentQuestion.question}
          </h2>
          
          {currentQuestion.description && (
            <p className="mb-6 text-sm text-slate-400">
              {currentQuestion.description}
            </p>
          )}
          
          {/* 답변 옵션 */}
          <div className="space-y-3">
            {currentQuestion.type === 'single' || currentQuestion.type === 'scale' || currentQuestion.type === 'boolean' ? (
              // 단일 선택
              currentQuestion.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(option.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    responses[currentQuestion.id] === option.id
                      ? 'border-orange-500 bg-orange-500/10 text-slate-100'
                      : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      responses[currentQuestion.id] === option.id
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-slate-600'
                    }`}>
                      {responses[currentQuestion.id] === option.id && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </div>
                </button>
              ))
            ) : (
              // 복수 선택
              currentQuestion.options.map(option => {
                const selected = (responses[currentQuestion.id] as string[] || []).includes(option.id);
                
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      const current = (responses[currentQuestion.id] as string[]) || [];
                      if (selected) {
                        handleAnswer(current.filter(id => id !== option.id));
                      } else {
                        handleAnswer([...current, option.id]);
                      }
                    }}
                    className={`w-full rounded-xl border-2 p-4 text-left transition ${
                      selected
                        ? 'border-orange-500 bg-orange-500/10 text-slate-100'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                        selected
                          ? 'border-orange-500 bg-orange-500'
                          : 'border-slate-600'
                      }`}>
                        {selected && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1">{option.label}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          
          {/* 버튼 */}
          <div className="mt-8 flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="rounded-full border-2 border-slate-700 px-6 py-3 font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900/50"
              >
                ← 이전
              </button>
            )}
            
            <button
              onClick={handleNext}
              disabled={!isAnswered || isSubmitting}
              className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  분석 중...
                </span>
              ) : currentStep === SURVEY_QUESTIONS.length - 1 ? (
                '결과 확인 →'
              ) : (
                '다음 →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. 배포 및 모니터링

### 7.1 환경 변수 설정

```.env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 이메일 (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# PDF 생성
# (추가 설정 불필요 - @react-pdf/renderer 사용)

# Base URL
NEXT_PUBLIC_BASE_URL=https://posturelab.com
```

### 7.2 Vercel 설정

```json
// vercel.json
{
  "functions": {
    "app/api/survey/submit/route.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup-pdfs",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## 📊 예상 성능

| 지표 | 목표 | 실제 예상 |
|------|------|----------|
| 설문 완료율 | 70%+ | 75-80% |
| PDF 생성 시간 | <5초 | 2-4초 |
| 이메일 발송 시간 | <10초 | 5-8초 |
| 전체 처리 시간 | <15초 | 10-12초 |
| PDF 파일 크기 | <3MB | 1-2MB |

---

## 🎯 다음 단계

1. **MVP 구현** (1주)
   - 설문 폼 UI
   - 분석 로직
   - PDF 생성 (기본 템플릿)

2. **테스트 및 개선** (1주)
   - 실제 사용자 테스트
   - PDF 디자인 개선
   - 이메일 템플릿 최적화

3. **운영 모니터링** (지속)
   - 전환율 추적
   - 사용자 피드백 수집
   - A/B 테스트

---

**작성 완료!** 🎉

