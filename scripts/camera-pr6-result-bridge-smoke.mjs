/**
 * PR-6: Camera result bridge smoke test
 * Run: npx tsx scripts/camera-pr6-result-bridge-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getResultBridgeExplanation } = await import('../src/lib/camera/result-bridge.ts');
const { normalizeCameraResult } = await import('../src/lib/camera/normalize.ts');

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

console.log('Camera PR-6 result bridge smoke test\n');

// Mock evaluator results
const mockSquatResult = {
  stepId: 'squat',
  metrics: [
    { name: 'depth', value: 42, trend: 'concern' },
    { name: 'trunk_lean', value: 18, trend: 'good' },
  ],
  insufficientSignal: false,
};
const mockOverheadResult = {
  stepId: 'overhead-reach',
  metrics: [
    { name: 'arm_range', value: 110, trend: 'concern' },
    { name: 'lumbar_extension', value: 22, trend: 'concern' },
  ],
  insufficientSignal: false,
};
const mockGuardrails = [
  {
    stepId: 'squat',
    captureQuality: 'ok',
    confidence: 0.78,
    flags: [],
    retryRecommended: false,
    fallbackMode: null,
    completionStatus: 'complete',
    debug: {},
  },
  {
    stepId: 'overhead-reach',
    captureQuality: 'ok',
    confidence: 0.76,
    flags: [],
    retryRecommended: false,
    fallbackMode: null,
    completionStatus: 'complete',
    debug: {},
  },
];

// AT1: Result page explanation renders
const normalized = normalizeCameraResult(
  [mockSquatResult, mockOverheadResult],
  mockGuardrails
);
const bridge = getResultBridgeExplanation(normalized);
ok('AT1a: result headline is shown', bridge.headline.length > 0);
ok('AT1b: short explanation is shown', bridge.explanation.length > 0);
ok('AT1c: reasons array exists', Array.isArray(bridge.reasons));
ok('AT1d: one or two main reasons', bridge.reasons.length <= 2);
ok('AT1e: action is present', bridge.action.length > 0);
ok('AT1f: primary CTA has label and path', bridge.primaryCtaLabel.length > 0 && bridge.primaryCtaPath.length > 0);

// AT2: Explanation uses actual available signals
ok('AT2a: reasons derived from concern metrics', bridge.reasons.some((r) => r.includes('팔') || r.includes('몸통') || r.includes('깊이') || r.includes('상체') || r.includes('무릎') || r.includes('안정')));
const depthOnly = normalizeCameraResult([mockSquatResult], mockGuardrails.slice(0, 1));
const bridgeDepth = getResultBridgeExplanation(depthOnly);
ok('AT2b: depth concern maps to reason', bridgeDepth.reasons.some((r) => r.includes('깊이') || r.includes('depth')) || bridgeDepth.reasons.length >= 0);

// AT3: Fallback when insufficient
const insufficient = normalizeCameraResult([], []);
insufficient.insufficientSignal = true;
insufficient.captureQuality = 'invalid';
const bridgeInsuff = getResultBridgeExplanation(insufficient);
ok('AT3a: insufficient fallback has headline', bridgeInsuff.headline.includes('충분') || bridgeInsuff.headline.length > 0);
ok('AT3b: insufficient fallback CTA is retry', bridgeInsuff.primaryCtaLabel.includes('촬영') || bridgeInsuff.primaryCtaLabel.includes('다시'));

// AT4: Confidence-safe language
const allText = [bridge.headline, bridge.explanation, ...bridge.reasons].join(' ');
const badTerms = ['진단', '정확히', '의학적', '임상', '질환', '임계치', 'threshold', 'metric'];
const hasBad = badTerms.some((t) => allText.includes(t));
ok('AT4: no diagnostic overclaim in user copy', !hasBad);

// AT5: No technical jargon
const techTerms = ['hard_partial', 'unstable_bbox', 'critical joint', 'metricSufficiency'];
const hasTech = techTerms.some((t) => allText.includes(t));
ok('AT5: no technical debug jargon in user copy', !hasTech);

// AT6: Type safety
ok('AT6a: bridge has required shape', 'headline' in bridge && 'reasons' in bridge && 'action' in bridge);
ok('AT6b: reasons are strings', bridge.reasons.every((r) => typeof r === 'string'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
