/**
 * Session bootstrap smoke
 * - bootstrap summary helper shape
 * - first-session guardrail
 * - route module import smoke
 */

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

import bootstrapSummaryModule from '../src/lib/session/bootstrap-summary.ts'

const { buildSessionBootstrapSummaryFromTemplates } = bootstrapSummaryModule

function ok(name, cond) {
  if (!cond) throw new Error(name)
  console.log(`  ✓ ${name}`)
}

const templates = [
  {
    id: 'prep-1',
    name: '흉추 모빌리티',
    level: 1,
    focus_tags: ['thoracic_mobility'],
    contraindications: [],
    duration_sec: 120,
    media_ref: null,
    is_fallback: false,
    phase: 'prep',
    target_vector: ['upper_mobility'],
    difficulty: 'low',
    avoid_if_pain_mode: null,
    progression_level: 1,
  },
  {
    id: 'main-1',
    name: '벽 슬라이드',
    level: 1,
    focus_tags: ['shoulder_mobility'],
    contraindications: [],
    duration_sec: 300,
    media_ref: null,
    is_fallback: false,
    phase: 'main',
    target_vector: ['upper_mobility'],
    difficulty: 'low',
    avoid_if_pain_mode: null,
    progression_level: 1,
  },
  {
    id: 'main-2',
    name: '밴드 풀어파트',
    level: 1,
    focus_tags: ['upper_back_activation'],
    contraindications: [],
    duration_sec: 300,
    media_ref: null,
    is_fallback: false,
    phase: 'main',
    target_vector: ['upper_mobility'],
    difficulty: 'medium',
    avoid_if_pain_mode: null,
    progression_level: 2,
  },
  {
    id: 'accessory-1',
    name: '목 이완',
    level: 1,
    focus_tags: ['neck_mobility'],
    contraindications: [],
    duration_sec: 120,
    media_ref: null,
    is_fallback: false,
    phase: 'accessory',
    target_vector: ['upper_mobility'],
    difficulty: 'low',
    avoid_if_pain_mode: null,
    progression_level: 1,
  },
  {
    id: 'cooldown-1',
    name: '상부 승모근 이완',
    level: 1,
    focus_tags: ['upper_trap_release'],
    contraindications: [],
    duration_sec: 120,
    media_ref: null,
    is_fallback: false,
    phase: 'prep',
    target_vector: ['upper_mobility'],
    difficulty: 'low',
    avoid_if_pain_mode: null,
    progression_level: 1,
  },
]

const upperSummary = buildSessionBootstrapSummaryFromTemplates(templates, {
  sessionNumber: 1,
  deepSummary: {
    result_type: 'NECK-SHOULDER',
    confidence: 0.8,
    effective_confidence: 0.8,
    focus: ['shoulder_mobility', 'neck_mobility'],
    avoid: [],
    scoring_version: 'deep_v3',
    deep_level: 1,
    safety_mode: 'yellow',
    priority_vector: { upper_mobility: 1, trunk_control: 0.5 },
    pain_mode: 'caution',
    primary_type: 'UPPER_IMMOBILITY',
  },
})

ok('segments returned', upperSummary.segments.length >= 3)
ok('focus axes returned', upperSummary.focus_axes[0] === 'upper_mobility')
ok('estimated duration > 0', upperSummary.estimated_duration > 0)
ok('first-session guardrail flag present', upperSummary.constraint_flags.includes('first_session_guardrail_applied'))

const trunkSummary = buildSessionBootstrapSummaryFromTemplates(templates, {
  sessionNumber: 3,
  deepSummary: {
    result_type: 'LUMBO-PELVIS',
    confidence: 0.7,
    effective_confidence: 0.7,
    focus: ['core_control'],
    avoid: [],
    scoring_version: 'deep_v3',
    deep_level: 2,
    safety_mode: 'red',
    priority_vector: { trunk_control: 1 },
    pain_mode: 'protected',
    primary_type: 'CORE_CONTROL_DEFICIT',
  },
})

const mainSegment = trunkSummary.segments.find((segment) => segment.title === 'Main')
ok('red safety still returns summary', trunkSummary.segments.length > 0)
ok('red safety limits main volume', (mainSegment?.items.length ?? 0) <= 1)

await import('../src/app/api/session/bootstrap/route.ts')
ok('route module imports', true)
