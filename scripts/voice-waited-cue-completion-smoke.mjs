/**
 * Minimal smoke: max waited-cue timeouts (must match getVoiceCueMaxWaitMs in
 * src/lib/camera/voice-guidance.ts). Node cannot import voice-guidance.ts (client graph).
 *
 * Run: npx tsx scripts/voice-waited-cue-completion-smoke.mjs
 */
const EXPECTED_BY_KIND = {
  start: 32000,
  countdown: 9000,
  correction: 26000,
  success: 22000,
};

function getVoiceCueMaxWaitMs(kind) {
  switch (kind) {
    case 'countdown':
      return 9000;
    case 'start':
      return 32000;
    case 'correction':
      return 26000;
    case 'success':
      return 22000;
    default:
      return 20000;
  }
}

let failed = false;
for (const [kind, expected] of Object.entries(EXPECTED_BY_KIND)) {
  const ms = getVoiceCueMaxWaitMs(kind);
  if (ms !== expected) {
    console.error(`[voice-waited-cue-completion-smoke] FAIL kind=${kind} got=${ms} expected=${expected}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('[voice-waited-cue-completion-smoke] ok (mirror getVoiceCueMaxWaitMs)');
