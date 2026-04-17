/**
 * PR2-E proof helper:
 * Compare DECONDITIONED / STABLE snapshots before and after polish.
 *
 * Run:
 *   node scripts/pr2e-deconditioned-stable-snapshot-diff.mjs \
 *     --before artifacts/pr2e/deconditioned-stable-before.json \
 *     --after artifacts/pr2e/deconditioned-stable-after.json \
 *     --output artifacts/pr2e/deconditioned-stable-diff-summary.json
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const TARGETS = ['DECONDITIONED', 'STABLE'];
const REGRESSION_TARGETS = [
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { before: null, after: null, output: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--before' && args[i + 1]) out.before = args[++i];
    else if (arg === '--after' && args[i + 1]) out.after = args[++i];
    else if (arg === '--output' && args[i + 1]) out.output = args[++i];
  }
  if (!out.before || !out.after || !out.output) {
    throw new Error('Usage: --before <path> --after <path> --output <path>');
  }
  return out;
}

function pickSnapshot(doc, anchor) {
  const snaps = Array.isArray(doc?.snapshots) ? doc.snapshots : [];
  const snap = snaps.find((candidate) => candidate.anchor_type === anchor);
  if (!snap) {
    throw new Error(`Missing snapshot for anchor: ${anchor}`);
  }
  return snap;
}

function pickSurface(snapshot) {
  return {
    first_session_intent_anchor: snapshot?.first_session?.first_session_intent_anchor ?? null,
    gold_path_vector: snapshot?.first_session?.gold_path_vector ?? null,
    rationale: snapshot?.first_session?.rationale ?? null,
    session_focus_axes: snapshot?.first_session?.session_focus_axes ?? [],
    segment_counts: snapshot?.first_session?.segment_counts ?? null,
    segment_shape: snapshot?.first_session?.segment_shape ?? [],
    main_emphasis_shape: snapshot?.first_session?.main_emphasis_shape ?? null,
    segment_emphasis_shape: snapshot?.first_session?.segment_emphasis_shape ?? null,
    guardrail_summary: snapshot?.first_session?.guardrail_summary ?? null,
  };
}

function pickRegressionSurface(snapshot) {
  const surface = pickSurface(snapshot);
  return {
    ...surface,
    main_emphasis_shape: surface.main_emphasis_shape
      ? {
          focus_tags_top: surface.main_emphasis_shape.focus_tags_top ?? [],
          target_vectors_top: surface.main_emphasis_shape.target_vectors_top ?? [],
        }
      : null,
    segment_emphasis_shape: null,
  };
}

function diffObject(before, after) {
  return { before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
}

function buildAnchorDiff(beforeDoc, afterDoc, anchor) {
  const beforeSnap = pickSnapshot(beforeDoc, anchor);
  const afterSnap = pickSnapshot(afterDoc, anchor);
  const before = pickSurface(beforeSnap);
  const after = pickSurface(afterSnap);

  return {
    before,
    after,
    surface_diff: {
      first_session_intent_anchor: diffObject(before.first_session_intent_anchor, after.first_session_intent_anchor),
      gold_path_vector: diffObject(before.gold_path_vector, after.gold_path_vector),
      rationale: diffObject(before.rationale, after.rationale),
      session_focus_axes: diffObject(before.session_focus_axes, after.session_focus_axes),
      segment_counts: diffObject(before.segment_counts, after.segment_counts),
      segment_shape: diffObject(before.segment_shape, after.segment_shape),
      main_emphasis_shape: diffObject(before.main_emphasis_shape, after.main_emphasis_shape),
      segment_emphasis_shape: diffObject(before.segment_emphasis_shape, after.segment_emphasis_shape),
      guardrail_summary: diffObject(before.guardrail_summary, after.guardrail_summary),
    },
    directional_readout: {
      structural_delta_observed:
        JSON.stringify(before.main_emphasis_shape) !== JSON.stringify(after.main_emphasis_shape) ||
        JSON.stringify(before.segment_emphasis_shape) !== JSON.stringify(after.segment_emphasis_shape) ||
        JSON.stringify(before.session_focus_axes) !== JSON.stringify(after.session_focus_axes) ||
        JSON.stringify(before.gold_path_vector) !== JSON.stringify(after.gold_path_vector),
      guardrails_unchanged: JSON.stringify(before.guardrail_summary) === JSON.stringify(after.guardrail_summary),
      phase_shape_unchanged: JSON.stringify(before.segment_shape) === JSON.stringify(after.segment_shape),
    },
  };
}

function buildRegressionChecks(beforeDoc, afterDoc) {
  const perAnchor = [];
  for (const anchor of REGRESSION_TARGETS) {
    const before = pickRegressionSurface(pickSnapshot(beforeDoc, anchor));
    const after = pickRegressionSurface(pickSnapshot(afterDoc, anchor));
    perAnchor.push({
      anchor_type: anchor,
      changed: JSON.stringify(before) !== JSON.stringify(after),
      before,
      after,
    });
  }
  return perAnchor;
}

function run() {
  const args = parseArgs();
  const beforeDoc = JSON.parse(readFileSync(args.before, 'utf-8'));
  const afterDoc = JSON.parse(readFileSync(args.after, 'utf-8'));

  const summary = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-E deconditioned/stable before/after proof summary',
    before_files: {
      combined: args.before,
    },
    after_files: {
      combined: args.after,
    },
    before_source: {
      combined: beforeDoc.template_source ?? null,
    },
    after_source: {
      combined: afterDoc.template_source ?? null,
    },
    target_diff_by_anchor: {
      DECONDITIONED: buildAnchorDiff(beforeDoc, afterDoc, 'DECONDITIONED'),
      STABLE: buildAnchorDiff(beforeDoc, afterDoc, 'STABLE'),
    },
    regression_checks: buildRegressionChecks(beforeDoc, afterDoc),
  };

  const outPath = args.output.startsWith('/') ? args.output : join(process.cwd(), args.output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(`Wrote PR2-E diff summary: ${outPath}`);
}

run();
