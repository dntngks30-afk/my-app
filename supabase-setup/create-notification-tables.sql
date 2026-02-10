-- ================================================
-- Notification System 테이블 생성
-- ================================================
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- ================================================
-- 1. user_notification_preferences 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 일일 운동 루틴 알림 설정
  daily_workout_enabled BOOLEAN DEFAULT TRUE,
  daily_workout_time TIME DEFAULT '09:00:00', -- 기본 오전 9시
  daily_workout_timezone VARCHAR(50) DEFAULT 'Asia/Seoul',
  
  -- 알림 채널 설정
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT FALSE,
  push_token TEXT, -- 푸시 구독 정보 (JSON)
  sms_enabled BOOLEAN DEFAULT FALSE,
  
  -- 알림 타입별 설정
  workout_reminder_enabled BOOLEAN DEFAULT TRUE,
  retest_reminder_enabled BOOLEAN DEFAULT TRUE,
  coach_comment_enabled BOOLEAN DEFAULT TRUE,
  payment_success_enabled BOOLEAN DEFAULT TRUE,
  subscription_renewal_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON public.user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_daily_workout_enabled ON public.user_notification_preferences(daily_workout_enabled);

-- RLS 활성화
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 알림 설정만 조회/수정 가능
CREATE POLICY "Users can read own notification preferences"
  ON public.user_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.user_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.user_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ================================================
-- 2. notifications 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 알림 정보
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'daily_workout',
    'workout_reminder',
    'retest_reminder',
    'coach_comment',
    'payment_success',
    'subscription_renewal',
    'feedback_ready',
    'schedule_reminder',
    'routine_completed',
    'routine_started'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- 관련 리소스 참조 (선택적)
  routine_id UUID REFERENCES public.workout_routines(id) ON DELETE SET NULL,
  routine_day_id UUID REFERENCES public.workout_routine_days(id) ON DELETE SET NULL,
  test_result_id UUID REFERENCES public.movement_test_results(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES public.coach_comments(id) ON DELETE SET NULL,
  
  -- 링크
  action_url TEXT,
  
  -- 상태
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- 발송 채널 및 상태
  sent_via_email BOOLEAN DEFAULT FALSE,
  sent_via_push BOOLEAN DEFAULT FALSE,
  sent_via_sms BOOLEAN DEFAULT FALSE,
  
  -- 발송 시간 추적
  scheduled_for TIMESTAMPTZ, -- 예약 발송 시간
  sent_at TIMESTAMPTZ, -- 실제 발송 시간
  
  -- 에러 추적
  send_error TEXT, -- 발송 실패 시 에러 메시지
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON public.notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON public.notifications(sent_at) WHERE sent_at IS NULL;

-- RLS 활성화
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 알림 읽음 상태만 업데이트 가능
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 정책: 시스템(서버)은 알림 생성 가능 (서비스 역할 사용)
-- 주의: 실제 구현 시 서비스 역할 키를 사용하여 알림 생성

-- ================================================
-- 3. updated_at 자동 업데이트 트리거
-- ================================================

-- user_notification_preferences updated_at 트리거
DROP TRIGGER IF EXISTS update_user_notification_preferences_updated_at ON public.user_notification_preferences;
CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 4. 알림 읽음 처리 함수 (선택적)
-- ================================================

CREATE OR REPLACE FUNCTION mark_notification_as_read(notification_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  notification_user_id UUID;
BEGIN
  -- 알림 소유자 확인
  SELECT user_id INTO notification_user_id
  FROM public.notifications
  WHERE id = notification_id;
  
  -- 알림이 존재하지 않거나 현재 사용자의 것이 아니면 false 반환
  IF notification_user_id IS NULL OR notification_user_id != auth.uid() THEN
    RETURN FALSE;
  END IF;
  
  -- 읽음 처리
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = notification_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 5. 일일 운동 루틴 알림 대상 조회 함수 (선택적)
-- ================================================

CREATE OR REPLACE FUNCTION get_daily_workout_notification_targets(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  user_id UUID,
  routine_id UUID,
  day_number INTEGER,
  notification_time TIME,
  timezone VARCHAR(50),
  email_enabled BOOLEAN,
  push_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    wr.user_id,
    wr.id AS routine_id,
    wrd.day_number,
    unp.daily_workout_time AS notification_time,
    unp.daily_workout_timezone,
    unp.email_enabled,
    unp.push_enabled
  FROM public.workout_routines wr
  INNER JOIN public.workout_routine_days wrd ON wr.id = wrd.routine_id
  INNER JOIN public.user_notification_preferences unp ON wr.user_id = unp.user_id
  WHERE wr.status = 'active'
    AND unp.daily_workout_enabled = TRUE
    AND wrd.completed_at IS NULL
    AND DATE(wr.started_at + (wrd.day_number - 1) * INTERVAL '1 day') = target_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 완료 확인
-- ================================================

SELECT 
  'Notification tables created successfully!' as message,
  (SELECT COUNT(*) FROM public.user_notification_preferences) as preferences_count,
  (SELECT COUNT(*) FROM public.notifications) as notifications_count;
