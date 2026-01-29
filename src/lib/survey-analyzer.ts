import { SURVEY_QUESTIONS } from '@/data/survey-questions';
import type { AnalysisResult, PostureScores, PostureType, PrimaryIssue } from '@/types/survey';

// 자가 체크 결과 정리 함수 (판단/진단 아님)
export function analyzeSurveyResults(
  responses: Record<string, string | string[]>
): AnalysisResult {
  // 1. 각 차원별 경향성 계산 (참고용)
  const scores = calculateDimensionScores(responses);
  
  // 2. 자가 체크 기반 체형 경향 파악
  const postureType = determinePostureType(scores);
  
  // 3. 전체 경향성 수준 (참고 정보)
  const overallSeverity = calculateOverallSeverity(scores);
  
  // 4. 사용자가 체크한 주요 경향 정리
  const primaryIssues = identifyPrimaryIssues(scores);
  
  // 5. 참고 가이드 제안
  const recommendations = generateRecommendations(postureType, scores, responses);
  
  // 6. 참고용 플랜 제안
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

// 자가 체크 기반 체형 경향 파악 (판단 아님, 참고용)
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

// 전체 경향성 수준 (참고 정보, 의학적 평가 아님)
function calculateOverallSeverity(scores: PostureScores): 'mild' | 'moderate' | 'severe' {
  const values = Object.values(scores);
  const maxScore = Math.max(...values);
  const avgScore = values.reduce((a, b) => a + b, 0) / values.length;
  
  if (avgScore >= 60 || maxScore >= 80) return 'severe';
  if (avgScore >= 40 || maxScore >= 60) return 'moderate';
  return 'mild';
}

// 사용자가 체크한 주요 경향 정리 (의학적 진단 아님)
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

// 자가 체크 기반 경향성 설명 (확정적 진단 아님, 참고용)
const ISSUE_DESCRIPTIONS = {
  forward_head: {
    mild: '자가 체크 결과, 고개가 약간 앞으로 나올 수 있는 경향이 보입니다. 목 주변 근육의 균형 운동을 참고하세요.',
    moderate: '자가 체크 결과, 고개가 앞으로 나올 가능성이 있습니다. 목과 어깨 주변 스트레칭을 고려해보세요.',
    severe: '자가 체크 결과, 고개가 앞으로 나온 경향이 강하게 나타납니다. 전문가 상담을 권장합니다.'
  },
  rounded_shoulder: {
    mild: '자가 체크 결과, 어깨가 약간 앞으로 말릴 수 있는 경향이 보입니다. 가슴 스트레칭을 참고하세요.',
    moderate: '자가 체크 결과, 어깨가 앞으로 말릴 가능성이 있습니다. 등 근육 강화를 고려해보세요.',
    severe: '자가 체크 결과, 어깨가 앞으로 말린 경향이 강하게 나타납니다. 전문가 상담을 권장합니다.'
  },
  anterior_pelvic_tilt: {
    mild: '자가 체크 결과, 골반이 약간 앞으로 기울 수 있는 경향이 보입니다. 코어 운동을 참고하세요.',
    moderate: '자가 체크 결과, 골반이 앞으로 기울 가능성이 있습니다. 복부 강화를 고려해보세요.',
    severe: '자가 체크 결과, 골반이 앞으로 기운 경향이 강하게 나타납니다. 전문가 상담을 권장합니다.'
  },
  posterior_pelvic_tilt: {
    mild: '자가 체크 결과, 골반이 약간 뒤로 기울 수 있는 경향이 보입니다. 허리 신전 운동을 참고하세요.',
    moderate: '자가 체크 결과, 골반이 뒤로 기울 가능성이 있습니다. 척추 가동성 운동을 고려해보세요.',
    severe: '자가 체크 결과, 골반이 뒤로 기운 경향이 강하게 나타납니다. 전문가 상담을 권장합니다.'
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

// 자가 체크 기반 체형 경향 이름 (확정적 진단명 아님)
export const POSTURE_TYPE_NAMES: Record<PostureType, string> = {
  neutral: '균형 잡힌 자세 경향',
  forward_head: '고개 앞으로 나올 수 있는 경향',
  rounded_shoulder: '어깨 앞으로 말릴 수 있는 경향',
  upper_cross_syndrome: '상체 전반적 균형 체크 필요',
  anterior_pelvic_tilt: '골반 앞으로 기울 수 있는 경향',
  posterior_pelvic_tilt: '골반 뒤로 기울 수 있는 경향',
  swayback: '전신 자세 체크 필요',
  flat_back: '허리 곡선 체크 필요'
};
