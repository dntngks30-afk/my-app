// 설문 관련 타입 정의

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
  image?: string;
}

export interface QuestionScoring {
  dimension: 'forward_head' | 'rounded_shoulder' | 'anterior_pelvic_tilt' | 'posterior_pelvic_tilt';
  weight: number;
  mapping: Record<string, number>;
}

export interface SurveyResponse {
  userId: string;
  responses: Record<string, string | string[]>;
  completedAt: Date;
}

export interface PostureScores {
  forwardHead: number;
  roundedShoulder: number;
  anteriorPelvicTilt: number;
  posteriorPelvicTilt: number;
}

export type PostureType = 
  | 'forward_head'
  | 'rounded_shoulder'
  | 'upper_cross_syndrome'
  | 'anterior_pelvic_tilt'
  | 'posterior_pelvic_tilt'
  | 'swayback'
  | 'flat_back'
  | 'neutral';

export interface PrimaryIssue {
  area: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
}

export interface AnalysisResult {
  postureType: PostureType;
  overallSeverity: 'mild' | 'moderate' | 'severe';
  scores: PostureScores;
  primaryIssues: PrimaryIssue[];
  recommendations: string[];
  recommendedPlan: 'basic' | 'standard' | 'premium';
  userGoal: string;
  timeCommitment: string;
}
