/**
 * Deep Test Question ID Drift Guard
 * Run: npx tsx scripts/deep-question-id-validate.mjs
 * Fails if: registry IDs != canonical IDs, or section IDs include unknown IDs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

async function run() {
  const { DEEP_V2_QUESTION_IDS, getApplicableQuestionIds } = await import(
    '../src/lib/deep-test/question-ids.ts'
  );

  const { DEEP_V2_QUESTIONS, DEEP_SECTIONS } = await import(
    '../src/app/app/deep-test/_data/questions.ts'
  );

  let failed = 0;

  // 1. Registry IDs must match canonical DEEP_V2_QUESTION_IDS
  const registryIds = DEEP_V2_QUESTIONS.map((q) => q.id);
  const canonicalIds = [...DEEP_V2_QUESTION_IDS];

  const registrySet = new Set(registryIds);
  const canonicalSet = new Set(canonicalIds);

  for (const id of canonicalIds) {
    if (!registrySet.has(id)) {
      console.error(`[DRIFT] Canonical ID "${id}" missing from question registry`);
      failed++;
    }
  }
  for (const id of registryIds) {
    if (!canonicalSet.has(id)) {
      console.error(`[DRIFT] Registry has unknown ID "${id}" not in canonical list`);
      failed++;
    }
  }
  if (registryIds.length !== canonicalIds.length) {
    console.error(
      `[DRIFT] Count mismatch: registry=${registryIds.length}, canonical=${canonicalIds.length}`
    );
    failed++;
  }

  // 2. Applicable IDs must equal canonical (no extra/unknown)
  const applicable = getApplicableQuestionIds();
  const applicableSet = new Set(applicable);
  for (const id of applicable) {
    if (!canonicalSet.has(id)) {
      console.error(`[DRIFT] Applicable ID "${id}" not in canonical list`);
      failed++;
    }
  }
  if (applicable.length !== canonicalIds.length) {
    console.error(
      `[DRIFT] Applicable count mismatch: ${applicable.length} vs canonical ${canonicalIds.length}`
    );
    failed++;
  }

  // 3. DEEP_SECTIONS questionIds must all exist in registry
  const allSectionIds = DEEP_SECTIONS.flatMap((s) => s.questionIds);
  for (const id of allSectionIds) {
    if (!registrySet.has(id)) {
      console.error(`[DRIFT] Section references unknown ID "${id}"`);
      failed++;
    }
  }

  // 4. All canonical IDs must appear in at least one section
  const sectionIdsSet = new Set(allSectionIds);
  for (const id of canonicalIds) {
    if (!sectionIdsSet.has(id)) {
      console.error(`[DRIFT] Canonical ID "${id}" not in any DEEP_SECTIONS`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} drift error(s). Fix before merging.`);
    process.exit(1);
  }

  console.log('✓ Deep question ID alignment OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
