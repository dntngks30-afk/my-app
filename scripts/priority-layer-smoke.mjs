/**
 * PR-ALG-03: Priority Layer Smoke Test
 * Run: npx tsx scripts/priority-layer-smoke.mjs
 */

const projectRoot = process.cwd();

async function run() {
  const mod = await import('../src/lib/session/priority-layer.ts');
  const {
    getPainModeExtraAvoid,
    resolveSessionPriorities,
    scoreByPriority,
    getPainModePenalty,
  } = mod;

  let passed = 0;
  let failed = 0;

  // getPainModeExtraAvoid
  if (getPainModeExtraAvoid('none').length === 0) passed++;
  else failed++;
  if (getPainModeExtraAvoid('caution').length) passed++;
  else failed++;
  if (getPainModeExtraAvoid('protected').length) passed++;
  else failed++;

  // resolveSessionPriorities
  const pv1 = resolveSessionPriorities({ lower_stability: 0.8, trunk_control: 0.5 });
  if (pv1 && pv1.length > 0) passed++;
  else failed++;
  if (!resolveSessionPriorities(null)) passed++;
  else failed++;
  if (!resolveSessionPriorities({})) passed++;
  else failed++;

  // scoreByPriority
  const score = scoreByPriority(
    ['lower_chain_stability', 'glute_medius'],
    ['lower_chain_stability', 'glute_medius'],
    2
  );
  if (score >= 4) passed++;
  else failed++;

  // getPainModePenalty
  if (getPainModePenalty([], 'protected') === 0) passed++;
  else failed++;
  if (getPainModePenalty(['knee_load'], 'protected') > 0) passed++;
  else failed++;
  if (getPainModePenalty(['knee_load'], 'caution') > 0) passed++;
  else failed++;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
