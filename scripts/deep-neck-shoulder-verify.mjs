/**
 * Verify v3 returns NECK-SHOULDER for neck/shoulder-heavy cases
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const fixtures = JSON.parse(readFileSync(join(projectRoot, 'src/lib/deep-test/golden/fixtures.json'), 'utf8'));
const neckCases = fixtures.filter(
  (f) =>
    f.expected?.result_type === 'NECK-SHOULDER' &&
    (f.answers.deep_basic_primary_discomfort || '').includes('목·어깨') &&
    ((f.answers.deep_wallangel_quality || '').includes('어깨가 들리') || (f.answers.deep_wallangel_quality || '').includes('목이 긴장'))
);

const dv = await import('../src/lib/deep-test/scoring/deep_v3.ts');
let ok = 0;
for (const fx of neckCases) {
  const v3 = dv.calculateDeepV3(fx.answers);
  const pass = v3.result_type === 'NECK-SHOULDER' && v3.primaryFocus === 'NECK-SHOULDER';
  if (pass) ok++;
  console.log(`${pass ? '✓' : '✗'} ${fx.id}: result_type=${v3.result_type} primaryFocus=${v3.primaryFocus}`);
}
console.log(`\n${ok}/${neckCases.length} neck-shoulder cases return NECK-SHOULDER`);
process.exit(ok === neckCases.length ? 0 : 1);
