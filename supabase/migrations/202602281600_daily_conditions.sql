-- daily_conditions: 하루 1회 컨디션 입력 SSOT
-- UNIQUE(user_id, day_key_utc), 서버 UTC 기준 day_key

CREATE TABLE IF NOT EXISTS public.daily_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key_utc TEXT NOT NULL,
  pain_today SMALLINT CHECK (pain_today IS NULL OR (pain_today >= 0 AND pain_today <= 10)),
  stiffness SMALLINT CHECK (stiffness IS NULL OR (stiffness >= 0 AND stiffness <= 10)),
  sleep SMALLINT CHECK (sleep IS NULL OR (sleep >= 0 AND sleep <= 10)),
  time_available_min SMALLINT CHECK (time_available_min IS NULL OR time_available_min IN (5, 10, 15)),
  equipment_available TEXT[] DEFAULT '{}',
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day_key_utc)
);

CREATE INDEX IF NOT EXISTS idx_daily_conditions_user_day
  ON public.daily_conditions(user_id, day_key_utc DESC);

CREATE INDEX IF NOT EXISTS idx_daily_conditions_day_key
  ON public.daily_conditions(day_key_utc);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_daily_conditions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at_utc = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_daily_conditions_updated_at ON public.daily_conditions;
CREATE TRIGGER update_daily_conditions_updated_at
  BEFORE UPDATE ON public.daily_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_conditions_updated_at();

-- RLS
ALTER TABLE public.daily_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_daily_conditions"
  ON public.daily_conditions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_daily_conditions"
  ON public.daily_conditions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_daily_conditions"
  ON public.daily_conditions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
