import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const eventsModule = await import('../src/lib/analytics/events.ts');
const sanitizeModule = await import('../src/lib/analytics/sanitize.ts');
const events = eventsModule.default ?? eventsModule;
const sanitizer = sanitizeModule.default ?? sanitizeModule;

const { ANALYTICS_EVENT_NAMES } = events;
const { sanitizeAnalyticsEventInput, sanitizeAnalyticsProps } = sanitizer;

assert(
  ANALYTICS_EVENT_NAMES.includes('analytics_smoke_test'),
  'analytics_smoke_test must be in the allow-list'
);

const invalid = sanitizeAnalyticsEventInput({
  source: 'client',
  event_name: 'not_a_real_event',
});
assert.equal(invalid.ok, false, 'invalid event names must be rejected');

const valid = sanitizeAnalyticsEventInput({
  source: 'client',
  event_name: 'analytics_smoke_test',
  anon_id: 'anon-smoke',
  dedupe_key: 'analytics-smoke:anon-smoke',
  route_path: '/smoke',
  props: {
    stage: 'infra',
    step_index: 1,
    email: 'person@example.com',
    raw_trace: { unsafe: true },
    camera_trace: { unsafe: true },
    raw_scoring: { unsafe: true },
    exercise_logs: [{ unsafe: true }],
    stripe: { unsafe: true },
  },
});
assert.equal(valid.ok, true, 'valid smoke event should sanitize');
assert.equal(valid.event.anon_id, 'anon-smoke');
assert.equal(valid.event.dedupe_key, 'analytics-smoke:anon-smoke');
assert.equal(valid.event.props.stage, 'infra');
assert.equal(valid.event.props.step_index, 1);
assert.equal('email' in valid.event.props, false);
assert.equal('raw_trace' in valid.event.props, false);
assert.equal('camera_trace' in valid.event.props, false);
assert.equal('raw_scoring' in valid.event.props, false);
assert.equal('exercise_logs' in valid.event.props, false);
assert.equal('stripe' in valid.event.props, false);

const oversized = sanitizeAnalyticsProps({
  stage: 'oversized',
  ...Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => [`blob_${index}`, 'x'.repeat(512)])
  ),
});
assert.equal(oversized, null, 'oversized props must be rejected');

try {
  const trackedChanged = execFileSync('git', ['diff', '--name-only'], {
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const untrackedChanged = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard'],
    { encoding: 'utf8' }
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const changed = [...trackedChanged, ...untrackedChanged];
  const coreFunnelSmokeExists = changed.includes('scripts/analytics-core-funnel-tracking-smoke.mjs')
    || execFileSync('git', ['ls-files', 'scripts/analytics-core-funnel-tracking-smoke.mjs'], {
      encoding: 'utf8',
    }).trim() === 'scripts/analytics-core-funnel-tracking-smoke.mjs';
  if (!coreFunnelSmokeExists) {
    const forbidden = changed.filter((file) =>
      [
        'src/app/(main)/page.tsx',
        'src/app/movement-test/',
        'src/app/app/(tabs)/home/',
        'src/app/session-preparing/',
        'src/app/payments/',
        'src/app/onboarding',
      ].some((prefix) => file.startsWith(prefix))
    );
    assert.deepEqual(
      forbidden,
      [],
      `PR-1 must not modify product flow files: ${forbidden.join(', ')}`
    );
  }
} catch (err) {
  if (err instanceof assert.AssertionError) throw err;
  console.warn('[analytics-event-infra-smoke] git diff check skipped');
}

console.log('analytics-event-infra-smoke: ok');
