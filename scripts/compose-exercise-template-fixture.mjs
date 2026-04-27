/**
 * PR-TEMPLATE-48-METADATA-ALIGN-01: deterministic fixture for session plan (M01~M48).
 * Source: 202602281200 + 202603011200 + 202603190001 + 202603230001 + 20260419120001 names
 *         + 202603211200 M29-48 + 20260427120000 session-composer v1
 *
 * Run: node scripts/compose-exercise-template-fixture.mjs
 * Writes: scripts/fixtures/exercise-templates-session-plan-m01-m48.v1.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outPath = join(root, 'scripts', 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');

/** (id, name, level, focus[], contra[], is_fallback, balance, complexity, phase, target_vector, difficulty, avoid_if_pain_mode, progression) */
const M01M28 = [
  ['M01', '90/90 벽 호흡', 1, ['full_body_reset', 'core_control'], [], true, 'low', 'low', 'prep', ['trunk_control', 'deconditioned'], 'low', [], 1],
  ['M28', '레그업 더 월', 1, ['full_body_reset', 'calf_release'], [], true, 'low', 'low', 'prep', ['trunk_control', 'deconditioned'], 'low', [], 1],
  ['M02', '크로커다일 호흡', 1, ['full_body_reset', 'core_control'], [], false, 'low', 'low', 'prep', ['trunk_control', 'deconditioned'], 'low', [], 1],
  ['M03', '턱 당기기', 1, ['upper_trap_release', 'neck_mobility'], [], false, 'low', 'low', 'prep', ['upper_mobility'], 'low', [], 1],
  ['M04', '흉추 신전', 1, ['thoracic_mobility'], ['shoulder_overhead'], false, 'low', 'low', 'prep', ['upper_mobility'], 'low', [], 1],
  ['M05', '스레드 더 니들', 1, ['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability'], [], false, 'low', 'medium', 'main', ['upper_mobility'], 'medium', [], 2],
  ['M06', '문틀 가슴 스트레치', 1, ['shoulder_mobility', 'upper_trap_release'], ['shoulder_anterior_pain'], false, 'low', 'low', 'accessory', ['upper_mobility'], 'low', [], 1],
  ['M07', '벽천사', 2, ['shoulder_mobility', 'core_control'], ['shoulder_overhead'], false, 'low', 'medium', 'main', ['upper_mobility'], 'medium', [], 2],
  ['M08', '누워서 하는 T 레이즈', 1, ['upper_back_activation', 'thoracic_mobility'], ['shoulder_anterior_pain'], false, 'low', 'low', 'main', ['upper_mobility'], 'medium', [], 2],
  ['M09', '푸쉬업 플러스', 2, ['shoulder_stability', 'core_control'], ['wrist_load'], false, 'medium', 'medium', 'main', ['upper_mobility', 'trunk_control'], 'medium', ['caution'], 2],
  ['M25', '프론 Y 레이즈', 2, ['shoulder_stability', 'thoracic_mobility'], ['shoulder_overhead'], false, 'medium', 'medium', 'main', ['upper_mobility', 'trunk_control'], 'medium', ['caution'], 2],
  ['M27', '오픈북', 1, ['thoracic_mobility', 'shoulder_mobility', 'upper_trap_release'], [], false, 'low', 'low', 'prep', ['upper_mobility'], 'low', [], 1],
  ['M10', '고관절 굴곡근 스트레치', 1, ['hip_flexor_stretch'], ['knee_ground_pain'], false, 'low', 'low', 'accessory', ['lower_mobility'], 'low', [], 1],
  ['M11', '사각자세 록백', 1, ['hip_mobility', 'core_control'], ['knee_ground_pain', 'wrist_load'], false, 'low', 'low', 'accessory', ['lower_mobility'], 'low', [], 1],
  ['M12', '글루트 브릿지', 1, ['glute_activation', 'lower_chain_stability'], [], false, 'low', 'low', 'main', ['trunk_control', 'lower_stability'], 'low', [], 1],
  ['M13', '데드버그', 2, ['core_stability', 'global_core'], [], false, 'low', 'medium', 'main', ['trunk_control'], 'medium', [], 2],
  ['M14', '버드독', 2, ['core_stability', 'global_core'], ['knee_ground_pain', 'wrist_load'], false, 'low', 'medium', 'main', ['trunk_control'], 'medium', [], 2],
  ['M21', '버드독 슬로우 컨트롤', 3, ['global_core', 'core_stability'], ['knee_ground_pain', 'wrist_load'], false, 'medium', 'high', 'main', ['trunk_control'], 'high', ['protected'], 3],
  ['M26', '플랭크', 3, ['global_core', 'core_stability'], ['shoulder_anterior_pain', 'wrist_load'], false, 'medium', 'high', 'main', ['trunk_control'], 'high', ['protected'], 3],
  ['M15', '의자 박스 스쿼트', 2, ['lower_chain_stability', 'glute_activation'], ['knee_load', 'deep_squat'], false, 'low', 'low', 'main', ['lower_stability'], 'medium', [], 2],
  ['M16', '벽 짚고 스플릿 스쿼트', 3, ['lower_chain_stability', 'ankle_mobility'], ['knee_load'], false, 'high', 'high', 'main', ['lower_stability', 'lower_mobility'], 'high', ['protected'], 3],
  ['M17', '벽 짚고 스탠딩 힙 어브덕션', 2, ['glute_medius', 'glute_activation'], [], false, 'low', 'low', 'main', ['lower_stability'], 'medium', [], 2],
  ['M18', '양발 카프 레이즈', 1, ['ankle_mobility', 'basic_balance'], [], false, 'high', 'low', 'main', ['lower_stability', 'asymmetry'], 'low', [], 1],
  ['M19', '리버스 런지', 3, ['lower_chain_stability'], ['knee_load'], false, 'high', 'high', 'main', ['lower_stability'], 'high', ['caution'], 3],
  ['M20', '월 서포티드 힙힌지', 2, ['hip_mobility', 'glute_activation'], ['lower_back_pain'], false, 'low', 'low', 'main', ['lower_mobility', 'trunk_control'], 'medium', [], 2],
  ['M22', '사이드 라이잉 힙 어브덕션', 1, ['glute_medius', 'basic_balance'], [], false, 'low', 'low', 'main', ['lower_stability', 'asymmetry'], 'low', [], 1],
  ['M23', '한발 밸런스 리치', 3, ['lower_chain_stability', 'global_core'], ['knee_load', 'ankle_instability'], false, 'high', 'high', 'main', ['lower_stability', 'asymmetry'], 'high', ['protected'], 3],
  ['M24', '티비얼리스 레이즈', 1, ['ankle_mobility'], [], false, 'low', 'low', 'accessory', ['lower_mobility'], 'low', [], 1],
];

