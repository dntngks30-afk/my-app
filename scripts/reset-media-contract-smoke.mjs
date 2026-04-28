/**
 * PR-RESET-BE-03 — reset media 순수 헬퍼·가이드 계약 스모크
 * (route / requireActivePlan / DB / buildMediaPayload 직접 호출 없음)
 *
 * Run: npx tsx scripts/reset-media-contract-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const mediaMod = await import('../src/lib/reset/reset-media-core.ts');
const guideMod = await import('../src/lib/reset/reset-stretch-guide.ts');

const {
  validateResetMediaRequestBody,
  resolveResetMediaSelection,
  buildPlaceholderResetMediaResponse,
} = mediaMod;

const { RESET_STRETCH_GUIDE_BY_KEY, getAllStretchGuideKeys } = guideMod;

const BANNED_SUBSTRINGS = [
  '치료합니다',
  '교정합니다',
  '질환을 해결',
  '통증을 없애',
  '반드시 좋아집니다',
  '신경 압박을 해결',
  '디스크',
  '협착',
  '좌골신경통 치료',
];

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

function aggText(guide) {
  return [
    guide.title,
    guide.description,
    ...guide.how_to,
    guide.safety_note ?? '',
  ].join('|');
}

// --- 해석 검증 ---
const rIssue = validateResetMediaRequestBody({ issue_key: 'forward_head' });
ok('issue_key만 허용', rIssue.ok === true);
if (rIssue.ok) {
  const res = resolveResetMediaSelection(rIssue.input);
  ok(
    'forward_head → sternocleidomastoid_stretch',
    res.ok === true &&
      res.selection.stretch_key === 'sternocleidomastoid_stretch'
  );
}

const rStretch = validateResetMediaRequestBody({
  stretch_key: 'cat_cow_spine_stretch',
});
ok('stretch_key cat_cow 허용', rStretch.ok === true);
if (rStretch.ok) {
  const res = resolveResetMediaSelection(rStretch.input);
  ok(
    'cat_cow 해석 동일 유지',
    res.ok === true && res.selection.stretch_key === 'cat_cow_spine_stretch'
  );
}

// --- 검증 XOR / unknown ---
ok(
  '둘 다 없음',
  validateResetMediaRequestBody({}).ok === false
);

ok(
  '둘 다 있음',
  validateResetMediaRequestBody({
    issue_key: 'forward_head',
    stretch_key: 'x',
  }).ok === false
);

ok(
  'unknown issue',
  validateResetMediaRequestBody({ issue_key: 'not_an_issue_ever' }).ok === false
);

ok(
  'unknown stretch',
  validateResetMediaRequestBody({ stretch_key: 'bogus_stretch' }).ok === false
);

// validate throw 안 함 — 실패 브랜치를 직접 호출했을 때 throw 없음(대표 한 건 더)
let threw = false;
try {
  const bad = validateResetMediaRequestBody({ issue_key: 'x' });
  if (bad.ok) throw new Error('unexpected ok');
  void bad.message;
} catch {
  threw = true;
}
ok('validate 실패 경로에서 throw 안 함', !threw);

// --- placeholder (template_id 현재 SSOT 모두 null) ---
const fwd = validateResetMediaRequestBody({ issue_key: 'forward_head' });
if (fwd.ok) {
  const res = resolveResetMediaSelection(fwd.input);
  if (res.ok) {
    const ph = buildPlaceholderResetMediaResponse(
      res.selection,
      'placeholder_unmapped',
      null
    );
    ok('placeholder meta.source 일치', ph.meta.source === 'placeholder_unmapped');
    ok('placeholder template_id null', ph.template_id === null);
    ok('media.kind placeholder', ph.media.kind === 'placeholder');
    ok('media.autoplayAllowed === false', ph.media.autoplayAllowed === false);
    ok(
      'display 필드 존재',
      ph.display.title?.length > 0 &&
        ph.display.description?.length > 0 &&
        ph.display.how_to?.length > 0
    );
    ok('placeholder display.duration_label 1분', ph.display.duration_label === '1분');
    try {
      JSON.parse(JSON.stringify(ph));
      ok('placeholder 응답 JSON 직렬화', true);
    } catch {
      ok('placeholder 응답 JSON 직렬화', false);
    }
  }
}

// --- missing_* meta 라벨 문자열 검증 ---
const missingT = validateResetMediaRequestBody({
  stretch_key: 'levator_scapulae_upper_trap_stretch',
});
if (missingT.ok) {
  const res = resolveResetMediaSelection(missingT.input);
  if (res.ok) {
    const ph = buildPlaceholderResetMediaResponse(
      res.selection,
      'placeholder_missing_template',
      'fake-template-id-not-in-db-for-smoke-label-only'
    );
    ok('placeholder_missing_template meta', ph.meta.source === 'placeholder_missing_template');
    const pm = buildPlaceholderResetMediaResponse(
      res.selection,
      'placeholder_missing_media',
      'fake-row-id'
    );
    ok('placeholder_missing_media meta', pm.meta.source === 'placeholder_missing_media');
  }
}

// --- guides ---
const keys = getAllStretchGuideKeys();
ok('guide 10개 키', keys.length === 10);

for (const k of keys) {
  const g = RESET_STRETCH_GUIDE_BY_KEY[k];
  ok(`guide 존재 ${k}`, !!g && g.title?.length > 0);
  ok(`how_to >= 2 (${k})`, g && g.how_to.length >= 2);
  const blob = aggText(g).toLowerCase();
  let hit = false;
  for (const b of BANNED_SUBSTRINGS) {
    if (blob.includes(b.toLowerCase())) {
      hit = true;
      break;
    }
  }
  ok(`금지어 없음 (${k})`, !hit);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
