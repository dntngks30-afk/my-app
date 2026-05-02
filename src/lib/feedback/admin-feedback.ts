import type { AdminFeedbackSummary, FeedbackReportRow } from './types';

/** Current page summary only: counts reflect the paginated `items` returned by GET (limit slice), not totals across all matching rows in the filtered date/status/category range. */
export function buildAdminFeedbackPageSummary(items: FeedbackReportRow[]): AdminFeedbackSummary {
  const summary: AdminFeedbackSummary = {
    total: items.length,
    new_count: 0,
    reviewing_count: 0,
    resolved_count: 0,
    archived_count: 0,
    bug_count: 0,
    question_count: 0,
    improvement_count: 0,
    general_count: 0,
  };

  for (const row of items) {
    if (row.status === 'new') summary.new_count += 1;
    else if (row.status === 'reviewing') summary.reviewing_count += 1;
    else if (row.status === 'resolved') summary.resolved_count += 1;
    else if (row.status === 'archived') summary.archived_count += 1;

    if (row.category === 'bug') summary.bug_count += 1;
    else if (row.category === 'question') summary.question_count += 1;
    else if (row.category === 'improvement') summary.improvement_count += 1;
    else summary.general_count += 1;
  }

  return summary;
}
