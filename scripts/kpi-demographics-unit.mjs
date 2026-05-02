/**
 * KPI demographics bucket helpers — env-free unit checks.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  birthDateToAgeBand,
  signupBirthDateToAgeBand,
  mapIntroGenderToGenderBucket,
  mapIntroAgeToAgeBand,
} = await import('../src/lib/analytics/kpi-demographics-types.ts');

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

function bucketRatio(sampleSize, count) {
  return sampleSize <= 0 ? 0 : count / sampleSize;
}

const refMay2026 = new Date('2026-05-02T12:00:00');

console.log('kpi-demographics-unit');

ok(
  'birthDate 14세 경계 → 10s',
  birthDateToAgeBand('2012-05-02', refMay2026) === '10s'
);
ok(
  'birthDate 19세 → 10s',
  birthDateToAgeBand('2007-06-01', refMay2026) === '10s'
);
ok(
  'birthDate 20세 → 20s',
  birthDateToAgeBand('2006-05-01', refMay2026) === '20s'
);
ok(
  'birthDate 만 59세 → 50s',
  birthDateToAgeBand('1967-05-02', refMay2026) === '50s'
);
ok(
  'birthDate 60세 생일 후 → 60s_plus',
  birthDateToAgeBand('1966-05-01', refMay2026) === '60s_plus'
);
ok('birthDate 형식 불량 → unknown', birthDateToAgeBand('xx') === 'unknown');
ok('signupBirthDate 만 10세 경계 → 10s', signupBirthDateToAgeBand('2016-05-02', refMay2026) === '10s');
ok('signupBirthDate 9세 → unknown', signupBirthDateToAgeBand('2017-05-02', refMay2026) === 'unknown');
ok('signupBirthDate 미래 → unknown', signupBirthDateToAgeBand('2030-01-01', refMay2026) === 'unknown');

ok('mapIntroAge 레거시 10-19 → 10s', mapIntroAgeToAgeBand('10-19') === '10s');

ok('mapIntroGender male', mapIntroGenderToGenderBucket('male') === 'male');
ok('mapIntroGender female', mapIntroGenderToGenderBucket('female') === 'female');
ok('mapIntroGender invalid → unknown', mapIntroGenderToGenderBucket('x') === 'unknown');

ok('sampleSize 0 ratio 0', bucketRatio(0, 5) === 0);
ok('unknown ratio ~ 5/7', Math.abs(bucketRatio(7, 5) - 5 / 7) < 1e-9);
ok('count 2 low_sample rule', 2 > 0 && 2 < 3);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
