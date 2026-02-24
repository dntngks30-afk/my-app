-- routine_attendance: 7일 출석 기록 (멱등)
-- UNIQUE(routine_id, day_number) 로 중복 출석 방지

CREATE TABLE IF NOT EXISTS public.routine_attendance (
  id bigserial primary key,
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  day_number int not null check (day_number between 1 and 7),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (routine_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_routine_attendance_routine_id
  ON public.routine_attendance(routine_id);

ALTER TABLE public.routine_attendance ENABLE ROW LEVEL SECURITY;

-- 소유자만 SELECT (routine 소유 확인)
CREATE POLICY "routine_attendance_select_owner"
  ON public.routine_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_routines r
      WHERE r.id = routine_attendance.routine_id
        AND r.user_id = auth.uid()
    )
  );

-- 소유자만 INSERT (routine 소유 확인)
CREATE POLICY "routine_attendance_insert_owner"
  ON public.routine_attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_routines r
      WHERE r.id = routine_attendance.routine_id
        AND r.user_id = auth.uid()
    )
  );
