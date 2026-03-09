/**
 * PR-ALG-10 / PR-ALG-11B: Shadow analysis report
 * Run: npx tsx scripts/deep-v3-shadow-report.mjs [candidate]
 *   candidate: pain_mode_relaxed (default) | pain_mode_relaxed_v2
 * Aggregates shadow_compare from persona pack (and optionally golden fixtures).
 * Outputs: diff rate, pain_mode direction, category breakdown, apply gate recommendation.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const CANDIDATE_ARG = process.argv[2] || 'pain_mode_relaxed';
const CANDIDATE_NAME = ['pain_mode_relaxed', 'pain_mode_relaxed_v2'].includes(CANDIDATE_ARG)
  ? CANDIDATE_ARG
  : 'pain_mode_relaxed';
const SHADOW_RULE_VERSION =
  CANDIDATE_NAME === 'pain_mode_relaxed_v2'
    ? 'deep_v3_pain_mode_candidate_relaxed_v2'
    : 'deep_v3_pain_mode_candidate_relaxed';

/** Map persona/scenario id to risk category */
function getScenarioCategory(id) {
  if (!id || typeof id !== 'string') return 'unknown';
  const lower = id.toLowerCase();
  if (lower.includes('protected') || lower.includes('pain-protected') || lower.includes('sls-pain') || lower.includes('trunk-control-high')) {
    return 'pain-protected';
  }
  if (lower.includes('caution') || lower.includes('severe')) {
    return 'pain-caution';
  }
  if (lower.includes('stable') || lower.includes('basic') || lower.includes('ankle') || lower.includes('experienced') || lower.includes('elder')) {
    return 'low-risk';
  }
  return 'mixed';
}

async function run() {
  const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
  const { calculateDeepV3, calculateDeepV3WithCandidate, buildShadowCompare } = dv;

  const personasPath = join(__dirname, '..', 'src/lib/deep-test/scenarios/personas.json');
  const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));

  const fixturesPath = join(__dirname, '..', 'src/lib/deep-test/golden/fixtures.json');
  let fixtures = [];
  try {
    fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));
  } catch {
    /* optional */
  }

  const scenarios = [
    ...personas.map((p) => ({ id: p.id, input: p.input, source: 'persona' })),
    ...fixtures.map((f) => ({ id: f.id, input: f.answers, source: 'golden' })),
  ];

  const compareList = [];
  for (const s of scenarios) {
    const active = calculateDeepV3(s.input);
    const shadow = calculateDeepV3WithCandidate(s.input, CANDIDATE_NAME);
    const compare = buildShadowCompare(active, shadow, CANDIDATE_NAME, SHADOW_RULE_VERSION);
    compareList.push({
      id: s.id,
      source: s.source,
      category: getScenarioCategory(s.id),
      compare,
    });
  }

  const total = compareList.length;
  const withDiff = compareList.filter((c) => c.compare.diff_flags.length > 0);
  const diffCount = withDiff.length;

  const diffFlagsCount = {};
  const painModeDirection = {};
  const categoryChanged = {};

  for (const { compare, category } of compareList) {
    for (const f of compare.diff_flags) {
      diffFlagsCount[f] = (diffFlagsCount[f] || 0) + 1;
    }
    if (compare.diff_flags.includes('pain_mode_changed')) {
      const key = `${compare.active_pain_mode} -> ${compare.shadow_pain_mode}`;
      painModeDirection[key] = (painModeDirection[key] || 0) + 1;
      categoryChanged[category] = (categoryChanged[category] || 0) + 1;
    }
  }

  const primaryTypeChanged = compareList.filter(
    (c) => c.compare.active_primary_type !== c.compare.shadow_primary_type
  ).length;
  const priorityChanged = compareList.filter((c) =>
    c.compare.diff_flags.includes('priority_order_changed')
  ).length;

  console.log('\n=== PR-ALG-10 Shadow Analysis Report ===\n');
  console.log(`Data source: ${personas.length} personas + ${fixtures.length} golden fixtures = ${total} scenarios`);
  console.log(`Candidate: ${CANDIDATE_NAME}\n`);

  console.log('1. Candidate별 총 비교 건수');
  console.log(`   ${CANDIDATE_NAME}: ${total}건`);
  console.log(`   diff 발생: ${diffCount}건 (${((diffCount / total) * 100).toFixed(1)}%)\n`);

  console.log('2. diff_flags별 건수');
  for (const [flag, count] of Object.entries(diffFlagsCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${flag}: ${count}건`);
  }
  if (Object.keys(diffFlagsCount).length === 0) {
    console.log('   (없음)');
  }
  console.log('');

  console.log('3. pain_mode direction 분포');
  for (const [dir, count] of Object.entries(painModeDirection).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${dir}: ${count}건`);
  }
  if (Object.keys(painModeDirection).length === 0) {
    console.log('   (없음)');
  }
  console.log('');

  console.log('4. primary_type / priority_vector changed 비율');
  console.log(`   primary_type_changed: ${primaryTypeChanged}건 (${((primaryTypeChanged / total) * 100).toFixed(1)}%)`);
  console.log(`   priority_order_changed: ${priorityChanged}건 (${((priorityChanged / total) * 100).toFixed(1)}%)\n`);

  console.log('5. Scenario category별 pain_mode_changed 건수');
  const categories = ['pain-protected', 'pain-caution', 'low-risk', 'mixed', 'unknown'];
  for (const cat of categories) {
    const count = categoryChanged[cat] || 0;
    const inCat = compareList.filter((c) => c.category === cat).length;
    const pct = inCat > 0 ? ((count / inCat) * 100).toFixed(1) : '0';
    console.log(`   ${cat}: ${count}/${inCat}건 (${pct}%)`);
  }
  console.log('');

  const painProtectedChanged = categoryChanged['pain-protected'] || 0;
  const cautionToNone = painModeDirection['caution -> none'] || 0;
  const cautionToNoneRate = total > 0 ? cautionToNone / total : 0;

  let recommendation = 'keep_shadow';
  if (painProtectedChanged > 0) {
    recommendation = 'keep_shadow';
  } else if (cautionToNoneRate > 0.3) {
    recommendation = 'adjust_candidate';
  } else if (cautionToNoneRate <= 0.15 && painProtectedChanged === 0) {
    recommendation = 'promote_to_active';
  }

  console.log('6. 추천 상태 (apply gate 기준)');
  console.log(`   pain-protected category에서 변화: ${painProtectedChanged}건`);
  console.log(`   caution -> none 변화: ${cautionToNone}건 (${(cautionToNoneRate * 100).toFixed(1)}%)`);
  console.log(`   권고: ${recommendation}\n`);

  if (process.env.DEBUG) {
    console.log('7. Changed 상세 (DEBUG)');
    for (const c of withDiff.slice(0, 10)) {
      console.log(`   ${c.id} [${c.category}]: ${c.compare.active_pain_mode} -> ${c.compare.shadow_pain_mode}`);
    }
  }

  console.log('=== End Report ===\n');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
