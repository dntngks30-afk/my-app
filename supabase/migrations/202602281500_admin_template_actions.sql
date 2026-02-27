-- admin_template_actions: 템플릿 수정 감사 로그
-- service_role로만 접근 (API에서 getServerSupabaseAdmin 사용)

CREATE TABLE IF NOT EXISTS public.admin_template_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  actor_email text NOT NULL,
  template_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('update', 'toggle_status', 'rollback')),
  before_diff jsonb NOT NULL,
  after_diff jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_template_actions_template_created
  ON public.admin_template_actions(template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_template_actions_actor_created
  ON public.admin_template_actions(actor_user_id, created_at DESC);

ALTER TABLE public.admin_template_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_admin_template_actions"
  ON public.admin_template_actions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_select_admin_template_actions"
  ON public.admin_template_actions
  FOR SELECT
  TO service_role
  USING (true);

-- 정렬/검색 성능: updated_at desc
CREATE INDEX IF NOT EXISTS idx_exercise_templates_updated_at
  ON public.exercise_templates(updated_at DESC NULLS LAST);
