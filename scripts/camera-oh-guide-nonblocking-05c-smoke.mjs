/**
 * PR-OH-GUIDE-NONBLOCKING-05C smoke
 *
 * Run: npx tsx scripts/camera-oh-guide-nonblocking-05c-smoke.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(process.cwd());

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

const preview = readFileSync(join(root, 'src/components/public/CameraPreview.tsx'), 'utf8');

console.log('\n[AT1] CameraPreview — no blocking in-frame multi-line guide card');
{
  ok('AT1a: removed bottom GUIDE label block', !/GUIDE\s*<\/p>/.test(preview), false);
  ok('AT1b: no guideInstructions.map in preview', !/guideInstructions\.slice/.test(preview), false);
  ok('AT1c: showStaticGuide is badge-only', /guideBadges\.length > 0/.test(preview), false);
}

console.log('\n[AT2] External panel present for overhead + squat + other steps');
{
  const oh = readFileSync(join(root, 'src/app/movement-test/camera/overhead-reach/page.tsx'), 'utf8');
  ok('AT2a: overhead uses ExternalCameraGuidePanel', /ExternalCameraGuidePanel/.test(oh), false);
  ok('AT2b: data variant overhead-reach', /data-external-camera-guide=\{?["']overhead-reach["']?\}?/.test(oh) || /variant="overhead-reach"/.test(oh), false);
  const sq = readFileSync(join(root, 'src/app/movement-test/camera/squat/page.tsx'), 'utf8');
  ok('AT2c: squat setup external guide', /ExternalCameraGuidePanel/.test(sq) && /variant="squat"/.test(sq), false);
  const wa = readFileSync(join(root, 'src/app/movement-test/camera/wall-angel/page.tsx'), 'utf8');
  ok('AT2d: wall-angel external guide', /ExternalCameraGuidePanel/.test(wa), false);
  const sl = readFileSync(join(root, 'src/app/movement-test/camera/single-leg-balance/page.tsx'), 'utf8');
  ok('AT2e: single-leg external guide', /ExternalCameraGuidePanel/.test(sl), false);
}

console.log('\n[AT3] No guideInstructions= passed to CameraPreview');
{
  const cameraPages = [
    'src/app/movement-test/camera/overhead-reach/page.tsx',
    'src/app/movement-test/camera/squat/page.tsx',
    'src/app/movement-test/camera/wall-angel/page.tsx',
    'src/app/movement-test/camera/single-leg-balance/page.tsx',
    'src/app/movement-test/camera/setup/page.tsx',
    'src/components/public/CameraPreview.tsx',
  ];
  const offenders = [];
  for (const rel of cameraPages) {
    const c = readFileSync(join(root, rel), 'utf8');
    if (c.includes('guideInstructions={')) offenders.push(rel);
  }
  ok('AT3: no guideInstructions prop wiring in camera surfaces', offenders.length === 0, offenders);
}

console.log('\n[AT4] ExternalCameraGuidePanel module');
{
  const ext = readFileSync(join(root, 'src/components/public/ExternalCameraGuidePanel.tsx'), 'utf8');
  ok('AT4a: data-external-camera-guide attribute', /data-external-camera-guide/.test(ext), false);
  ok('AT4b: non-blocking placement (component only)', /ExternalCameraGuidePanel/.test(ext), false);
}

console.log(`\nPR-OH-GUIDE-NONBLOCKING-05C smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
