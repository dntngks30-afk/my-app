-- 신규 홈트 템플릿 M29~M48 (20개) 추가
-- media_ref = null (Mux 업로드 후 admin에서 수동 연결)
-- SSOT: 202602281200_exercise_templates.sql 시드 패턴 준수

-- shoulder_load contraindication 추가 (M33에서 사용)
INSERT INTO public.tag_codebook (code, kind, display_name_ko, scoring_version) VALUES
  ('shoulder_load', 'contraindication', '어깨 부하', 'deep_v2')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.exercise_templates (
  id, name, level, focus_tags, contraindications, equipment, duration_sec,
  media_ref, template_version, scoring_version, is_fallback, is_active
) VALUES
  ('M29', '힐 탭 데드버그', 2, ARRAY['core_stability','global_core'], '{}', ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M30', '레그 익스텐드 데드버그', 2, ARRAY['core_stability','global_core'], ARRAY['lower_back_pain'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M31', '버드독 3초 홀드', 2, ARRAY['core_stability','core_control'], ARRAY['wrist_load'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M32', '베어 포지션 홀드', 2, ARRAY['core_stability','global_core'], ARRAY['wrist_load','lower_back_pain'], ARRAY['bodyweight'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M33', '사이드 플랭크 무릎 버전', 2, ARRAY['global_core','core_stability'], ARRAY['shoulder_load','shoulder_anterior_pain'], ARRAY['bodyweight'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M34', '마치 글루트 브릿지', 2, ARRAY['glute_activation','core_control'], ARRAY['lower_back_pain'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M35', '싱글레그 브릿지 보조형', 3, ARRAY['glute_activation','lower_chain_stability'], ARRAY['lower_back_pain'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M36', '스플릿 스탠스 체중이동', 2, ARRAY['lower_chain_stability','basic_balance'], ARRAY['knee_load'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M37', '스플릿 스쿼트 아이소 홀드', 3, ARRAY['lower_chain_stability','glute_activation'], ARRAY['knee_load'], ARRAY['bodyweight'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M38', '리버스 런지 투 니드라이브', 3, ARRAY['lower_chain_stability','global_core'], ARRAY['knee_load','ankle_instability'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M39', '의자 보조 싱글레그 RDL 리치', 3, ARRAY['lower_chain_stability','global_core'], ARRAY['ankle_instability','lower_back_pain'], ARRAY['chair'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M40', '싱글레그 스탠드 리치 3방향', 3, ARRAY['basic_balance','lower_chain_stability'], ARRAY['ankle_instability','knee_load'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M41', '벽 발목 전방 이동', 2, ARRAY['ankle_mobility','lower_chain_stability'], '{}', ARRAY['wall'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M42', '하프 니링 힙 쉬프트', 2, ARRAY['hip_mobility','core_control'], ARRAY['knee_ground_pain'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M43', '90/90 힙 스위치', 2, ARRAY['hip_mobility','global_core'], ARRAY['hip_impingement'], ARRAY['bodyweight'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M44', '월 서포트 딥 스쿼트 홀드', 2, ARRAY['hip_mobility','ankle_mobility'], ARRAY['knee_load'], ARRAY['wall'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M45', '벽 푸시업 플러스', 2, ARRAY['shoulder_mobility','upper_back_activation'], ARRAY['wrist_load','shoulder_anterior_pain'], ARRAY['wall'], 300, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M46', '프론 Y 레이즈', 2, ARRAY['upper_back_activation','shoulder_mobility'], ARRAY['shoulder_overhead'], ARRAY['bodyweight'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M47', '프론 W 레이즈', 2, ARRAY['upper_back_activation','shoulder_stability'], ARRAY['shoulder_anterior_pain'], ARRAY['bodyweight'], 240, NULL, 1, 'deep_v2', FALSE, TRUE),
  ('M48', '밴드 풀어파트', 2, ARRAY['upper_back_activation','shoulder_stability'], ARRAY['shoulder_anterior_pain'], ARRAY['band'], 300, NULL, 1, 'deep_v2', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;
