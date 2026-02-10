-- ================================================
-- Workout Routine & Retest 관련 테이블 생성
-- ================================================
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- ================================================
-- 1. movement_test_results 테이블 확장
-- ================================================

-- user_id 컬럼 추가 (nullable, 기존 익명 데이터 호환)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'movement_test_results' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.movement_test_results 
    ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- is_retest 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'movement_test_results' 
    AND column_name = 'is_retest'
  ) THEN
    ALTER TABLE public.movement_test_results 
    ADD COLUMN is_retest BOOLEAN DEFAULT FALSE;
  END IF;

  -- original_test_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'movement_test_results' 
    AND column_name = 'original_test_id'
  ) THEN
    ALTER TABLE public.movement_test_results 
    ADD COLUMN original_test_id UUID REFERENCES public.movement_test_results(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_movement_test_results_user_id ON public.movement_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_movement_test_results_is_retest ON public.movement_test_results(is_retest);
CREATE INDEX IF NOT EXISTS idx_movement_test_results_original_test_id ON public.movement_test_results(original_test_id);

-- RLS 정책 업데이트: 사용자는 자신의 테스트 결과를 조회/수정 가능
DROP POLICY IF EXISTS "Users can read own test results" ON public.movement_test_results;
CREATE POLICY "Users can read own test results"
  ON public.movement_test_results
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own test results" ON public.movement_test_results;
CREATE POLICY "Users can update own test results"
  ON public.movement_test_results
  FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own test results" ON public.movement_test_results;
CREATE POLICY "Users can insert own test results"
  ON public.movement_test_results
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ================================================
-- 2. workout_routines 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.workout_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  movement_test_result_id UUID REFERENCES public.movement_test_results(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id ON public.workout_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_routines_status ON public.workout_routines(status);
CREATE INDEX IF NOT EXISTS idx_workout_routines_movement_test_result_id ON public.workout_routines(movement_test_result_id);

-- RLS 활성화
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can read own routines"
  ON public.workout_routines
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routines"
  ON public.workout_routines
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines"
  ON public.workout_routines
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ================================================
-- 3. workout_routine_days 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.workout_routine_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.workout_routines(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 7),
  exercises JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_workout_routine_days_routine_id ON public.workout_routine_days(routine_id);
CREATE INDEX IF NOT EXISTS idx_workout_routine_days_day_number ON public.workout_routine_days(day_number);

-- RLS 활성화
ALTER TABLE public.workout_routine_days ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 루틴 소유자만 접근 가능
CREATE POLICY "Users can read own routine days"
  ON public.workout_routine_days
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_routines
      WHERE id = routine_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own routine days"
  ON public.workout_routine_days
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_routines
      WHERE id = routine_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own routine days"
  ON public.workout_routine_days
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_routines
      WHERE id = routine_id AND user_id = auth.uid()
    )
  );

-- ================================================
-- 4. coach_comments 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.coach_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES public.workout_routines(id) ON DELETE SET NULL,
  test_result_id UUID REFERENCES public.movement_test_results(id) ON DELETE SET NULL,
  comment_text TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  reviewed_by_trainer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_comments_user_id ON public.coach_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_comments_routine_id ON public.coach_comments(routine_id);
CREATE INDEX IF NOT EXISTS idx_coach_comments_test_result_id ON public.coach_comments(test_result_id);

-- RLS 활성화
ALTER TABLE public.coach_comments ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 코멘트만 조회 가능
CREATE POLICY "Users can read own comments"
  ON public.coach_comments
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 트레이너/관리자는 코멘트 생성/수정 가능
CREATE POLICY "Trainers can manage comments"
  ON public.coach_comments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('trainer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('trainer', 'admin')
    )
  );

-- ================================================
-- 5. updated_at 자동 업데이트 트리거
-- ================================================

-- workout_routines updated_at 트리거
DROP TRIGGER IF EXISTS update_workout_routines_updated_at ON public.workout_routines;
CREATE TRIGGER update_workout_routines_updated_at
  BEFORE UPDATE ON public.workout_routines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- workout_routine_days updated_at 트리거
DROP TRIGGER IF EXISTS update_workout_routine_days_updated_at ON public.workout_routine_days;
CREATE TRIGGER update_workout_routine_days_updated_at
  BEFORE UPDATE ON public.workout_routine_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- coach_comments updated_at 트리거
DROP TRIGGER IF EXISTS update_coach_comments_updated_at ON public.coach_comments;
CREATE TRIGGER update_coach_comments_updated_at
  BEFORE UPDATE ON public.coach_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 완료 확인
-- ================================================

SELECT 
  'Workout routine tables created successfully!' as message,
  (SELECT COUNT(*) FROM public.workout_routines) as routines_count,
  (SELECT COUNT(*) FROM public.workout_routine_days) as days_count,
  (SELECT COUNT(*) FROM public.coach_comments) as comments_count;
