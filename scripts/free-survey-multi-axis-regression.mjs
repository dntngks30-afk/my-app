/**
 * PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01
 * Free Survey Multi-Axis vs Legacy Animal-Domain — 회귀 비교 스크립트
 *
 * 구 animal-domain 경로(computeDomainScoresAndPatternForRegression + 구 evidence 매핑)와
 * 신규 direct multi-axis 경로(buildFreeSurveyDeepEvidence)의 결과를 비교한다.
 *
 * 출력:
 * - primary_type / secondary_type 분포 비교
 * - priority_vector 변화
 * - confidence 변화
 * - STABLE / DECONDITIONED 분포
 * - 알려진 행동 차이 기록
 *
 * 실행: npx tsx scripts/free-survey-multi-axis-regression.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// ─── 모듈 로드 ──────────────────────────────────────────────────────────────────

const {
  buildFreeSurveyDeepEvidence,
  computeDomainScoresAndPatternForRegression,
} = await import('../src/lib/deep-v2/adapters/free-survey-to-evidence.ts');

const { runDeepScoringCore } = await import('../src/lib/deep-scoring-core/core.ts');

// ─── 구 경로 evidence 재현 (회귀 비교용) ────────────────────────────────────────

/**
 * 구 animal-domain 경로에서 생성했던 evidence를 재현.
 * (freeSurveyAnswersToEvidence 07C 버전과 동일 로직)
 */
function buildLegacyEvidence(answers) {
  const { axisScores, resultType } = computeDomainScoresAndPatternForRegression(answers);

  if (resultType === 'MONKEY') {
    const deckScore = (axisScores.meerkat / 100) * 2.0;
    return {
      axis_scores: {
        lower_stability: 0, lower_mobility: 0, upper_mobility: 0,
        trunk_control: 0, asymmetry: 0, deconditioned: deckScore,
      },
      pain_signals: { max_intensity: undefined, primary_discomfort_none: undefined, has_location_data: false },
      movement_quality: { all_good: true },
      answered_count: Object.values(answers).filter(v => v !== undefined && v !== null).length,
      total_count: 18,
      missing_signals: ['pain_intensity_missing', 'pain_location_missing', 'objective_movement_test_missing'],
    };
  }

  const mapped = {
    lower_stability: (axisScores.penguin / 100) * 2.5,
    lower_mobility:  (axisScores.penguin / 100) * 0.4,
    upper_mobility:  (axisScores.hedgehog / 100) * 2.5,
    trunk_control:   (axisScores.kangaroo / 100) * 2.0 + (axisScores.turtle / 100) * 1.0,
    asymmetry:       (axisScores.crab / 100) * 2.0,
    deconditioned:   (axisScores.meerkat / 100) * 2.0,
  };

  if (resultType === 'COMPOSITE_ARMADILLO' || resultType === 'COMPOSITE_SLOTH') {
    mapped.deconditioned = 7.0;
  }

  return {
    axis_scores: mapped,
    pain_signals: { max_intensity: undefined, primary_discomfort_none: undefined, has_location_data: false },
    movement_quality: { all_good: false },
    answered_count: Object.values(answers).filter(v => v !== undefined && v !== null).length,
    total_count: 18,
    missing_signals: ['pain_intensity_missing', 'pain_location_missing', 'objective_movement_test_missing'],
  };
}

// ─── 픽스처 정의 ───────────────────────────────────────────────────────────────

const IDS = [
  'v2_A1', 'v2_A2', 'v2_A3',
  'v2_B1', 'v2_B2', 'v2_B3',
  'v2_C1', 'v2_C2', 'v2_C3',
  'v2_D1', 'v2_D2', 'v2_D3',
  'v2_F1', 'v2_F2', 'v2_F3',
  'v2_G1', 'v2_G2', 'v2_G3',
];

function all(v) {
  return Object.fromEntries(IDS.map(id => [id, v]));
}

