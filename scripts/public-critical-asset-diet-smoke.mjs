import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const layoutPath = path.join(root, 'src/app/layout.tsx');
const layout = fs.readFileSync(layoutPath, 'utf8');

const runRg = (pattern, targets) => {
  const result = spawnSync('rg', ['-n', pattern, ...targets, '-g', '!node_modules'], { cwd: root, encoding: 'utf8' });
  if (result.status === 1) return [];
  if (result.status !== 0) throw new Error(`rg failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout.split('\n').filter(Boolean);
};

const forbiddenLayoutStrings = ['kakao_js_sdk', 'window.Kakao', 'NEXT_PUBLIC_KAKAO_JS_KEY'];
const removedFontImports = ['Geist_Mono', 'IBM_Plex_Sans_KR', 'Gowun_Dodum', 'Gothic_A1', 'Nanum_Gothic', 'Jua', 'Do_Hyeon', 'Nanum_Pen_Script'];
const removedFontVars = ['--font-geist-mono', '--font-sans-ibm', '--font-display-gowun', '--font-sans-gothicA1', '--font-sans-nanumGothic', '--font-display-jua', '--font-display-dohyeon', '--font-display-nanumPen'];

for (const token of forbiddenLayoutStrings) if (layout.includes(token)) throw new Error(`layout.tsx still contains forbidden token: ${token}`);
for (const fontImport of removedFontImports) if (layout.includes(fontImport)) throw new Error(`layout.tsx still imports removed font family: ${fontImport}`);

const htmlClassMatch = layout.match(/<html[\s\S]*?className=\{`([\s\S]*?)`\}/);
if (!htmlClassMatch) throw new Error('Could not find <html className={``}> block in layout.tsx');
for (const fontVar of removedFontVars) if (htmlClassMatch[1].includes(fontVar)) throw new Error(`Removed font variable still present in html className: ${fontVar}`);

const forbiddenRepoTokens = ['window.Kakao', 'Kakao.init', 'kakao_js_sdk', 'NEXT_PUBLIC_KAKAO_JS_KEY'];
const repoTokenLines = runRg(forbiddenRepoTokens.join('|'), ['src', 'scripts']);
for (const line of repoTokenLines) {
  if (line.startsWith('scripts/public-critical-asset-diet-smoke.mjs:')) continue;
  if (!line.startsWith('src/app/layout.tsx:')) throw new Error(`Forbidden Kakao token exists outside layout.tsx: ${line}`);
}

const repoFontLines = runRg(removedFontVars.map((v) => v.replaceAll('-', '\\-')).join('|'), ['src', 'scripts', 'docs']);
const nonLayoutRefs = repoFontLines.filter((line) => !line.startsWith('src/app/layout.tsx:') && !line.startsWith('scripts/public-critical-asset-diet-smoke.mjs:'));
if (nonLayoutRefs.length > 0) {
  const fallbackMissing = removedFontVars.filter((fontVar) => !layout.includes(`['${fontVar}' as string]:`));
  if (fallbackMissing.length > 0) {
    throw new Error(`Removed font vars referenced but missing layout fallback mapping: ${fallbackMissing.join(', ')}`);
  }
}

console.log('✅ public critical asset diet smoke passed');
