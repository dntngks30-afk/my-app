/**
 * PR-M18-RATIONALE-POLISH-01: reconciled dual-axis rationale must not contain "세션고".
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://smoke.placeholder.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'smoke-placeholder-anon-key';
}

const { buildReconciledRationale } = await import('../src/lib/session/final-plan-display-reconciliation.ts');

const line = buildReconciledRationale(['lower_stability', 'trunk_control'], {
  lower_stability: 10,
  trunk_control: 7,
});

if (!line || typeof line !== 'string') {
  console.error('Expected string from buildReconciledRationale');
  process.exit(1);
}
if (line.includes('세션고')) {
  console.error('FAIL: rationale still contains 세션고:', line);
  process.exit(1);
}
if (!line.includes('이며') && !line.includes('이고')) {
  console.warn('Note: expected connective 이며/이고 in:', line);
}
console.log('OK session rationale copy smoke:', line.slice(0, 80) + '…');
process.exit(0);
