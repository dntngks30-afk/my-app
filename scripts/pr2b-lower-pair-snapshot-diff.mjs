/**
 * PR2-B proof helper:
 * Compare lower-pair snapshots produced by PR2-A harness and write concise diff summary.
 *
 * Run:
 *   node scripts/pr2b-lower-pair-snapshot-diff.mjs \
 *     --before artifacts/pr2b/lower-pair-before.json \
 *     --after artifacts/pr2b/lower-pair-after.json \
 *     --output artifacts/pr2b/lower-pair-diff-summary.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const REQUIRED = ['LOWER_INSTABILITY', 'LOWER_MOBILITY_RESTRICTION'];

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

function toMap(doc) {
  const map = new Map();
  for (const snap of doc.snapshots ?? []) map.set(snap.anchor_type, snap);
  return map;
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

function buildPairDelta(beforeDoc, afterDoc) {
  const beforeMap = toMap(beforeDoc);
  const afterMap = toMap(afterDoc);
  const perAnchor = {};

  for (const anchor of REQUIRED) {
    const b = pickSurface(beforeMap.get(anchor));
    const a = pickSurface(afterMap.get(anchor));
    perAnchor[anchor] = {
      first_session_intent_anchor: diffObject(b.first_session_intent_anchor, a.first_session_intent_anchor),
      rationale: diffObject(b.rationale, a.rationale),
      session_focus_axes: diffObject(b.session_focus_axes, a.session_focus_axes),
      segment_counts: diffObject(b.segment_counts, a.segment_counts),
      segment_shape: diffObject(b.segment_shape, a.segment_shape),
      main_emphasis_shape: diffObject(b.main_emphasis_shape, a.main_emphasis_shape),
      guardrail_summary: diffObject(b.guardrail_summary, a.guardrail_summary),
    };
  }

  return perAnchor;
}

function buildAfterSeparation(afterDoc) {
  const afterMap = toMap(afterDoc);
  const instability = pickSurface(afterMap.get('LOWER_INSTABILITY'));
  const mobility = pickSurface(afterMap.get('LOWER_MOBILITY_RESTRICTION'));
  return {
    different_intent_anchor:
      instability.first_session_intent_anchor !== mobility.first_session_intent_anchor,
    different_rationale:
      instability.rationale !== mobility.rationale,
    different_focus_axes:
      JSON.stringify(instability.session_focus_axes) !== JSON.stringify(mobility.session_focus_axes),
    different_main_emphasis_shape:
      JSON.stringify(instability.main_emphasis_shape) !== JSON.stringify(mobility.main_emphasis_shape),
    different_segment_shape:
      JSON.stringify(instability.segment_shape) !== JSON.stringify(mobility.segment_shape),
    guardrails_match_expected_safety:
      (instability.guardrail_summary?.first_session_guardrail_applied === true) &&
      (mobility.guardrail_summary?.first_session_guardrail_applied === true),
  };
}

function run() {
  const args = parseArgs();
  const before = JSON.parse(readFileSync(args.before, 'utf-8'));
  const after = JSON.parse(readFileSync(args.after, 'utf-8'));

  const summary = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-B lower-pair before/after proof summary',
    before_source: before.template_source ?? null,
    after_source: after.template_source ?? null,
    before_file: args.before,
    after_file: args.after,
    surface_diff_by_anchor: buildPairDelta(before, after),
    lower_pair_after_separation: buildAfterSeparation(after),
  };

  const outPath = args.output.startsWith('/') ? args.output : join(process.cwd(), args.output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(`Wrote lower-pair diff summary: ${outPath}`);
}

run();