function dominant(groupPrefix, v, rest = 1) {
  const answers = all(rest);
  for (const id of IDS) {
    if (id.startsWith(groupPrefix)) answers[id] = v;
  }
  return answers;
}

const FIXTURES = [
  // ─ 균형형
  { id: 'all-0',          label: '전체 0 (극단 낮음)',         answers: all(0) },
  { id: 'all-1',          label: '전체 1 (낮음)',               answers: all(1) },
  { id: 'all-2',          label: '전체 2 (중간 — 구 MONKEY)',   answers: all(2) },
  { id: 'all-3',          label: '전체 3 (중간 높음)',          answers: all(3) },
  { id: 'all-4',          label: '전체 4 (최대 — 구 ARMADILLO)', answers: all(4) },

  // ─ 단일 축 강세
  { id: 'D-dominant',     label: 'D 강세 (하체 — 구 penguin)',  answers: dominant('v2_D', 4) },
  { id: 'B-dominant',     label: 'B 강세 (상체 — 구 hedgehog)', answers: dominant('v2_B', 4) },
  { id: 'C-dominant',     label: 'C 강세 (체간 — 구 kangaroo)', answers: dominant('v2_C', 4) },
  { id: 'A-dominant',     label: 'A 강세 (전방화 — 구 turtle)', answers: dominant('v2_A', 4) },
  { id: 'F-dominant',     label: 'F 강세 (비대칭 — 구 crab)',   answers: dominant('v2_F', 4) },
  { id: 'G-dominant',     label: 'G 강세 (긴장 — 구 meerkat)',  answers: dominant('v2_G', 4) },

  // ─ 복합 패턴
  { id: 'D-B-mixed',      label: 'D=4, B=3, 나머지=1 (하체+상체)', answers: { ...all(1), v2_D1:4,v2_D2:4,v2_D3:4, v2_B1:3,v2_B2:3,v2_B3:3 } },
  { id: 'A-B-C-high',     label: 'A=4, B=4, C=4, 나머지=1',      answers: { ...all(1), v2_A1:4,v2_A2:4,v2_A3:4, v2_B1:4,v2_B2:4,v2_B3:4, v2_C1:4,v2_C2:4,v2_C3:4 } },
  { id: 'armadillo-like', label: 'A=4,B=4,C=4,D=4,G=4,F=3 (구 armadillo)', answers: { ...all(1), v2_A1:4,v2_A2:4,v2_A3:4, v2_B1:4,v2_B2:4,v2_B3:4, v2_C1:4,v2_C2:4,v2_C3:4, v2_D1:4,v2_D2:4,v2_D3:4, v2_G1:4,v2_G2:4,v2_G3:4, v2_F1:3,v2_F2:3,v2_F3:3 } },
  { id: 'G-others-2',     label: 'G=4, 나머지=2 (긴장, 다른 축 중간)', answers: { ...all(2), v2_G1:4,v2_G2:4,v2_G3:4 } },

  // ─ 미응답 포함
  { id: 'partial-A-B',    label: 'A+B만 응답, 나머지 미응답',   answers: { v2_A1:3,v2_A2:3,v2_A3:3, v2_B1:3,v2_B2:3,v2_B3:3 } },
  { id: 'empty',          label: '전체 미응답',                 answers: {} },

  // ─ helper rule 검증
  { id: 'stable-check',   label: '2 전체 → STABLE 기대',        answers: all(2) },
  { id: 'stable-low-1',   label: '1 전체 → STABLE 기대',        answers: all(1) },
  { id: 'boost-4-axes',   label: 'D=4,B=4,C=4,F=4, G=3, A=1 → DECOND 기대 (BROAD)', answers: { ...all(1), v2_D1:4,v2_D2:4,v2_D3:4, v2_B1:4,v2_B2:4,v2_B3:4, v2_C1:4,v2_C2:4,v2_C3:4, v2_F1:4,v2_F2:4,v2_F3:4, v2_G1:3,v2_G2:3,v2_G3:3 } },

  // ─ sloth-like (확산형 deconditioned) — PR-02 신규
  // 구 COMPOSITE_SLOTH 조건: top1<68, 52≤avg≤62, std<10, crab≥55, meerkat≤55
  //
  // sloth-like-01 = all-3: 구/신 모두 DECONDITIONED (구=ARMADILLO path, 신=BROAD rule).
  //   DIFFUSE rule이 아니라 BROAD rule이 잡음 — 이미 기존 fixtures에 포함 (all-3).
  //
  // sloth-like-02: F=4,A=B=C=D=3,G=2 — 구 경로 BASIC(→CORE_CONTROL_DEFICIT),
  //   신 경로 BROAD rule 발동으로 DECONDITIONED. 의도된 개선 (known diff).
  //
  // sloth-diffuse-01: F1=3,F2=2,F3=2,others=2 — BROAD NOT 발동 (no axis ≥0.65),
  //   하지만 DIFFUSE rule 조건(maxM<0.68,avgM∈[0.52,0.62],stdM<0.10,asym≥0.55,decond≤0.55) 충족.
  //   이 픽스처만이 DIFFUSE rule을 직접 테스트한다.
  //   구 경로: top1=crab≈59.7, avg≈51.6 (sloth avg threshold 미달 → BASIC → CORE_CONTROL_DEFICIT)
  //   신 경로: DIFFUSE rule → DECONDITIONED (의도된 개선, known diff)
  { id: 'sloth-like-02',   label: '확산형: F=4,A=3,B=3,C=3,D=3,G=2 — BROAD 발동 → DECOND (known diff)', answers: { v2_A1:3,v2_A2:3,v2_A3:3, v2_B1:3,v2_B2:3,v2_B3:3, v2_C1:3,v2_C2:3,v2_C3:3, v2_D1:3,v2_D2:3,v2_D3:3, v2_F1:4,v2_F2:4,v2_F3:4, v2_G1:2,v2_G2:2,v2_G3:2 } },
  { id: 'sloth-diffuse-01',label: '확산형 DIFFUSE 전용: F1=3,F2=2,F3=2,나머지=2 — DIFFUSE rule 직접 테스트', answers: { v2_A1:2,v2_A2:2,v2_A3:2, v2_B1:2,v2_B2:2,v2_B3:2, v2_C1:2,v2_C2:2,v2_C3:2, v2_D1:2,v2_D2:2,v2_D3:2, v2_F1:3,v2_F2:2,v2_F3:2, v2_G1:2,v2_G2:2,v2_G3:2 } },
];

