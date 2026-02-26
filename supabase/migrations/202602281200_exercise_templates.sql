-- exercise_templates: 운동 템플릿 메타 스키마 (28→300 확장 대비)
-- SSOT: focus_tags, contraindications, level
-- Deep V2 루틴 엔진에서 사용

-- ================================================
-- 1. tag_codebook (태그 SSOT)
-- ================================================
CREATE TABLE IF NOT EXISTS public.tag_codebook (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('focus', 'contraindication')),
  display_name_ko TEXT,
  scoring_version TEXT NOT NULL DEFAULT 'deep_v2'
);

-- ================================================
-- 2. exercise_templates
-- ================================================
CREATE TABLE IF NOT EXISTS public.exercise_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level SMALLINT NOT NULL CHECK (level >= 1 AND level <= 3),
  focus_tags TEXT[] NOT NULL DEFAULT '{}',
  contraindications TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  duration_sec INTEGER DEFAULT 300,
  media_ref TEXT,
  template_version INTEGER NOT NULL DEFAULT 1,
  scoring_version TEXT NOT NULL DEFAULT 'deep_v2',
  is_fallback BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_exercise_templates_level
  ON public.exercise_templates(level) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_exercise_templates_contraindications
  ON public.exercise_templates USING GIN(contraindications);
CREATE INDEX IF NOT EXISTS idx_exercise_templates_focus_tags
  ON public.exercise_templates USING GIN(focus_tags);
CREATE INDEX IF NOT EXISTS idx_exercise_templates_scoring_version
  ON public.exercise_templates(scoring_version) WHERE is_active;

-- updated_at 트리거용 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_exercise_templates_updated_at ON public.exercise_templates;
CREATE TRIGGER update_exercise_templates_updated_at
  BEFORE UPDATE ON public.exercise_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- 3. RLS: exercise_templates는 퍼블릭 읽기 전용
-- ================================================
ALTER TABLE public.exercise_templates ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자: is_active 템플릿만 SELECT (contraindications 제외는 앱 레이어)
DROP POLICY IF EXISTS "Anyone can read active exercise_templates" ON public.exercise_templates;
CREATE POLICY "Anyone can read active exercise_templates"
  ON public.exercise_templates
  FOR SELECT
  USING (is_active = TRUE);

-- tag_codebook: 읽기 전용
ALTER TABLE public.tag_codebook ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read tag_codebook" ON public.tag_codebook;
CREATE POLICY "Anyone can read tag_codebook"
  ON public.tag_codebook
  FOR SELECT
  USING (TRUE);

-- ================================================
-- 4. tag_codebook 시드 (Deep V2 태그)
-- ================================================
INSERT INTO public.tag_codebook (code, kind, display_name_ko, scoring_version) VALUES
  ('full_body_reset', 'focus', '전신 리셋', 'deep_v2'),
  ('core_control', 'focus', '코어 제어', 'deep_v2'),
  ('calf_release', 'focus', '종아리 이완', 'deep_v2'),
  ('upper_trap_release', 'focus', '상부 승모 이완', 'deep_v2'),
  ('neck_mobility', 'focus', '목 가동성', 'deep_v2'),
  ('thoracic_mobility', 'focus', '흉추 가동성', 'deep_v2'),
  ('shoulder_mobility', 'focus', '어깨 가동성', 'deep_v2'),
  ('upper_back_activation', 'focus', '상부 등 활성화', 'deep_v2'),
  ('shoulder_stability', 'focus', '어깨 안정화', 'deep_v2'),
  ('hip_flexor_stretch', 'focus', '고관절 굴곡근 스트레칭', 'deep_v2'),
  ('hip_mobility', 'focus', '고관절 가동성', 'deep_v2'),
  ('glute_activation', 'focus', '둔근 활성화', 'deep_v2'),
  ('lower_chain_stability', 'focus', '하체 사슬 안정화', 'deep_v2'),
  ('core_stability', 'focus', '코어 안정화', 'deep_v2'),
  ('global_core', 'focus', '전신 코어', 'deep_v2'),
  ('glute_medius', 'focus', '중둔근', 'deep_v2'),
  ('ankle_mobility', 'focus', '발목 가동성', 'deep_v2'),
  ('basic_balance', 'focus', '기본 균형', 'deep_v2'),
  -- contraindications
  ('shoulder_overhead', 'contraindication', '어깨 오버헤드', 'deep_v2'),
  ('shoulder_anterior_pain', 'contraindication', '어깨 전방 통증', 'deep_v2'),
  ('wrist_load', 'contraindication', '손목 부하', 'deep_v2'),
  ('knee_ground_pain', 'contraindication', '무릎 지지 통증', 'deep_v2'),
  ('knee_load', 'contraindication', '무릎 부하', 'deep_v2'),
  ('deep_squat', 'contraindication', '딥 스쿼트', 'deep_v2'),
  ('hip_impingement', 'contraindication', '고관절 임피ンジ먼트', 'deep_v2'),
  ('lower_back_pain', 'contraindication', '허리 통증', 'deep_v2'),
  ('ankle_instability', 'contraindication', '발목 불안정', 'deep_v2')
