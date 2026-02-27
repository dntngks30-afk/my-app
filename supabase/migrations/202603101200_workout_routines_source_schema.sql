-- workout_routines: source/source_id SSOT + 멱등 UNIQUE + 목록 인덱스
-- PR-2-Routine-SourceSchema-02
-- 
-- source: 출처 구분 (movement=운동검사, deep=심층분석, manual=수동)
-- source_id: 출처 엔티티 ID (deep의 경우 deep_test_attempts.id)
-- Postgres UNIQUE: NULL은 서로 충돌하지 않음 → (user, 'movement', NULL) 다중 허용
-- (user, 'deep', X) 동일 시 2번째 insert UNIQUE 위반 (멱등)

-- 1. source 컬럼 (not null, default 'movement')
ALTER TABLE public.workout_routines
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'movement';

-- 2. source_id 컬럼 (uuid nullable)
ALTER TABLE public.workout_routines
  ADD COLUMN IF NOT EXISTS source_id uuid NULL;

-- 3. source 값 제약 (선택)
ALTER TABLE public.workout_routines
  DROP CONSTRAINT IF EXISTS workout_routines_source_check;

ALTER TABLE public.workout_routines
  ADD CONSTRAINT workout_routines_source_check
  CHECK (source IN ('movement', 'deep', 'manual'));

-- 4. 루틴 목록 성능: (user_id, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_created_desc
  ON public.workout_routines (user_id, created_at DESC NULLS LAST);

-- 5. 멱등 UNIQUE: (user_id, source, source_id)
-- source_id NULL → movement 루틴 여러 개 가능 (Postgres NULL != NULL)
-- source_id 값 있으면 → deep 등 동일 시 2번째 insert 충돌
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_routines_user_source_source_id
  ON public.workout_routines (user_id, source, source_id)
  WHERE source_id IS NOT NULL;
