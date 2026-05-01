/**
 * PR-WEB-PERF-02 — landing readiness single-flight + route prefetch (static checks).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const blockers = [];

function read(rel) {
  const p = join(root, ...rel.split('/'));
  if (!existsSync(p)) {
    blockers.push(`missing: ${rel}`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

const cta = read('src/components/landing/LandingReturnHomeCta.tsx');
if (cta.includes('fetchReadinessClient')) blockers.push('LandingReturnHomeCta must not import fetchReadinessClient');
if (cta.includes('useEffect')) blockers.push('LandingReturnHomeCta must not use useEffect');
if (cta.includes('useState')) blockers.push('LandingReturnHomeCta must not use useState');
if (!cta.includes('canReturnHome')) blockers.push('LandingReturnHomeCta must accept canReturnHome');

const page = read('src/app/(main)/page.tsx');
if (!page.includes('readinessPromiseRef')) blockers.push('page.tsx should use readinessPromiseRef (single-flight)');
const fetchCalls = page.match(/fetchReadinessClient\s*\(/g);
if (!fetchCalls || fetchCalls.length !== 1) {
  blockers.push(`page.tsx must call fetchReadinessClient( exactly once (found ${fetchCalls ? fetchCalls.length : 0})`);
}
if (!page.includes('loadReadinessOnce')) blockers.push('page.tsx must define loadReadinessOnce');
if (!page.includes('await loadReadinessOnce()')) blockers.push('handleStart must await loadReadinessOnce()');
if (!page.includes("router.prefetch('/intro/welcome')")) blockers.push('missing prefetch /intro/welcome');
if (!page.includes("router.prefetch('/movement-test/survey')")) blockers.push('missing prefetch /movement-test/survey');
if (!page.includes("router.prefetch('/app/auth')")) blockers.push('missing prefetch /app/auth');
if (page.includes("router.prefetch('/movement-test/baseline')")) blockers.push('baseline prefetch must not be added');
if (page.includes("router.prefetch('/movement-test/refine-bridge')")) blockers.push('refine-bridge prefetch excluded in PR02');
if (!page.includes('supabaseBrowser.auth.signOut()')) blockers.push('fresh-start signOut must remain');

const stitch = read('src/components/stitch/landing/StitchLanding.tsx');
if (!stitch.includes('isStarting')) blockers.push('StitchLanding must define isStarting prop');
if (!stitch.includes('disabled={isStarting}')) blockers.push('StitchLanding button must use disabled={isStarting}');
if (!stitch.includes('aria-busy={isStarting}')) blockers.push('StitchLanding button must use aria-busy={isStarting}');

if (blockers.length) {
  console.error('PR-WEB-PERF-02 LANDING READINESS CACHE PREFETCH SMOKE');
  for (const b of blockers) console.error(`BLOCKER: ${b}`);
  process.exit(1);
}

console.log('PR-WEB-PERF-02 LANDING READINESS CACHE PREFETCH SMOKE');
console.log('OK');
