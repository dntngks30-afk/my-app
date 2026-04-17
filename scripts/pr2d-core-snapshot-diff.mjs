/**
 * PR2-D CORE_CONTROL_DEFICIT snapshot diff.
 *
 * Compares PR2-A harness outputs and reports trunk/core-led movement without
 * changing generator behavior.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const TRUNK_CORE_LED_TAGS = new Set([
  'core_control',
  'core_stability',
  'global_core',
  'glute_activation',
  'lower_chain_stability',
]);
const UPPER_DISTRACTOR_TAGS = new Set([
  'shoulder_mobility',
  'thoracic_mobility',
  'upper_back_activation',
  'shoulder_stability',
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { before: null, after: null, output: null, regressionBefore: null, regressionAfter: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--before') out.before = args[++i];
    else if (arg === '--after') out.after = args[++i];
    else if (arg === '--output') out.output = args[++i];
    else if (arg === '--regression-before') out.regressionBefore = args[++i];
    else if (arg === '--regression-after') out.regressionAfter = args[++i];
  }
  if (!out.before || !out.after || !out.output) {
    throw new Error('Usage: node scripts/pr2d-core-snapshot-diff.mjs --before <file> --after <file> --output <file>');
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function snapshotByAnchor(doc, anchor) {
  const snapshot = doc.snapshots.find((item) => item.anchor_type === anchor);
  if (!snapshot) throw new Error(`Missing snapshot for ${anchor}`);
  return snapshot;
}

function countTopKeys(topList, keys) {
  return topList
    .filter((item) => keys.has(item.key))
    .reduce((sum, item) => sum + (item.count ?? 0), 0);
}

function vectorCount(snapshot, key) {
  return snapshot.first_session.main_emphasis_shape.target_vectors_top.find((item) => item.key === key)?.count ?? 0;
}

function summarizeCore(snapshot) {
  const tags = snapshot.first_session.main_emphasis_shape.focus_tags_top;
  const vectors = snapshot.first_session.main_emphasis_shape.target_vectors_top;
  return {
    rationale: snapshot.first_session.rationale,
    session_focus_axes: snapshot.first_session.session_focus_axes,
    segment_counts: snapshot.first_session.segment_counts,
    segment_shape: snapshot.first_session.segment_shape,
    main_emphasis_shape: snapshot.first_session.main_emphasis_shape,
    trunk_core_led_tag_count: countTopKeys(tags, TRUNK_CORE_LED_TAGS),
    upper_distractor_tag_count: countTopKeys(tags, UPPER_DISTRACTOR_TAGS),
    trunk_vector_count: vectorCount(snapshot, 'trunk_control'),
    upper_vector_count: vectorCount(snapshot, 'upper_mobility'),
    lower_stability_vector_count: vectorCount(snapshot, 'lower_stability'),
    guardrail_summary: snapshot.first_session.guardrail_summary,
  };
}

function stableComparable(snapshot) {
  return {
    result: snapshot.result,
    first_session: snapshot.first_session,
  };
}

function buildRegressionChecks(args) {
  if (!args.regressionBefore || !args.regressionAfter) return null;
  const before = readJson(args.regressionBefore);
  const after = readJson(args.regressionAfter);
  const anchors = [
    'LOWER_INSTABILITY',
    'LOWER_MOBILITY_RESTRICTION',
    'UPPER_IMMOBILITY',
    'DECONDITIONED',
    'STABLE',
  ];

  return anchors.map((anchor) => {
    const beforeSnapshot = snapshotByAnchor(before, anchor);
    const afterSnapshot = snapshotByAnchor(after, anchor);
    const beforeStable = stableComparable(beforeSnapshot);
    const afterStable = stableComparable(afterSnapshot);
    return {
      anchor_type: anchor,
      changed: JSON.stringify(beforeStable) !== JSON.stringify(afterStable),
      before: beforeStable,
      after: afterStable,
    };
  });
}

function run() {
  const args = parseArgs();
  const beforeDoc = readJson(args.before);
  const afterDoc = readJson(args.after);
  const before = summarizeCore(snapshotByAnchor(beforeDoc, 'CORE_CONTROL_DEFICIT'));
  const after = summarizeCore(snapshotByAnchor(afterDoc, 'CORE_CONTROL_DEFICIT'));
  const regression_checks = buildRegressionChecks(args);

  const out = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-D CORE_CONTROL_DEFICIT before/after trunk-core distinctness proof',
    core_diff: {
      before,
      after,
      directional_readout: {
        trunk_core_led_tag_delta: after.trunk_core_led_tag_count - before.trunk_core_led_tag_count,
        upper_distractor_tag_delta: after.upper_distractor_tag_count - before.upper_distractor_tag_count,
        upper_vector_delta: after.upper_vector_count - before.upper_vector_count,
        trunk_vector_delta: after.trunk_vector_count - before.trunk_vector_count,
        lower_stability_vector_delta: after.lower_stability_vector_count - before.lower_stability_vector_count,
        guardrails_unchanged:
          JSON.stringify(before.guardrail_summary) === JSON.stringify(after.guardrail_summary),
        phase_shape_unchanged:
          JSON.stringify(before.segment_shape) === JSON.stringify(after.segment_shape),
        rationale_unchanged:
          before.rationale === after.rationale,
        focus_axes_unchanged:
          JSON.stringify(before.session_focus_axes) === JSON.stringify(after.session_focus_axes),
      },
    },
    non_core_regression_checks: regression_checks,
  };

  const outPath = args.output.startsWith('/') ? args.output : join(process.cwd(), args.output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote PR2-D diff summary: ${outPath}`);
}

run();
