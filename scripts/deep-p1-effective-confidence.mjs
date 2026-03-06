/**
 * PR-P1-2: effective_confidence SSOT tests
 * Run: npx tsx scripts/deep-p1-effective-confidence.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const mod = await import('../src/lib/deep-result/effective-confidence.ts');
const { getEffectiveConfidence, toConfidenceSource, toConfidenceSourceFromDerived } = mod;

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

// Old-style: no confidence_breakdown → fallback to legacy confidence
const oldStyle = toConfidenceSource({
  confidence: 0.72,
  scores: { derived: {} },
});
ok('old-style effective === legacy', getEffectiveConfidence(oldStyle) === 0.72);

// New-style: confidence_breakdown.final_confidence present
const newStyle = toConfidenceSource({
  confidence: 0.5,
  scores: {
    derived: {
      confidence_breakdown: { final_confidence: 0.85 },
    },
  },
});
ok('new-style effective === final_confidence', getEffectiveConfidence(newStyle) === 0.85);

// Nested explainability
const nestedStyle = toConfidenceSource({
  confidence: 0.4,
  scores: {
    derived: {
      explainability: { confidence_breakdown: { final_confidence: 0.92 } },
    },
  },
});
ok('nested explainability effective', getEffectiveConfidence(nestedStyle) === 0.92);

// Demo derived
const demoDerived = toConfidenceSourceFromDerived({
  confidence: 0.68,
  confidence_breakdown: { final_confidence: 0.75 },
});
ok('demo derived effective', getEffectiveConfidence(demoDerived) === 0.75);

// Null/undefined safety
ok('null source → 0', getEffectiveConfidence(null) === 0);
ok('undefined source → 0', getEffectiveConfidence(undefined) === 0);
ok('empty derived fallback', getEffectiveConfidence(toConfidenceSourceFromDerived({})) === 0);

// Clamp
ok(
  'final_confidence clamped',
  getEffectiveConfidence({ confidence_breakdown: { final_confidence: 1.5 } }) === 1
);
ok(
  'final_confidence clamped low',
  getEffectiveConfidence({ confidence_breakdown: { final_confidence: -0.1 } }) === 0
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
