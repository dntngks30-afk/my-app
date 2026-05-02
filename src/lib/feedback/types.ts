export type FeedbackCategory = 'general' | 'bug' | 'question' | 'improvement';

export type FeedbackStatus = 'new' | 'reviewing' | 'resolved' | 'archived';

export type FeedbackReportRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  source: string;
  user_agent: string | null;
  referer: string | null;
  created_at: string;
  resolved_at: string | null;
  admin_note: string | null;
};

/** GET /api/admin/feedback 응답의 summary는 타입 설명용이며, 실제 집계 범위는 `buildAdminFeedbackPageSummary` 주석과 동일하게 현재 페이지(items) 기준이다. */
export type AdminFeedbackSummary = {
  total: number;
  new_count: number;
  reviewing_count: number;
  resolved_count: number;
  archived_count: number;
  bug_count: number;
  question_count: number;
  improvement_count: number;
  general_count: number;
};

export type AdminFeedbackResponse = {
  ok: true;
  items: FeedbackReportRow[];
  summary: AdminFeedbackSummary;
};
