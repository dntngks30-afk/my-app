/**
 * PR-UX-22: Deep Result Language regression tests.
 * Run: npx tsx scripts/ux-22-deep-result-language-regression.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getCopy, buildDeepResultReasonBridge, buildFirstSessionBridge } = await import(
  '../src/lib/deep-result/copy.ts'
);

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

console.log('\n--- A. UPPER-LIMB no "상지 부위 경향" ---');
const upperCopy = getCopy('UPPER-LIMB');
ok('UPPER-LIMB badgeTitle not 상지 부위 경향', !upperCopy.badgeTitle.includes('상지 부위 경향'));
ok('UPPER-LIMB has 손목/팔꿈치', upperCopy.badgeTitle.includes('손목') || upperCopy.badgeTitle.includes('팔꿈치'));

console.log('\n--- B. UPPER-LIMB resultType anchor in reason bridge ---');
const reason = buildDeepResultReasonBridge('UPPER-LIMB', { upper_mobility: 1 }, null, []);
ok('reason bridge has UPPER anchor', reason?.bullets?.some((b) => b.includes('손목') || b.includes('팔꿈치')));

console.log('\n--- C. First session headline resultType-anchored ---');
const first = buildFirstSessionBridge('UPPER-LIMB', { upper_mobility: 1 }, null, []);
ok('first session headline has UPPER context', first?.headline?.includes('손목') || first?.headline?.includes('어깨'));

console.log('\n--- D. deconditioned/trunk user-friendly ---');
const decondCopy = getCopy('DECONDITIONED');
ok('DECONDITIONED not 통증 우세 경향', !decondCopy.badgeTitle.includes('통증 우세 경향'));
const trunkCopy = getCopy('LUMBO-PELVIS');
ok('LUMBO-PELVIS badge not 코어 컨트롤 부족 경향', !trunkCopy.badgeTitle.includes('코어 컨트롤 부족 경향'));

console.log('\n--- E. reason bridge resultType first ---');
const reasonWithAnchor = buildDeepResultReasonBridge('UPPER-LIMB', { trunk_control: 2 }, null, []);
const firstBullet = reasonWithAnchor?.bullets?.[0] ?? '';
ok('first bullet is resultType anchor (손목/팔꿈치)', firstBullet.includes('손목') || firstBullet.includes('팔꿈치'));

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
