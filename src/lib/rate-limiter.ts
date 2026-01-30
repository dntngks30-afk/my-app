/**
 * 비용 방어 로직 - 무료 사용자 제한
 * 
 * 목적:
 * - 무료 분석 남용 방지
 * - API 비용 통제
 * - 전환율 확보
 */

// 환경 변수에서 설정 가져오기
const MAX_FREE_ANALYSES_PER_DAY = parseInt(process.env.MAX_FREE_ANALYSES_PER_DAY || '50', 10);
const MAX_FREE_ANALYSES_PER_USER = parseInt(process.env.MAX_FREE_ANALYSES_PER_USER || '1', 10);

// 메모리 기반 간단한 저장소 (프로덕션에서는 Redis 권장)
interface RateLimitEntry {
  count: number;
  lastReset: number;
}

const dailyUsage: Map<string, RateLimitEntry> = new Map();
const userUsage: Map<string, RateLimitEntry> = new Map();

/**
 * 하루가 지났는지 확인
 */
function isNewDay(lastReset: number): boolean {
  const now = new Date();
  const last = new Date(lastReset);
  return now.toDateString() !== last.toDateString();
}

/**
 * 일일 전체 무료 분석 제한 확인
 */
export function checkDailyLimit(): { allowed: boolean; remaining: number; message?: string } {
  const today = new Date().toDateString();
  const entry = dailyUsage.get(today);

  if (!entry || isNewDay(entry.lastReset)) {
    dailyUsage.set(today, { count: 0, lastReset: Date.now() });
    return { allowed: true, remaining: MAX_FREE_ANALYSES_PER_DAY };
  }

  if (entry.count >= MAX_FREE_ANALYSES_PER_DAY) {
    return {
      allowed: false,
      remaining: 0,
      message: '오늘의 무료 분석 한도가 초과되었습니다. 내일 다시 시도하거나 유료 플랜을 이용해주세요.',
    };
  }

  return { allowed: true, remaining: MAX_FREE_ANALYSES_PER_DAY - entry.count };
}

/**
 * 일일 전체 사용량 증가
 */
export function incrementDailyUsage(): void {
  const today = new Date().toDateString();
  const entry = dailyUsage.get(today);

  if (!entry || isNewDay(entry.lastReset)) {
    dailyUsage.set(today, { count: 1, lastReset: Date.now() });
  } else {
    entry.count++;
  }
}

/**
 * 사용자별 무료 분석 제한 확인 (이메일 + IP 기반)
 */
export function checkUserLimit(identifier: string): { 
  allowed: boolean; 
  remaining: number; 
  message?: string;
} {
  const entry = userUsage.get(identifier);

  if (!entry || isNewDay(entry.lastReset)) {
    userUsage.set(identifier, { count: 0, lastReset: Date.now() });
    return { allowed: true, remaining: MAX_FREE_ANALYSES_PER_USER };
  }

  if (entry.count >= MAX_FREE_ANALYSES_PER_USER) {
    return {
      allowed: false,
      remaining: 0,
      message: '무료 분석은 1회만 가능합니다. 더 정확한 분석을 원하시면 BASIC 플랜을 이용해주세요.',
    };
  }

  return { allowed: true, remaining: MAX_FREE_ANALYSES_PER_USER - entry.count };
}

/**
 * 사용자 사용량 증가
 */
export function incrementUserUsage(identifier: string): void {
  const entry = userUsage.get(identifier);

  if (!entry || isNewDay(entry.lastReset)) {
    userUsage.set(identifier, { count: 1, lastReset: Date.now() });
  } else {
    entry.count++;
  }
}

/**
 * 복합 식별자 생성 (이메일 + IP)
 */
export function createUserIdentifier(email?: string, ip?: string): string {
  const parts: string[] = [];
  if (email) parts.push(`email:${email.toLowerCase()}`);
  if (ip) parts.push(`ip:${ip}`);
  return parts.join('|') || 'anonymous';
}

/**
 * 무료 분석 가능 여부 종합 체크
 */
export function canPerformFreeAnalysis(email?: string, ip?: string): {
  allowed: boolean;
  reason?: string;
  upgradeRequired: boolean;
} {
  // 1. 일일 전체 한도 체크
  const dailyCheck = checkDailyLimit();
  if (!dailyCheck.allowed) {
    return {
      allowed: false,
      reason: dailyCheck.message,
      upgradeRequired: true,
    };
  }

  // 2. 사용자별 한도 체크
  const identifier = createUserIdentifier(email, ip);
  const userCheck = checkUserLimit(identifier);
  if (!userCheck.allowed) {
    return {
      allowed: false,
      reason: userCheck.message,
      upgradeRequired: true,
    };
  }

  return { allowed: true, upgradeRequired: false };
}

/**
 * 무료 분석 사용 기록
 */
export function recordFreeAnalysis(email?: string, ip?: string): void {
  incrementDailyUsage();
  const identifier = createUserIdentifier(email, ip);
  incrementUserUsage(identifier);
}

/**
 * Vision API 방어 로직
 */
export interface AnalysisGuard {
  shouldProceed: boolean;
  reason?: string;
  fallbackAction?: 'skip' | 'retry_later' | 'upgrade';
}

/**
 * 분석 불가 판정 시 즉시 종료
 */
export function checkAnalysisViability(
  photoQualityPassed: boolean,
  hasRequiredPhotos: boolean,
  previousAttempts: number = 0
): AnalysisGuard {
  // 사진 품질 불량 → 즉시 종료
  if (!photoQualityPassed) {
    return {
      shouldProceed: false,
      reason: '사진 품질이 분석 기준에 미달합니다.',
      fallbackAction: 'skip',
    };
  }

  // 필수 사진 없음 → 즉시 종료
  if (!hasRequiredPhotos) {
    return {
      shouldProceed: false,
      reason: '분석에 필요한 사진이 없습니다.',
      fallbackAction: 'skip',
    };
  }

  // 재시도 방지 (최대 1회)
  if (previousAttempts >= 1) {
    return {
      shouldProceed: false,
      reason: '분석 재시도 한도를 초과했습니다.',
      fallbackAction: 'upgrade',
    };
  }

  return { shouldProceed: true };
}

/**
 * 무료 재촬영 방지
 */
export function canRetakePhoto(isPaidUser: boolean, retakeCount: number): {
  allowed: boolean;
  message?: string;
} {
  // 유료 사용자는 무제한
  if (isPaidUser) {
    return { allowed: true };
  }

  // 무료 사용자는 재촬영 불가
  if (retakeCount > 0) {
    return {
      allowed: false,
      message: '무료 사용자는 재촬영이 불가합니다. BASIC 플랜으로 업그레이드하세요.',
    };
  }

  return { allowed: true };
}

export default {
  checkDailyLimit,
  checkUserLimit,
  canPerformFreeAnalysis,
  recordFreeAnalysis,
  checkAnalysisViability,
  canRetakePhoto,
};