// ─── 비교 실행 ─────────────────────────────────────────────────────────────────

function fmtPV(pv) {
  const keys = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned'];
  return keys.map(k => `${k.slice(0,4)}:${(pv[k] ?? 0).toFixed(2)}`).join(' ');
}

function fmtAxes(ax) {
  const keys = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned'];
  return keys.map(k => `${k.slice(0,4)}:${(ax[k] ?? 0).toFixed(3)}`).join(' ');
}

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01/02 — 회귀 비교');
console.log('  구 경로 (animal-domain) vs 신규 경로 (direct multi-axis)');
console.log('═══════════════════════════════════════════════════════════════════════\n');

let matchCount = 0;
let diffCount  = 0;
const diffs    = [];

for (const fx of FIXTURES) {
  const legacyEvidence = buildLegacyEvidence(fx.answers);
  const newEvidence    = buildFreeSurveyDeepEvidence(fx.answers);

  const legacyCore = runDeepScoringCore(legacyEvidence);
  const newCore    = runDeepScoringCore(newEvidence);

  const same = legacyCore.primary_type === newCore.primary_type;
  if (same) matchCount++;
  else      diffCount++;

  const marker = same ? '  =' : '  Δ';
  console.log(`${marker} [${fx.id}] ${fx.label}`);
  if (!same) {
    console.log(`      구: ${legacyCore.primary_type} (sec: ${legacyCore.secondary_type ?? '-'})`);
    console.log(`      신: ${newCore.primary_type}    (sec: ${newCore.secondary_type ?? '-'})`);
  } else {
    console.log(`      → ${newCore.primary_type} (sec: ${newCore.secondary_type ?? '-'})`);
  }
  console.log(`      구 축: ${fmtAxes(legacyEvidence.axis_scores)}`);
  console.log(`      신 축: ${fmtAxes(newEvidence.axis_scores)}`);
  console.log(`      구 PV: ${fmtPV(legacyCore.priority_vector)}`);
  console.log(`      신 PV: ${fmtPV(newCore.priority_vector)}`);
  console.log(`      구 conf: ${legacyCore.confidence.toFixed(3)} | 신 conf: ${newCore.confidence.toFixed(3)}`);
  console.log();

  if (!same) {
    diffs.push({
      id: fx.id,
      label: fx.label,
      legacy: legacyCore.primary_type,
      next:   newCore.primary_type,
    });
  }
}

