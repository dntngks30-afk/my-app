/**
 * PR-OH-CAPTURE-PROTOCOL-CONTRACT-05B smoke
 *
 * Run: npx tsx scripts/camera-oh-capture-protocol-contract-05b-smoke.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getMovementSetupGuide, getPreCaptureGuidance, getRetryRecoveryGuidance } = await import(
  '../src/lib/camera/camera-guidance.ts'
);
const { OVERHEAD_CAPTURE_PROTOCOL_SOFT_REMINDERS } = await import('../src/lib/camera/setup-framing.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

const mockGate = {
  guardrail: { flags: [], captureQuality: 'valid' },
  failureReasons: [],
  progressionState: 'camera_ready',
};

console.log('\n[AT1] Overhead setup contract copy');
{
  const g = getMovementSetupGuide('overhead-reach', mockGate);
  ok('AT1a: four instruction lines', g.instructions.length === 4, g.instructions.length);
  const blob = g.instructions.join(' ');
  ok('AT1b: mentions distance / not cropped', /떨어져|잘리지|여유/i.test(blob), blob.slice(0, 80));
  ok('AT1c: mentions frontal side path not forward-only', /머리 옆|앞으로 밀지/i.test(blob), blob.slice(0, 80));
  ok('AT1d: mentions face/head + wrists together', /얼굴|머리|손목/i.test(blob), blob.slice(0, 80));
  ok('AT1e: four badges', g.badges.length === 4, g.badges);
}

console.log('\n[AT2] Pre-capture overhead (first frames)');
{
  const p = getPreCaptureGuidance('overhead-reach', mockGate, 0);
  ok('AT2a: primary has distance/frontal', /정면|떨어져|손목|화면/i.test(p.primary), p.primary);
  ok('AT2b: secondary headroom', /머리 위|여유/i.test(p.secondary ?? ''), p.secondary);
}

console.log('\n[AT3] Retry recovery — model-visible wording');
{
  const r = getRetryRecoveryGuidance('overhead-reach', ['rep_incomplete'], []);
  ok('AT3a: rep_incomplete primary mentions step back / beside head', /뒤로|머리 옆/i.test(r.primary), r.primary);
  ok('AT3b: secondary mentions face + pause', /얼굴|멈춰|손목/i.test(r.secondary ?? ''), r.secondary);
  const h = getRetryRecoveryGuidance('overhead-reach', [], ['hold_too_short']);
  ok('AT3c: hold_too_short secondary visibility', /손|얼굴|화면/i.test(h.secondary ?? ''), h.secondary);
}

console.log('\n[AT4] Wiring — page + CameraPreview (05C: 외부 가이드 패널)');
{
  const pagePath = join(process.cwd(), 'src/app/movement-test/camera/overhead-reach/page.tsx');
  const src = readFileSync(pagePath, 'utf8');
  ok('AT4a: overheadPreviewInstructions memo', /overheadPreviewInstructions/.test(src), false);
  ok('AT4b: ExternalCameraGuidePanel + overhead variant', /ExternalCameraGuidePanel/.test(src) && /variant="overhead-reach"/.test(src), false);
  ok('AT4c: guideBadges from setupGuide', /guideBadges=\{setupGuide\.badges\}/.test(src), false);
  ok('AT4d: showProtocolGuideInMinimal', /showProtocolGuideInMinimal=\{isMinimalCapture\}/.test(src), false);
  const prevPath = join(process.cwd(), 'src/components/public/CameraPreview.tsx');
  const prev = readFileSync(prevPath, 'utf8');
  ok('AT4e: CameraPreview prop showProtocolGuideInMinimal', /showProtocolGuideInMinimal\?:/.test(prev), false);
  ok('AT4f: allowStaticGuide uses prop', /showProtocolGuideInMinimal/.test(prev), false);
}

console.log('\n[AT5] Silhouette + soft reminders');
{
  const prevPath = join(process.cwd(), 'src/components/public/CameraPreview.tsx');
  const prev = readFileSync(prevPath, 'utf8');
  ok('AT5a: overhead silhouette vertical shift', /translate\(0 -14\)/.test(prev), false);
  ok('AT5b: wrist path slightly more vertical', /108 52/.test(prev), false);
  ok('AT5c: soft reminders exported', OVERHEAD_CAPTURE_PROTOCOL_SOFT_REMINDERS.length >= 2, OVERHEAD_CAPTURE_PROTOCOL_SOFT_REMINDERS.length);
}

console.log('\n[AT6] Squat setup guide unchanged shape');
{
  const g = getMovementSetupGuide('squat', mockGate);
  ok('AT6a: squat still three instructions', g.instructions.length === 3, g.instructions.length);
  ok('AT6b: squat badges unchanged count', g.badges.length === 3, g.badges);
}

console.log(`\nPR-OH-CAPTURE-PROTOCOL-CONTRACT-05B smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
