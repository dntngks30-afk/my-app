/**
 * PR-DEEP-VALID-01: Deep Test / Deep Result Validation Pack
 * Run: npx tsx scripts/deep-validation-pack.mjs
 *
 * 1. Persona check (primary_type, pain_mode, priority_vector)
 * 2. Explanation quality (reason bridge, first session bridge vs priority_vector/pain_mode)
 * 3. Result-session alignment (first session principles match priority_vector)
 * 4. pain_mode known-safe cases
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const personasPath = join(projectRoot, 'src/lib/deep-test/scenarios/personas.json');
const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    if (process.env.DEBUG) console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

/** Explanation quality: no diagnosis-like phrases */
const BANNED_PHRASES = ['증후군', '질환', '진단', '병', '장애'];

function hasBannedPhrase(text) {
  if (!text || typeof text !== 'string') return false;
  return BANNED_PHRASES.some((p) => text.includes(p));
}

async function run() {
  const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
  const copy = await import('../src/lib/deep-result/copy.ts');
  const { calculateDeepV3 } = dv;
  const { buildDeepResultReasonBridge, buildFirstSessionBridge, getV3PrescriptionNarrative } = copy;

  console.log('\n=== Deep Validation Pack ===\n');

  // 1. Persona check
  console.log('1. Persona check');
  for (const p of personas) {
    try {
      const v3 = calculateDeepV3(p.input);
      const exp = p.expected_analysis || {};
      if (exp.primary_type && v3.primary_type !== exp.primary_type) {
        throw new Error(`primary_type: expected ${exp.primary_type}, got ${v3.primary_type}`);
      }
      if (exp.result_type && v3.result_type !== exp.result_type) {
        throw new Error(`result_type: expected ${exp.result_type}, got ${v3.result_type}`);
      }
      if (exp.pain_mode && v3.pain_mode !== exp.pain_mode) {
        throw new Error(`pain_mode: expected ${exp.pain_mode}, got ${v3.pain_mode}`);
      }
      if (exp.priority_vector_contains && Array.isArray(exp.priority_vector_contains)) {
        const pv = v3.priority_vector || {};
        const topAxes = Object.entries(pv)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([k]) => k);
        for (const axis of exp.priority_vector_contains) {
          if (!topAxes.includes(axis)) {
            throw new Error(`priority_vector_contains: expected ${axis} in top, got [${topAxes.join(', ')}]`);
          }
        }
      }
      ok(`persona ${p.id}`, true);
    } catch (err) {
      failed++;
      console.error(`  ✗ persona ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Explanation quality + Result-session alignment
  console.log('\n2. Explanation quality & result-session alignment');
  for (const p of personas) {
    const v3 = calculateDeepV3(p.input);
    const pv = v3.priority_vector ?? null;
    const painMode = v3.pain_mode ?? null;
    const focusTags = v3.derived?.focus_tags ?? [];

    const resultType = v3.result_type ?? v3.derived?.result_type ?? null;
    const reasonBridge = buildDeepResultReasonBridge(resultType, pv, painMode, focusTags);
    const firstSession = buildFirstSessionBridge(resultType, pv, painMode, focusTags);
    const narrative = getV3PrescriptionNarrative(pv, painMode, focusTags);

    // No banned phrases
    const allText = [
      ...(reasonBridge?.bullets ?? []),
      ...(firstSession?.principles ?? []),
      firstSession?.headline,
      firstSession?.note,
      ...(narrative?.movementFeatures ?? []),
      ...(narrative?.cautionPoints ?? []),
    ].filter(Boolean);
    const hasBanned = allText.some(hasBannedPhrase);
    ok(`explanation no banned phrases [${p.id}]`, !hasBanned);

    // pain_mode caution/protected + firstSession exists → conservativeNote or principles contain conservative
    if ((painMode === 'caution' || painMode === 'protected') && firstSession) {
      const hasConservative =
        firstSession.conservativeNote === '초반 강도는 보수적으로 설정됩니다' ||
        firstSession.principles?.some((s) => s.includes('보수') || s.includes('통증 없는'));
      ok(`pain_mode ${painMode} has conservative guidance [${p.id}]`, !!hasConservative);
    }

    // priority_vector top axes → first session has chips or principles (alignment)
    if (pv && Object.keys(pv).length > 0 && firstSession) {
      const hasChipsOrPrinciples =
        (firstSession.chips && firstSession.chips.length > 0) ||
        (firstSession.principles && firstSession.principles.length > 0);
      ok(`first session has chips/principles [${p.id}]`, hasChipsOrPrinciples);
    }
  }

  // 3. pain_mode known-safe cases
  console.log('\n3. pain_mode known-safe cases');
  const painModeCases = [
    { id: 'stable-low-pain', expectedPainMode: 'none', desc: 'maxInt=1, 해당 없음 → none' },
    { id: 'pain-mode-caution', expectedPainMode: 'caution', desc: '약간 통증 + primary → caution' },
    { id: 'pain-mode-protected', expectedPainMode: 'protected', desc: '강함(7~10) → protected' },
    { id: 'lower-instability-severe', expectedPainMode: 'caution', desc: '약간 통증 + 흔들림 → caution' },
  ];
  for (const c of painModeCases) {
    const p = personas.find((x) => x.id === c.id);
    if (!p) continue;
    const v3 = calculateDeepV3(p.input);
    ok(`pain_mode ${c.id}: ${c.expectedPainMode}`, v3.pain_mode === c.expectedPainMode);
  }

  // 4. buildFirstSessionBridge null when no priority_vector (deep_v2 fallback)
  console.log('\n4. deep_v2 fallback (no priority_vector)');
  const v2StyleResult = { priority_vector: null, pain_mode: null, derived: { focus_tags: [] } };
  const bridgeNull = buildFirstSessionBridge(null, null, null, []);
  ok('buildFirstSessionBridge returns null when no pv', bridgeNull === null);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