ON CONFLICT (code) DO NOTHING;

-- ================================================
-- 5. exercise_templates 시드 (28개)
-- ================================================
INSERT INTO public.exercise_templates (
  id, name, level, focus_tags, contraindications, duration_sec, is_fallback
) VALUES
  ('M01', '90/90 벽 호흡', 1, ARRAY['full_body_reset','core_control'], '{}', 300, TRUE),
  ('M28', '레그업 더 월', 1, ARRAY['full_body_reset','calf_release'], '{}', 300, TRUE),
  ('M02', '크로커다일 호흡', 1, ARRAY['full_body_reset','core_control'], '{}', 300, FALSE),
  ('M03', '턱 당기기', 1, ARRAY['upper_trap_release','neck_mobility'], '{}', 300, FALSE),
  ('M04', '흉추 신전', 1, ARRAY['thoracic_mobility'], ARRAY['shoulder_overhead'], 300, FALSE),
  ('M05', '스레드 더 니들', 2, ARRAY['thoracic_mobility','shoulder_mobility'], '{}', 300, FALSE),
  ('M06', '문틀 가슴 스트레치', 1, ARRAY['shoulder_mobility','upper_trap_release'], ARRAY['shoulder_anterior_pain'], 300, FALSE),
  ('M07', '벽천사 / 월슬라이드', 2, ARRAY['shoulder_mobility','core_control'], ARRAY['shoulder_overhead'], 300, FALSE),
  ('M08', '누워서하는 T레이즈', 2, ARRAY['upper_back_activation','thoracic_mobility'], ARRAY['shoulder_anterior_pain'], 300, FALSE),
  ('M09', '푸쉬업 플러스', 2, ARRAY['shoulder_stability','core_control'], ARRAY['wrist_load'], 300, FALSE),
  ('M25', '프론 Y 레이즈', 2, ARRAY['shoulder_stability','thoracic_mobility'], ARRAY['shoulder_overhead'], 300, FALSE),
  ('M27', '오픈북', 1, ARRAY['thoracic_mobility','shoulder_mobility'], '{}', 300, FALSE),
  ('M10', '고관절 굴곡근 스트레치', 1, ARRAY['hip_flexor_stretch'], ARRAY['knee_ground_pain'], 300, FALSE),
  ('M11', '사각자세 록백', 1, ARRAY['hip_mobility','core_control'], ARRAY['knee_ground_pain','wrist_load'], 300, FALSE),
  ('M12', '글루트 브릿지', 1, ARRAY['glute_activation','lower_chain_stability'], '{}', 300, FALSE),
  ('M13', '데드버그', 2, ARRAY['core_stability','global_core'], '{}', 300, FALSE),
  ('M14', '버드독', 2, ARRAY['core_stability','global_core'], ARRAY['knee_ground_pain','wrist_load'], 300, FALSE),
  ('M21', '버드독 슬로우 컨트롤', 3, ARRAY['global_core','core_stability'], ARRAY['knee_ground_pain','wrist_load'], 300, FALSE),
  ('M26', '플랭크', 3, ARRAY['global_core','core_stability'], ARRAY['shoulder_anterior_pain','wrist_load'], 300, FALSE),
  ('M15', '의자 박스 스쿼트', 2, ARRAY['lower_chain_stability','glute_activation'], ARRAY['knee_load','deep_squat'], 300, FALSE),
  ('M16', '스텝다운', 3, ARRAY['lower_chain_stability','ankle_mobility'], ARRAY['knee_load'], 300, FALSE),
  ('M17', '사이드 스텝', 2, ARRAY['glute_medius','glute_activation'], '{}', 300, FALSE),
  ('M18', '숏풋 / 트라이포드 풋', 1, ARRAY['ankle_mobility','basic_balance'], '{}', 300, FALSE),
  ('M19', '리버스 런지', 3, ARRAY['lower_chain_stability'], ARRAY['knee_load'], 300, FALSE),
  ('M20', '월 서포티드 힙힌지(벽 앞에서서 힙힌지)', 2, ARRAY['hip_mobility','glute_activation'], ARRAY['lower_back_pain'], 300, FALSE),
  ('M22', '사이드-라이잉 힙 어브덕션', 1, ARRAY['glute_medius','basic_balance'], '{}', 300, FALSE),
  ('M23', '한발 밸런스 리치', 3, ARRAY['lower_chain_stability','global_core'], ARRAY['knee_load','ankle_instability'], 300, FALSE),
  ('M24', '티비얼리스 레이즈', 1, ARRAY['ankle_mobility'], '{}', 300, FALSE)
ON CONFLICT (id) DO NOTHING;