/** duration_sec, then full composer row; contras for M30 M44 M46 from v1 backfill */
const M29M48 = [
  ['M29', '힐 탭 데드버그', 2, ['core_stability', 'global_core'], [], 300, 'low', 'medium', 'main', ['trunk_control'], 'medium', [], 2],
  ['M30', '쿼드러펫 숄더탭', 2, ['core_stability', 'global_core'], ['lower_back_pain', 'wrist_load'], 300, 'low', 'medium', 'main', ['trunk_control'], 'medium', [], 2],
  ['M31', '버드독 3초 홀드', 2, ['core_stability', 'core_control'], ['wrist_load'], 300, 'low', 'medium', 'main', ['trunk_control'], 'medium', [], 2],
  ['M32', '베어 포지션 홀드', 2, ['core_stability', 'global_core'], ['wrist_load', 'lower_back_pain'], 240, 'low', 'medium', 'main', ['trunk_control'], 'high', ['caution', 'protected'], 2],
  ['M33', '사이드 플랭크 무릎 버전', 2, ['global_core', 'core_stability'], ['shoulder_load', 'shoulder_anterior_pain'], 240, 'low', 'medium', 'main', ['trunk_control'], 'medium', ['caution'], 2],
  ['M34', '마치 브릿지', 2, ['glute_activation', 'core_control'], ['lower_back_pain'], 300, 'low', 'low', 'main', ['lower_stability', 'trunk_control'], 'medium', [], 2],
  ['M35', '싱글 브릿지 보조형', 3, ['glute_activation', 'lower_chain_stability'], ['lower_back_pain'], 300, 'medium', 'medium', 'main', ['lower_stability'], 'high', ['protected'], 3],
  ['M36', '스플릿 스탠스 체중이동', 2, ['lower_chain_stability', 'basic_balance'], ['knee_load'], 300, 'medium', 'medium', 'main', ['lower_stability', 'asymmetry'], 'medium', ['caution'], 2],
  ['M37', '스플릿 스쿼트 아이소 홀드', 3, ['lower_chain_stability', 'glute_activation'], ['knee_load'], 240, 'high', 'high', 'main', ['lower_stability'], 'high', ['caution', 'protected'], 3],
  ['M38', '리버스 런지 투 니드라이브', 3, ['lower_chain_stability', 'global_core'], ['knee_load', 'ankle_instability'], 300, 'high', 'high', 'main', ['lower_stability', 'asymmetry'], 'high', ['caution', 'protected'], 3],
  ['M39', '의자 보조 싱글레그 RDL 리치', 3, ['lower_chain_stability', 'global_core'], ['ankle_instability', 'lower_back_pain'], 300, 'high', 'high', 'main', ['lower_stability'], 'high', ['protected'], 3],
  ['M40', '싱글레그 스탠드 리치 3방향', 3, ['basic_balance', 'lower_chain_stability'], ['ankle_instability', 'knee_load'], 300, 'high', 'high', 'main', ['lower_stability', 'asymmetry'], 'high', ['caution', 'protected'], 3],
  ['M41', '벽 발목 전방 이동', 2, ['ankle_mobility', 'lower_chain_stability'], [], 240, 'low', 'low', 'prep', ['lower_mobility', 'lower_stability'], 'low', [], 1],
  ['M42', '하프 니링 힙 쉬프트', 2, ['hip_mobility', 'core_control'], ['knee_ground_pain'], 300, 'low', 'low', 'accessory', ['lower_mobility', 'trunk_control'], 'low', [], 1],
  ['M43', '90/90 힙 스위치', 2, ['hip_mobility', 'global_core'], ['hip_impingement'], 300, 'low', 'low', 'accessory', ['lower_mobility', 'trunk_control'], 'medium', ['caution'], 2],
  ['M44', '딥 스쿼트', 2, ['hip_mobility', 'ankle_mobility'], ['knee_load', 'deep_squat'], 240, 'low', 'low', 'prep', ['lower_mobility'], 'medium', ['caution', 'protected'], 2],
  ['M45', '벽 푸쉬업 플러스', 2, ['shoulder_mobility', 'upper_back_activation'], ['wrist_load', 'shoulder_anterior_pain'], 300, 'low', 'low', 'main', ['upper_mobility', 'trunk_control'], 'medium', ['caution'], 2],
  ['M46', '스탠딩 오픈북', 2, ['upper_back_activation', 'shoulder_mobility', 'thoracic_mobility'], ['shoulder_overhead'], 240, 'low', 'low', 'accessory', ['upper_mobility', 'trunk_control'], 'medium', ['caution'], 2],
  ['M47', '프론 W 레이즈', 2, ['upper_back_activation', 'shoulder_stability'], ['shoulder_anterior_pain'], 300, 'low', 'low', 'main', ['upper_mobility'], 'medium', [], 2],
  ['M48', '스탠딩 W 리트랙션', 2, ['upper_back_activation', 'shoulder_stability'], ['shoulder_anterior_pain'], 300, 'low', 'low', 'accessory', ['upper_mobility'], 'low', [], 1],
];

