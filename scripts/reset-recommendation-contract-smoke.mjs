/**
 * PR-RESET-BE-02 — recommendation 엔진·응답 계약 오프라인 스모크
 * Run: npx tsx scripts/reset-recommendation-contract-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const mod = await import('../src/lib/reset/recommend-reset.ts');

const {
  recommendResetForPattern,
  buildResetRecommendationPayload,
} = mod;

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function collectStretchVms(resp) {
  const out = [];
  for (const issue of resp.issues) {
    out.push(issue.primary_stretch, ...issue.alternative_stretches);
  }
  return out;
}

function assertRoundTripJson(label, obj) {
  try {
    const rt = JSON.parse(JSON.stringify(obj));
    ok(`${label}: JSON 직렬화·라운드트립 가능`, true);
    const walk = (v, path) => {
      if (v === null || v === undefined) return;
      const t = typeof v;
      if (t === 'function' || t === 'symbol' || t === 'bigint') {
        throw new Error(`${path}: ${t}`);
      }
      if (t === 'object' && !Array.isArray(v) && v.constructor && v.constructor !== Object) {
        throw new Error(`${path}: non-plain object`);
      }
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (t === 'object' && v !== null)
        for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
    };
    walk(rt, 'rt');
    ok(`${label}: 라운드트립 순수 JSON 값만 존재`, true);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${label}: JSON 계약 검증 실패`, e);
  }
}

// --- 1. fallback ---
const fb = recommendResetForPattern(null);
ok('version reset_v1', fb.version === 'reset_v1');
ok('fallback featured thoracic_stiffness', fb.featured_issue_key === 'thoracic_stiffness');
ok('issues.length 10', fb.issues.length === 10);
ok('meta.total_issues 10', fb.meta.total_issues === 10);
ok('meta.source fallback', fb.meta.source === 'fallback');
ok('meta.unmapped_template_count 10', fb.meta.unmapped_template_count === 10);

const stretchVms = collectStretchVms(fb);
ok(
  '모든 stretch media_status unmapped',
  stretchVms.every((s) => s.media_status === 'unmapped')
);
ok(
  '모든 issue alternative_stretches.length === 2',
  fb.issues.every((i) => i.alternative_stretches.length === 2)
);

// --- 유지 테스트 (축 보정 불필요 시 default 유지) ---
const lowerKeep = recommendResetForPattern({
  primary_type: 'LOWER_MOBILITY_RESTRICTION',
  priority_vector: ['lower_mobility'],
});
ok(
  'LOWER + lower_mobility → hip_tightness 유지',
  lowerKeep.featured_issue_key === 'hip_tightness'
);

const coreKeep = recommendResetForPattern({
  primary_type: 'CORE_CONTROL_DEFICIT',
  priority_vector: ['trunk_control'],
});
ok(
  'CORE + trunk_control → pelvis_lowback_tension 유지',
  coreKeep.featured_issue_key === 'pelvis_lowback_tension'
);

const upperKeep = recommendResetForPattern({
  primary_type: 'UPPER_IMMOBILITY',
  priority_vector: ['upper_mobility'],
});
ok(
  'UPPER + upper_mobility → forward_head 유지',
  upperKeep.featured_issue_key === 'forward_head'
);

// primary 기본 featured와 축이 어긋날 때만 카탈로그 순 매칭으로 보정( PL-N 스펙 ).
const stableLowerAxis = recommendResetForPattern({
  primary_type: 'STABLE',
  priority_vector: ['lower_mobility'],
});
ok(
  'STABLE + lower_mobility → low_back_tightness(첫 axis 매칭)',
  stableLowerAxis.featured_issue_key === 'low_back_tightness'
);

// --- primary별 기본 매핑 (표) ---
const mapCases = [
  ['UPPER_IMMOBILITY', 'forward_head'],
  ['LOWER_MOBILITY_RESTRICTION', 'hip_tightness'],
  ['LOWER_INSTABILITY', 'knee_discomfort'],
  ['CORE_CONTROL_DEFICIT', 'pelvis_lowback_tension'],
  ['DECONDITIONED', 'thoracic_stiffness'],
  ['STABLE', 'thoracic_stiffness'],
  ['ALIEN_PRIMARY_XYZ_NOT_REAL', 'thoracic_stiffness'],
];

for (const [p, expected] of mapCases) {
  const r = recommendResetForPattern(
    { primary_type: p },
    { metaSource: 'readiness', resultSummarySourceMode: 'baseline' }
  );
  ok(`primary ${p} → ${expected}`, r.featured_issue_key === expected);
}

// --- JSON 계약 (featured·issues 간 동일 객체 참조는 JSON에서 복제되어 라운드트립 허용) ---
assertRoundTripJson('fallback 응답', fb);

// --- buildResetRecommendationPayload: readiness 경로 user_pattern.source_stage ---
const readyPayload = buildResetRecommendationPayload({
  pattern: { primary_type: 'STABLE', priority_vector: [] },
  metaSource: 'readiness',
  resultSummarySourceMode: 'refined',
});
ok(
  'readiness + refined → user_pattern.source_stage refined',
  readyPayload.user_pattern.source_stage === 'refined'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