// ─── 분포 요약 ─────────────────────────────────────────────────────────────────

console.log('─── 분포 요약 ─────────────────────────────────────────────────────────');
const types = ['STABLE','LOWER_INSTABILITY','LOWER_MOBILITY_RESTRICTION','UPPER_IMMOBILITY','CORE_CONTROL_DEFICIT','DECONDITIONED'];

const legacyDist = {};
const newDist    = {};
for (const t of types) { legacyDist[t] = 0; newDist[t] = 0; }

for (const fx of FIXTURES) {
  const le = buildLegacyEvidence(fx.answers);
  const ne = buildFreeSurveyDeepEvidence(fx.answers);
  const lc = runDeepScoringCore(le);
  const nc = runDeepScoringCore(ne);
  if (legacyDist[lc.primary_type] !== undefined) legacyDist[lc.primary_type]++;
  if (newDist[nc.primary_type]    !== undefined) newDist[nc.primary_type]++;
}

console.log(`  ${'타입'.padEnd(32)} 구    신`);
for (const t of types) {
  const l = String(legacyDist[t]).padStart(3);
  const n = String(newDist[t]).padStart(3);
  const mark = legacyDist[t] !== newDist[t] ? ' ←' : '';
  console.log(`  ${t.padEnd(32)} ${l}  ${n}${mark}`);
}

// ─── 알려진 행동 차이 ─────────────────────────────────────────────────────────

console.log('\n─── 알려진 행동 차이 (expected diffs) ─────────────────────────────────');
const KNOWN_DIFFS = [
  'G-dominant',
  'G-others-2',
  // PR-02 의도적 개선: 구 경로 BASIC → 신 경로 BROAD/DIFFUSE boost → DECONDITIONED
  'sloth-like-02',    // BROAD rule이 잡음 (highCount=5, decond≥0.50)
  'sloth-diffuse-01', // DIFFUSE rule이 직접 잡음 (no BROAD, diffuse window 충족)
  // PR-02 주석: sloth-like-01(=all-3)은 구/신 모두 DECONDITIONED → match, 여기 불필요
];
for (const d of diffs) {
  const isKnown = KNOWN_DIFFS.includes(d.id);
  console.log(`  ${isKnown ? '[known]' : '[NEW]  '} ${d.id}: ${d.legacy} → ${d.next} (${d.label})`);
  if (!isKnown) {
    console.log(`         ⚠ 예상 외 변경 — 의도된 변경인지 확인 필요`);
  }
}

// ─── 결과 요약 ────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log(`  일치: ${matchCount} / ${FIXTURES.length} | 변경: ${diffCount}`);
if (diffCount > 0) {
  const unknownDiffs = diffs.filter(d => !KNOWN_DIFFS.includes(d.id));
  if (unknownDiffs.length > 0) {
    console.error(`  ⚠ 예상 외 변경 ${unknownDiffs.length}건:`);
    for (const d of unknownDiffs) console.error(`    - ${d.id}: ${d.legacy} → ${d.next}`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}
console.log('  OK — 모든 변경이 알려진 범위 내에 있습니다.');
console.log('═══════════════════════════════════════════════════════════════════════\n');
