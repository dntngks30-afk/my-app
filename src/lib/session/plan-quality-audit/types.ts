/**
 * PR-ALG-19: Plan Quality Audit — types.
 */

export type AuditSeverity = 'info' | 'warn' | 'high';

export type AuditBand = 'good' | 'acceptable' | 'risky';

export interface AuditIssue {
  code: string;
  severity: AuditSeverity;
  message: string;
}

export interface PlanQualityAuditMeta {
  version: 'plan_quality_audit_v1';
  score: number;
  band: AuditBand;
  strengths: string[];
  issues: AuditIssue[];
  summary: string;
}

export interface AuditContext {
  sessionNumber: number;
  isFirstSession: boolean;
  painMode?: 'none' | 'caution' | 'protected' | null;
  priorityVector?: Record<string, number> | null;
  timeBudget?: 'short' | 'normal';
  conditionMood?: 'good' | 'ok' | 'bad';
  resultType?: string | null;
  primaryType?: string | null;
  secondaryType?: string | null;
  safetyMode?: 'red' | 'yellow' | 'none' | null;
  redFlags?: boolean | null;
}
