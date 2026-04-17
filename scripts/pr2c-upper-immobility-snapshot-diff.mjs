/**
 * PR2-C proof helper:
 * Compare UPPER_IMMOBILITY snapshots produced by PR2-A harness and write concise diff summary.
 *
 * Run:
 *   node scripts/pr2c-upper-immobility-snapshot-diff.mjs \
 *     --before artifacts/pr2c/upper-before.json \
 *     --after artifacts/pr2c/upper-after.json \
 *     --output artifacts/pr2c/upper-diff-summary.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const TARGET = 'UPPER_IMMOBILITY';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { before: null, after: null, output: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--before' && args[i + 1]) out.before = args[++i];
    else if (args[i] === '--after' && args[i + 1]) out.after = args[++i];
    else if (args[i] === '--output' && args[i + 1]) out.output = args[++i];
  }
  if (!out.before || !out.after || !out.output) {
    throw new Error('Usage: --before <path> --after <path> --output <path>');
  }
  return out;
}

function pickSnapshot(doc) {
  return (doc.snapshots ?? []).find((s) => s.anchor_type === TARGET) ?? null;
}

function pickSurface(s) {
  return {
    first_session_intent_anchor: s?.first_session?.first_session_intent_anchor ?? null,
    rationale: s?.first_session?.rationale ?? null,
    session_focus_axes: s?.first_session?.session_focus_axes ?? [],
    segment_counts: s?.first_session?.segment_counts ?? null,
    segment_shape: s?.first_session?.segment_shape ?? [],
    main_emphasis_shape: s?.first_session?.main_emphasis_shape ?? null,
    guardrail_summary: s?.first_session?.guardrail_summary ?? null,
  };
}

function diffObject(before, after) {
  return { before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
}

function hasUpperMobilityDominance(surface) {
  const vectors = surface.main_emphasis_shape?.target_vectors_top ?? [];
  const upper = vectors.find((v) => v.key === 'upper_mobility')?.count ?? 0;
  const trunk = vectors.find((v) => v.key === 'trunk_control')?.count ?? 0;
  return {
    upper_count: upper,
    trunk_count: trunk,
    upper_gte_trunk: upper >= trunk,
  };
}

function run() {
  const args = parseArgs();
  const beforeDoc = JSON.parse(readFileSync(args.before, 'utf-8'));
  const afterDoc = JSON.parse(readFileSync(args.after, 'utf-8'));
  const beforeSurface = pickSurface(pickSnapshot(beforeDoc));
  const afterSurface = pickSurface(pickSnapshot(afterDoc));

  const summary = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-C upper-mobility expressiveness before/after proof summary',
    before_source: beforeDoc.template_source ?? null,
    after_source: afterDoc.template_source ?? null,
    before_file: args.before,
    after_file: args.after,
    surface_diff: {
      first_session_intent_anchor: diffObject(beforeSurface.first_session_intent_anchor, afterSurface.first_session_intent_anchor),
      rationale: diffObject(beforeSurface.rationale, afterSurface.rationale),
      session_focus_axes: diffObject(beforeSurface.session_focus_axes, afterSurface.session_focus_axes),
      segment_counts: diffObject(beforeSurface.segment_counts, afterSurface.segment_counts),
      segment_shape: diffObject(beforeSurface.segment_shape, afterSurface.segment_shape),
      main_emphasis_shape: diffObject(beforeSurface.main_emphasis_shape, afterSurface.main_emphasis_shape),
      guardrail_summary: diffObject(beforeSurface.guardrail_summary, afterSurface.guardrail_summary),
    },
    directional_obviousness_readout: {
      before_main_upper_vs_trunk: hasUpperMobilityDominance(beforeSurface),
      after_main_upper_vs_trunk: hasUpperMobilityDominance(afterSurface),
      guardrails_unchanged:
        JSON.stringify(beforeSurface.guardrail_summary) === JSON.stringify(afterSurface.guardrail_summary),
    },
  };

  const outPath = args.output.startsWith('/') ? args.output : join(process.cwd(), args.output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(`Wrote upper-mobility diff summary: ${outPath}`);
}

run();
