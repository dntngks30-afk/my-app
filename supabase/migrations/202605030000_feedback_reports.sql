-- PR-FEEDBACK-DB-DASHBOARD-01: pilot feedback store (service-role API only; no client direct access).

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  user_email text null,
  category text not null default 'general',
  message text not null,
  status text not null default 'new',
  source text not null default 'journey_feedback',
  user_agent text null,
  referer text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  admin_note text null,
  constraint feedback_reports_category_check
    check (category in ('general', 'bug', 'question', 'improvement')),
  constraint feedback_reports_status_check
    check (status in ('new', 'reviewing', 'resolved', 'archived')),
  constraint feedback_reports_message_len_check
    check (char_length(message) >= 5 and char_length(message) <= 2000)
);

create index if not exists feedback_reports_created_at_idx
  on public.feedback_reports(created_at desc);

create index if not exists feedback_reports_status_idx
  on public.feedback_reports(status);

create index if not exists feedback_reports_category_idx
  on public.feedback_reports(category);

create index if not exists feedback_reports_user_id_idx
  on public.feedback_reports(user_id)
  where user_id is not null;

alter table public.feedback_reports enable row level security;

comment on table public.feedback_reports is
  'In-app feedback: persisted for pilot ops. Inserts/selects/updates via server service role only; no public anon/authenticated policies.';
