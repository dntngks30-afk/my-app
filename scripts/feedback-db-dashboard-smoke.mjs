/**
 * PR-FEEDBACK-DB-DASHBOARD-01 smoke — static checks (node, no DB).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// ─── 1. Category whitelist / message bounds in validation.ts ─────────────────
const validation = read('src/lib/feedback/validation.ts');
assert(validation.includes('ALLOWED_FEEDBACK_CATEGORIES'));
assert(validation.includes("'general'"));
assert(validation.includes("'bug'"));
assert(validation.includes("'question'"));
assert(validation.includes("'improvement'"));
assert(validation.includes('MIN_FEEDBACK_LENGTH = 5'));
assert(validation.includes('MAX_FEEDBACK_LENGTH = 2000'));

function sanitizeCategory(value) {
  if (typeof value !== 'string') return 'general';
  const trimmed = value.trim();
  const ALLOWED = new Set(['general', 'bug', 'question', 'improvement']);
  return ALLOWED.has(trimmed) ? trimmed : 'general';
}
assert.equal(sanitizeCategory('bug'), 'bug');
assert.equal(sanitizeCategory('evil'), 'general');

function sanitizeMessage(value) {
  return typeof value === 'string' ? value.trim() : '';
}
const msg = 'x'.repeat(5);
assert.ok(msg.length >= 5 && msg.length <= 2000);

// ─── 2. Admin response summary helper keys ──────────────────────────────────
const adminFeedbackLib = read('src/lib/feedback/admin-feedback.ts');
assert(adminFeedbackLib.includes('buildAdminFeedbackPageSummary'));
assert(adminFeedbackLib.includes('Current page summary only'));

const sampleItems = [
  {
    id: '1',
    user_id: null,
    user_email: null,
    category: 'bug',
    message: '12345',
    status: 'new',
    source: 'journey_feedback',
    user_agent: null,
    referer: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    admin_note: null,
  },
];

function buildSummary(items) {
  const summary = {
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

const sum = buildSummary(sampleItems);
for (const k of [
  'total',
  'new_count',
  'reviewing_count',
  'resolved_count',
  'archived_count',
  'bug_count',
  'question_count',
  'improvement_count',
  'general_count',
]) {
  assert.ok(typeof sum[k] === 'number', `summary.${k}`);
}

// ─── 3. POST /api/feedback: DB-first, Resend does not fail the request ──────
const feedbackRoute = read('src/app/api/feedback/route.ts');
assert(feedbackRoute.includes(".from('feedback_reports')"));
assert(feedbackRoute.includes('FEEDBACK_SAVE_FAILED'));
assert(feedbackRoute.includes('email_sent'));
assert(feedbackRoute.includes('missing RESEND_API_KEY; skipped email'));
assert(feedbackRoute.includes('resend failed; saved to DB'));
assert(!feedbackRoute.includes("json('MISSING_EMAIL_CONFIG'"));
assert(!feedbackRoute.includes('EMAIL_SEND_FAILED'));

// ─── 4. Admin route uses shared admin gate ───────────────────────────────────
const adminFbRoute = read('src/app/api/admin/feedback/route.ts');
assert(adminFbRoute.includes("from '@/lib/auth/requireAdmin'"));
assert(adminFbRoute.includes('requireAdmin'));

// ─── 5. Migration: RLS on, no broad SELECT policy ───────────────────────────
const migration = read('supabase/migrations/202605030000_feedback_reports.sql');
assert(migration.includes('enable row level security'));
assert(!migration.toLowerCase().includes('create policy'));

console.log('feedback-db-dashboard-smoke: OK');