function rowM01M28(
  [id, name, level, focus, contra, isFb, bal, com, ph, tv, diff, apm, prog]
) {
  return {
    id,
    name,
    level,
    focus_tags: focus,
    contraindications: contra,
    duration_sec: 300,
    media_ref: null,
    is_fallback: isFb,
    phase: ph,
    target_vector: tv,
    difficulty: diff,
    avoid_if_pain_mode: apm,
    progression_level: prog,
    balance_demand: bal,
    complexity: com,
  };
}

function rowM29M48(
  [id, name, level, focus, contra, duration, bal, com, ph, tv, diff, apm, prog]
) {
  return {
    id,
    name,
    level,
    focus_tags: focus,
    contraindications: contra,
    duration_sec: duration,
    media_ref: null,
    is_fallback: false,
    phase: ph,
    target_vector: tv,
    difficulty: diff,
    avoid_if_pain_mode: apm,
    progression_level: prog,
    balance_demand: bal,
    complexity: com,
  };
}

const rows = [
  ...M01M28.map((t) => rowM01M28(t)),
  ...M29M48.map((t) => rowM29M48(t)),
].sort((a, b) => a.id.localeCompare(b.id));

mkdirSync(join(root, 'scripts', 'fixtures'), { recursive: true });
const payload = {
  version: 'session_plan_template_fixture_v1',
  description:
    'Deterministic M01~M48 rows aligned with supabase/migrations 202602281200 + 202603011200 + 202603190001 + 202603230001 + 20260419120001 + 202603211200 + 20260427120000_exercise_templates_m29_m48_session_composer_v1',
  template_count: 48,
  templates: rows,
};

writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('Wrote', outPath, 'count=', rows.length);
