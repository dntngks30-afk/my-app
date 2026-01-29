import { SURVEY_QUESTIONS } from '@/data/survey-questions';
import type { AnalysisResult, PostureScores, PostureType, PrimaryIssue } from '@/types/survey';

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
  const primaryIssues = identifyPrimaryIssues(scores);
  
  // 5. 맞춤 권장사항 생성
  const recommendations = generateRecommendations(postureType, scores, responses);
  
  // 6. 추천 플랜 결정
  const recommendedPlan = determineRecommendedPlan(overallSeverity, responses);
  
  // 7. 사용자 목표 추출
  const userGoal = responses['q14'] as string || 'posture';
  const timeCommitment = responses['q15'] as string || 'moderate';
  
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
  
  SURVEY_QUESTIONS.forEach(question => {
    const response = responses[question.id];
    if (!response) return;
    
    const { dimension, weight, mapping } = question.scoring;
    
    if (question.type === 'multiple') {
      const selections = response as string[];
      const totalScore = selections.reduce((sum, selection) => {
        return sum + (mapping[selection] || 0);
      }, 0);
      dimensionScores[dimension].push(totalScore * weight);
    } else {
      const score = mapping[response as string] || 0;
      dimensionScores[dimension].push(score * weight);
    }
  });
  
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
  return Math.min(100, Math.max(0, avg));
}

// 체형 유형 판단
function determinePostureType(scores: PostureScores): PostureType {
  const { forwardHead, roundedShoulder, anteriorPelvicTilt, posteriorPelvicTilt } = scores;
  
  if (Math.max(forwardHead, roundedShoulder, anteriorPelvicTilt, posteriorPelvicTilt) < 30) {
    return 'neutral';
  }
  
  if (forwardHead >= 50 && roundedShoulder >= 50) {
    return 'upper_cross_syndrome';
  }
  
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
  
  if (avgScore >= 60 || maxScore >= 80) return 'severe';
  if (avgScore >= 40 || maxScore >= 60) return 'moderate';
  return 'mild';
}

// 주요 문제점 식별
function identifyPrimaryIssues(scores: PostureScores): PrimaryIssue[] {
  const issues: Array<{ area: string; score: number; severity: 'mild' | 'moderate' | 'severe'; description: string }> = [];
  
  if (scores.forwardHead >= 30) {
    issues.push({
      area: '목/경추',
      score: scores.forwardHead,
      severity: getSeverityLevel(scores.forwardHead),
      description: ISSUE_DESCRIPTIONS.forward_head[getSeverityLevel(scores.forwardHead)]
    });
  }
  
  if (scores.roundedShoulder >= 30) {
    issues.push({
      area: '어깨/흉추',
      score: scores.roundedShoulder,
      severity: getSeverityLevel(scores.roundedShoulder),
      description: ISSUE_DESCRIPTIONS.rounded_shoulder[getSeverityLevel(scores.roundedShoulder)]
    });
  }
  
  if (scores.anteriorPelvicTilt >= 30) {
    issues.push({
      area: '골반/허리',
      score: scores.anteriorPelvicTilt,
      severity: getSeverityLevel(scores.anteriorPelvicTilt),
      description: ISSUE_DESCRIPTIONS.anterior_pelvic_tilt[getSeverityLevel(scores.anteriorPelvicTilt)]
    });
  }
  
  if (scores.posteriorPelvicTilt >= 30) {
    issues.push({
      area: '골반/허리',
      score: scores.posteriorPelvicTilt,
      severity: getSeverityLevel(scores.posteriorPelvicTilt),
      description: ISSUE_DESCRIPTIONS.posterior_pelvic_tilt[getSeverityLevel(scores.posteriorPelvicTilt)]
    });
  }
  
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
  
  const baseRecommendations = POSTURE_TYPE_RECOMMENDATIONS[postureType];
  recommendations.push(...baseRecommendations);
  
  const sittingTime = responses['q11'];
  if (sittingTime === 'long' || sittingTime === 'very_long') {
    recommendations.push('장시간 앉아있는 경우가 많으니, 50분마다 5분씩 일어나서 스트레칭하는 습관을 들이세요.');
  }
  
  const workEnvironment = responses['q12'];
  if (workEnvironment === 'laptop' || workEnvironment === 'mobile') {
    recommendations.push('노트북이나 스마트폰 사용 시 화면을 눈높이까지 올려서 사용하세요.');
  }
  
  const exercise = responses['q13'];
  if (exercise === 'rarely' || exercise === 'never') {
    recommendations.push('주 2-3회, 20-30분 정도의 가벼운 운동부터 시작하세요.');
  }
  
  return recommendations.slice(0, 5);
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
  if (severity === 'severe') {
    return 'premium';
  }
  
  if (severity === 'moderate') {
    return 'standard';
  }
  
  const timeCommitment = responses['q15'];
  if (timeCommitment === 'dedicated') {
    return 'standard';
  }
  
  return 'basic';
}

// 체형 유형 이름 (한글)
export const POSTURE_TYPE_NAMES: Record<PostureType, string> = {
  neutral: '양호한 자세',
  forward_head: '거북목형 자세',
  rounded_shoulder: '라운드숄더형 자세',
  upper_cross_syndrome: '상부 교차 증후군',
  anterior_pelvic_tilt: '골반 전방 경사형',
  posterior_pelvic_tilt: '골반 후방 경사형',
  swayback: '요추 만곡형',
  flat_back: '평평한 등형'
};
