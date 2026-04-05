/**
 * PR-OH-VISUAL-SNAPSHOT-06C: bounded snapshot bundle + linkage smoke (no browser).
 * Run: npx tsx scripts/oh-visual-snapshot-06c-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildOverheadVisualTruthSnapshotBundle } = await import(
  '../src/lib/camera/overhead/visual-snapshot-export.ts'
);
const { assessStepGuardrail } = await import('../src/lib/camera/guardrails.ts');
const { evaluateOverheadReachFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/overhead-reach.ts'
);
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');

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

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

function overheadPoseLandmarks(timestamp, armAngle) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) =>
      mockLandmark(0.4 + (j % 11) * 0.02, 0.2 + Math.floor(j / 11) * 0.08, 0.9)
    );
  lm[11] = mockLandmark(0.4, 0.25, 0.9);
  lm[12] = mockLandmark(0.6, 0.25, 0.9);
  lm[13] = mockLandmark(0.35, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[14] = mockLandmark(0.65, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[15] = mockLandmark(0.3, 0.15, 0.9);
  lm[16] = mockLandmark(0.7, 0.15, 0.9);
  return { landmarks: lm, timestamp };
}

function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}

const OH_STATS = {
  sampledFrameCount: 25,
  droppedFrameCount: 0,
  captureDurationMs: 1500,
  timestampDiscontinuityCount: 0,
  landmarkOrAdaptorFailedFrameCount: 0,
  validFrameCount: 25,
  filteredLowQualityFrameCount: 0,
  unstableFrameCount: 0,
};

/** Tiny valid JPEG data URL for bundle tests */
const PLACEHOLDER_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAAP/Z';

console.log('PR-OH-VISUAL-SNAPSHOT-06C smoke test\n');

const realOhPoses = Array(20)
  .fill(0)
  .map((_, i) => overheadPoseLandmarks(100 + i * 60, Math.min(160, 40 + i * 6)));
const realOhLandmarks = toLandmarks(realOhPoses);
const realResult = evaluateOverheadReachFromPoseFrames(
  buildPoseFeaturesFrames('overhead-reach', realOhLandmarks)
);
const realGr = assessStepGuardrail('overhead-reach', realOhLandmarks, OH_STATS, realResult);
const vtc = realGr.debug?.visualTruthCandidates;

const parallelUrls = realOhLandmarks.map(() => PLACEHOLDER_JPEG);
const bundle = buildOverheadVisualTruthSnapshotBundle(vtc, parallelUrls, { maxSnapshots: 4 });

ok('A: bundle links to 06B version', bundle?.linkedVisualTruthVersion === vtc?.version);
ok('B: bounded snapshot count', bundle != null && bundle.snapshots.length >= 2 && bundle.snapshots.length <= 4);
const armIdx = vtc?.globalBestArmElevation?.frameIndex;
const selIdx = vtc?.selectedWindowBest?.frameIndex;
const headIdx = vtc?.globalBestHeadRelative?.frameIndex;
const armTagMergedIntoSelected =
  typeof armIdx === 'number' && typeof selIdx === 'number' && armIdx === selIdx;
const headMergedIntoArm =
  typeof headIdx === 'number' && typeof armIdx === 'number' && headIdx === armIdx;
const headMergedIntoSelected =
  typeof headIdx === 'number' && typeof selIdx === 'number' && headIdx === selIdx;
ok(
  'C: selected + arm tags (dedupe preserves first tag per frameIndex)',
  bundle != null &&
    bundle.snapshots.some((s) => s.candidateTag === 'selectedWindowBest') &&
    (bundle.snapshots.some((s) => s.candidateTag === 'globalBestArmElevation') || armTagMergedIntoSelected) &&
    (bundle.snapshots.some((s) => s.candidateTag === 'globalBestHeadRelative') ||
      headMergedIntoArm ||
      headMergedIntoSelected)
);
ok(
  'D: each snapshot has metrics + overlay metadata',
  bundle != null &&
    bundle.snapshots.every(
      (s) =>
        s.metricsEcho != null &&
        typeof s.frameIndex === 'number' &&
        typeof s.timestampMs === 'number' &&
        s.overlayLandmarks != null &&
        'nose' in s.overlayLandmarks &&
        s.imageDataUrl.startsWith('data:image/jpeg')
    )
);
ok(
  'E: frameIndex aligns with parallel buffer',
  bundle != null &&
    bundle.snapshots.every((s) => s.frameIndex >= 0 && s.frameIndex < parallelUrls.length)
);

const emptyBundle = buildOverheadVisualTruthSnapshotBundle(vtc, realOhLandmarks.map(() => ''));
ok('F: no JPEG → null bundle', emptyBundle === null);

ok(
  'G: maxSnapshots cap respected',
  buildOverheadVisualTruthSnapshotBundle(vtc, parallelUrls, { maxSnapshots: 2 })?.snapshots.length === 2
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
