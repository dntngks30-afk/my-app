/**
 * PR-WEB-PERF-01B — static checks for public funnel image warmup (no dev server).
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
    blockers.push(`missing file: ${rel}`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

const preload = read('src/lib/public/preload-images.ts');
if (!preload.includes('export function warmupImages')) {
  blockers.push('preload-images.ts must export warmupImages');
}

const welcome = read('src/components/stitch/intro/IntroWelcome.tsx');
const introPaths = [
  '/intro/good-pattern-lift.png',
  '/intro/compensation-lift.png',
  '/intro/balanced-alignment.png',
  '/intro/asymmetric-compensation.png',
];
for (const p of introPaths) {
  if (!welcome.includes(p)) {
    blockers.push(`IntroWelcome.tsx must include warmup path: ${p}`);
  }
}
if (!welcome.includes('warmupImages')) {
  blockers.push('IntroWelcome.tsx must call warmupImages');
}

const renderer = read('src/components/public-result/PublicResultRenderer.tsx');
if (!renderer.includes("from '@/lib/public/preload-images'") && !renderer.includes('from "@/lib/public/preload-images"')) {
  blockers.push('PublicResultRenderer must import warmupImages from @/lib/public/preload-images');
}
if (!renderer.includes('warmupImages')) {
  blockers.push('PublicResultRenderer must use warmupImages');
}
if (renderer.includes('RESULT_STEP3_ASSETS_BY_PRIMARY')) {
  blockers.push('PublicResultRenderer must not reference RESULT_STEP3_ASSETS_BY_PRIMARY (no full-map warmup)');
}
if (/Object\.values\s*\(\s*RESULT_STEP3_ASSETS_BY_PRIMARY\s*\)/.test(renderer)) {
  blockers.push('PublicResultRenderer must not Object.values(RESULT_STEP3_ASSETS_BY_PRIMARY)');
}

const step3Assets = read('src/components/public-result/result-step3-assets.ts');
if (step3Assets.includes('warmupImages')) {
  blockers.push('result-step3-assets.ts must not import or call warmupImages');
}

const layout = read('src/app/layout.tsx');
const preloadLink = /<link[^>]+rel\s*=\s*["']preload["'][^>]*>/gi;
let m;
while ((m = preloadLink.exec(layout)) !== null) {
  const tag = m[0];
  if (tag.includes('/intro/') || tag.includes('result-step3')) {
    blockers.push('layout.tsx must not preload intro or result-step3 images via link preload');
  }
}

const step3Scene = read('src/components/stitch/result/BaselineResultStep3ScrollScene.tsx');
const priorityCount = (step3Scene.match(/\bpriority\b/g) ?? []).length;
if (priorityCount > 0) {
  blockers.push(
    `avoid adding next/image priority in BaselineResultStep3ScrollScene (found ${priorityCount} "priority" token(s))`,
  );
}

console.log('PR-WEB-PERF-01B PUBLIC IMAGE WARMUP SMOKE');
if (blockers.length) {
  console.error('BLOCKERS:');
  for (const b of blockers) console.error(`- ${b}`);
  process.exit(1);
}
console.log('OK: static checks passed');
