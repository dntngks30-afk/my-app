import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function includes(path, needle, message) {
  assert(read(path).includes(needle), message ?? `${path} must include ${needle}`);
}

includes(
  'src/app/api/public-test-profile/route.ts',
  'pilotCode',
  'public-test-profile route must accept pilotCode'
);
includes(
  'src/app/api/public-test-profile/route.ts',
  'sanitizePilotCode',
  'public-test-profile route must sanitize pilotCode'
);
includes(
  'src/lib/analytics/public-test-profile.ts',
  "KPI_DEMOGRAPHIC_PROFILE_SOURCE = 'free_test_intro'",
  'public profile source contract must remain free_test_intro'
);
includes(
  'src/lib/analytics/public-test-profile.ts',
  'pilot_code: input.pilotCode ?? null',
  'public profile upsert must persist pilot_code'
);
includes(
  'src/lib/analytics/public-test-profile.ts',
  'linkPublicTestProfileAnonToUser',
  'public profile anon->user link helper must exist'
);
includes(
  'src/app/api/auth/pilot-signup/route.ts',
  'linkPublicTestProfileAnonToUser',
  'pilot signup must link public profile by anonId'
);
includes(
  'src/lib/analytics/signup-profile.ts',
  "KPI_SIGNUP_PROFILE_SOURCE = 'signup_profile'",
  'signup profile source contract must remain signup_profile'
);
includes(
  'src/lib/analytics/signup-profile.ts',
  'pilot_code: input.pilotCode ?? null',
  'signup profile upsert must persist pilot_code'
);
includes(
  'src/components/auth/AuthCard.tsx',
  'anonId',
  'AuthCard signup payload must include anonId'
);
includes(
  'src/components/auth/AuthCard.tsx',
  'pilotCode',
  'AuthCard signup payload must include pilotCode'
);
includes(
  'src/lib/analytics/trackAuthenticatedEvent.ts',
  'Authorization: `Bearer ${token}`',
  'authenticated tracking must attach Bearer token'
);
includes(
  'src/lib/analytics/admin-kpi-demographics.ts',
  'unknown_age_or_gender_count',
  'KPI demographics must expose free profile coverage'
);
includes(
  'src/lib/analytics/admin-kpi-demographics.ts',
  'unknown_signup_profile_count',
  'KPI demographics must expose signup profile coverage'
);
includes(
  'supabase/migrations/20260502153000_profile_pilot_code.sql',
  'public_test_profiles_pilot_code_idx',
  'migration must index public_test_profiles.pilot_code'
);
includes(
  'supabase/migrations/20260502153000_profile_pilot_code.sql',
  'signup_profiles_pilot_code_idx',
  'migration must index signup_profiles.pilot_code'
);

console.log('analytics-kpi-profile-collection-smoke: ok');
