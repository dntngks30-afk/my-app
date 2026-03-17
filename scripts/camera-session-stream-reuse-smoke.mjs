/**
 * PR G1: Camera session / stream reuse smoke test
 * Run: npx tsx scripts/camera-session-stream-reuse-smoke.mjs
 *
 * Verifies module structure and observability. Browser test required for
 * actual motion transition (Squat -> Overhead Reach) permission reuse.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

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

console.log('Camera session stream reuse smoke test\n');

// Module structure
const sessionModule = await import('../src/lib/camera/camera-session-context.tsx');
ok('CameraSessionProvider export', typeof sessionModule.CameraSessionProvider === 'function');
ok('useCameraSession export', typeof sessionModule.useCameraSession === 'function');
ok('getCameraSessionObservability export', typeof sessionModule.getCameraSessionObservability === 'function');

const obs = sessionModule.getCameraSessionObservability();
ok('Observability returns null in production or object in dev', obs === null || (typeof obs === 'object' && 'gumCallCount' in obs));

// Layout exists
const layoutPath = join(process.cwd(), 'src/app/movement-test/camera/layout.tsx');
const fs = await import('fs');
ok('Camera layout exists', fs.existsSync(layoutPath));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
