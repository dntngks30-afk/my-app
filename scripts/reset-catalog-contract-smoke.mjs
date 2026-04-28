/**
 * Reset stretch/issue catalog 무결성 스모크 (PR-RESET-BE-01).
 * Run: npx tsx scripts/reset-catalog-contract-smoke.mjs
 *
 * DB/API 없이 코드 SSOT만 검증한다.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const stretchMod = await import('../src/lib/reset/reset-stretch-catalog.ts');
const issueMod = await import('../src/lib/reset/reset-issue-catalog.ts');

const { RESET_STRETCH_CATALOG } = stretchMod;
const { RESET_ISSUE_CATALOG } = issueMod;

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

function fail(msg) {
  failed++;
  console.error(`  ✗ ${msg}`);
}

// --- Stretch catalog ---
const stretchKeys = RESET_STRETCH_CATALOG.map((r) => r.stretch_key);
const stretchSet = new Set(stretchKeys);

ok('RESET_STRETCH_CATALOG length === 10', RESET_STRETCH_CATALOG.length === 10);
ok('stretch_key unique', stretchKeys.length === stretchSet.size);

for (const row of RESET_STRETCH_CATALOG) {
  if ('media_status' in row) {
    fail(`stretch ${row.stretch_key}: media_status 필드는 카탈로그에 저장하지 않음`);
  }
}

ok('모든 스트레치 template_id === null', RESET_STRETCH_CATALOG.every((r) => r.template_id === null));

// --- Issue catalog ---
const issueKeys = RESET_ISSUE_CATALOG.map((i) => i.issue_key);
const issueKeySet = new Set(issueKeys);

ok('RESET_ISSUE_CATALOG length === 10', RESET_ISSUE_CATALOG.length === 10);
ok('issue_key unique', issueKeys.length === issueKeySet.size);

const badAltLength = RESET_ISSUE_CATALOG.filter(
  (i) => !Array.isArray(i.alternative_stretch_keys) || i.alternative_stretch_keys.length !== 2,
);
for (const i of badAltLength) {
  const n = Array.isArray(i.alternative_stretch_keys) ? i.alternative_stretch_keys.length : 'non-array';
  console.error(
    `  ✗ issue ${i.issue_key}: alternative_stretch_keys.length === 2 아님 (현재 ${n})`,
  );
}
ok('각 이슈 alternative_stretch_keys.length === 2 (엄격)', badAltLength.length === 0);

for (const issue of RESET_ISSUE_CATALOG) {
  const alt = issue.alternative_stretch_keys;
  if (!Array.isArray(alt) || alt.length !== 2) {
    continue;
  }

  const refs = [issue.primary_stretch_key, alt[0], alt[1]];

  const refSet = new Set(refs);
  if (refSet.size !== refs.length) {
    fail(`issue ${issue.issue_key}: primary와 alternative 간 stretch_key 중복`);
  }

  for (const k of refs) {
    if (!stretchSet.has(k)) {
      fail(`issue ${issue.issue_key}: 알 수 없는 stretch_key 참조 → ${k}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
