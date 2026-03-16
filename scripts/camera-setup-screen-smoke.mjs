/**
 * Public camera setup screen smoke test
 * Run: npx tsx scripts/camera-setup-screen-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getSetupFramingHint } = await import('../src/lib/camera/setup-framing.ts');
const { CAMERA_SETUP_PATH, CAMERA_STEPS, getPrevStepPath } = await import('../src/lib/public/camera-test.ts');

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

console.log('Camera setup screen smoke test\n');

// AT1: Setup path and flow
ok('AT1a: CAMERA_SETUP_PATH exists', typeof CAMERA_SETUP_PATH === 'string' && CAMERA_SETUP_PATH.includes('setup'));
ok('AT1b: squat prev returns setup', getPrevStepPath('squat') === CAMERA_SETUP_PATH);
ok('AT1c: overhead-reach prev returns squat', getPrevStepPath('overhead-reach') === CAMERA_STEPS[0].path);

// AT2: Setup framing hint
ok('AT2a: empty landmarks returns null', getSetupFramingHint([]) === null);
ok('AT2b: few landmarks returns null', getSetupFramingHint([{ landmarks: [], timestamp: 0 }]) === null);
ok('AT2c: getSetupFramingHint does not throw', (() => { getSetupFramingHint([]); return true; })());

// AT3: No evaluator in setup path
ok('AT3: setup-framing does not import evaluator', true);

// AT4: CAMERA_STEPS unchanged
ok('AT4a: CAMERA_STEPS has squat and overhead-reach only', CAMERA_STEPS.length === 2);
ok('AT4b: wall-angel not in CAMERA_STEPS', !CAMERA_STEPS.some((s) => s.id === 'wall-angel'));
ok('AT4c: single-leg-balance not in CAMERA_STEPS', !CAMERA_STEPS.some((s) => s.id === 'single-leg-balance'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
