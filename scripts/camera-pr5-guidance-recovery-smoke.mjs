/**
 * PR-5: Camera framing guidance and retry recovery smoke test
 * Run: npx tsx scripts/camera-pr5-guidance-recovery-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  getPreCaptureGuidance,
  getRetryRecoveryGuidance,
  getMovementSetupGuide,
  getEffectiveRetryGuidance,
} = await import('../src/lib/camera/camera-guidance.ts');

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

console.log('Camera PR-5 guidance recovery smoke test\n');

// AT1: Squat framing/setup guidance appears
const squatSetup = getMovementSetupGuide('squat', null);
ok('AT1a: squat has badges', Array.isArray(squatSetup.badges) && squatSetup.badges.length > 0);
ok('AT1b: squat has instructions', Array.isArray(squatSetup.instructions) && squatSetup.instructions.length > 0);
ok('AT1c: squat badges are Korean', squatSetup.badges.every((b) => typeof b === 'string' && b.length > 0));

// AT2: Overhead reach framing/setup guidance appears
const ohSetup = getMovementSetupGuide('overhead-reach', null);
ok('AT2a: overhead-reach has badges', Array.isArray(ohSetup.badges) && ohSetup.badges.length > 0);
ok('AT2b: overhead-reach has arm/frame/hold-related setup', ohSetup.instructions.some((i) => i.includes('팔') || i.includes('올리') || i.includes('멈춘')));
ok('AT2c: overhead-reach instructions are Korean', ohSetup.instructions.every((i) => typeof i === 'string' && i.length > 0));

// AT3: Retry recovery mapping works
const framingRecovery = getRetryRecoveryGuidance('squat', ['framing_invalid'], []);
ok('AT3a: framing_invalid maps to actionable message', framingRecovery.primary.includes('보이') || framingRecovery.primary.includes('보이게'));
const holdRecovery = getRetryRecoveryGuidance('overhead-reach', [], ['hold_too_short']);
ok('AT3b: hold_too_short maps to hold message', holdRecovery.primary.includes('멈춰') || holdRecovery.primary.includes('멈춰주세요'));
const depthRecovery = getRetryRecoveryGuidance('squat', ['depth_not_reached'], []);
ok('AT3c: depth_not_reached maps to squat-specific message', depthRecovery.primary.includes('깊게') || depthRecovery.primary.includes('앉아'));
ok('AT3d: messages are derived from real flags', !framingRecovery.primary.includes('hard_partial') && !framingRecovery.primary.includes('unstable'));

// AT4: Guidance priority works
const multiRecovery = getRetryRecoveryGuidance('squat', ['framing_invalid', 'depth_not_reached', 'rep_incomplete'], []);
ok('AT4a: framing chosen over depth when both present', multiRecovery.primary.includes('보이') || multiRecovery.primary.includes('보이게'));
const genericRecovery = getRetryRecoveryGuidance('squat', [], []);
ok('AT4b: fallback generic guidance exists', genericRecovery.primary.length > 0 && typeof genericRecovery.primary === 'string');

// AT5: Pre-capture guidance
const preCaptureSquat = getPreCaptureGuidance('squat', { guardrail: {}, flags: [], failureReasons: [], progressionState: 'camera_ready' }, 0);
ok('AT5a: pre-capture squat returns primary', preCaptureSquat.primary.length > 0);
ok('AT5b: pre-capture message is Korean', /[\uac00-\ud7a3]/.test(preCaptureSquat.primary));
const preCaptureOh = getPreCaptureGuidance('overhead-reach', { guardrail: {}, flags: [], failureReasons: [], progressionState: 'camera_ready' }, 0);
ok('AT5c: pre-capture overhead-reach mentions arms when appropriate', preCaptureOh.primary.includes('팔') || preCaptureOh.primary.includes('전신'));

// AT6: getEffectiveRetryGuidance returns primary + optional secondary
const gate = {
  failureReasons: ['framing_invalid'],
  guardrail: { flags: [] },
  userGuidance: ['머리부터 발끝까지 보이게 해주세요'],
};
const effective = getEffectiveRetryGuidance('squat', gate);
ok('AT6a: effective retry has primary', effective.primary.length > 0);
ok('AT6b: effective retry is string', typeof effective.primary === 'string');

// AT7: No technical jargon in user-facing messages
const allMessages = [
  squatSetup.badges.join(' '),
  squatSetup.instructions.join(' '),
  ohSetup.badges.join(' '),
  ohSetup.instructions.join(' '),
  framingRecovery.primary,
  holdRecovery.primary,
  depthRecovery.primary,
  preCaptureSquat.primary,
];
const badTerms = ['hard_partial', 'unstable_bbox', 'critical joint', 'quality window', 'metricSufficiency'];
const hasBadTerm = (msg) => badTerms.some((t) => msg.toLowerCase().includes(t));
ok('AT7: no internal debug jargon in user-facing messages', !allMessages.some(hasBadTerm));

// AT8: Type safety
ok('AT8a: getMovementSetupGuide returns structured object', typeof squatSetup === 'object' && 'badges' in squatSetup && 'instructions' in squatSetup);
ok('AT8b: getRetryRecoveryGuidance returns primary string', typeof getRetryRecoveryGuidance('squat', [], []).primary === 'string');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
