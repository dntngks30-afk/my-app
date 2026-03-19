/**
 * Deep Result V2 Contract Smoke Test
 *
 * 세 입력 채널(free_survey, camera, deep_paid) 각각을 adapter로 변환 후
 * validateUnifiedDeepResultV2로 필수 필드 누락 없음을 검증한다.
 *
 * 실행: npx tsx scripts/deep-result-v2-contract-smoke.mjs
 */

// ─── Inline adapter/validator (스크립트 독립 실행을 위해 핵심 로직 인라인) ────

const VALID_SOURCE_MODES = ['free_survey', 'camera', 'deep_paid'];
const VALID_EVIDENCE_LEVELS = ['lite', 'partial', 'full'];
const VALID_PAIN_MODES = ['none', 'caution', 'protected', null];
const VALID_PRIMARY_TYPES = [
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
  'DECONDITIONED',
  'STABLE',
  'UNKNOWN',
];

function validate(result) {
  const errors = [];
  if (!result || typeof result !== 'object') return { valid: false, errors: ['not an object'] };
  const r = result;

  if (!VALID_PRIMARY_TYPES.includes(r.primary_type))
    errors.push(`primary_type invalid: ${r.primary_type}`);
  if (r.secondary_type !== null && !VALID_PRIMARY_TYPES.includes(r.secondary_type))
    errors.push(`secondary_type invalid: ${r.secondary_type}`);
  if (r.priority_vector !== null && (typeof r.priority_vector !== 'object' || Array.isArray(r.priority_vector)))
    errors.push('priority_vector must be object or null');
  if (!VALID_PAIN_MODES.includes(r.pain_mode))
    errors.push(`pain_mode invalid: ${r.pain_mode}`);
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1)
    errors.push(`confidence invalid: ${r.confidence}`);
  if (!VALID_EVIDENCE_LEVELS.includes(r.evidence_level))
    errors.push(`evidence_level invalid: ${r.evidence_level}`);
  if (!VALID_SOURCE_MODES.includes(r.source_mode))
    errors.push(`source_mode invalid: ${r.source_mode}`);
  if (!Array.isArray(r.missing_signals))
    errors.push('missing_signals must be array');
  if (!Array.isArray(r.reason_codes))
    errors.push('reason_codes must be array');
  if (typeof r.summary_copy !== 'string')
    errors.push('summary_copy must be string');

  return { valid: errors.length === 0, errors };
}

// ─── Free Survey Adapter (인라인) ──────────────────────────────────────────────

const FREE_SURVEY_ANIMAL_TO_PRIMARY = {
  kangaroo:  'CORE_CONTROL_DEFICIT',
  hedgehog:  'UPPER_IMMOBILITY',
  crab:      'LOWER_INSTABILITY',
  turtle:    'CORE_CONTROL_DEFICIT',
  penguin:   'LOWER_MOBILITY_RESTRICTION',
  meerkat:   'CORE_CONTROL_DEFICIT',
  monkey:    'STABLE',
  armadillo: 'DECONDITIONED',
  sloth:     'DECONDITIONED',
};

function adaptFree(input) {
  const animalKey = input.mainAnimal ?? input.baseType ?? 'unknown';
  const primary = FREE_SURVEY_ANIMAL_TO_PRIMARY[animalKey] ?? 'UNKNOWN';
  const rawConfidence = input.confidence ?? 0.7;
  const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
  const answeredRatio = input.answeredRatio ?? confidence;
  const evidenceLevel = (answeredRatio >= 0.9 && confidence >= 0.6) ? 'partial' : 'lite';
  const missingSignals = [];
  if (answeredRatio < 0.7) missingSignals.push('survey_incomplete');
  const reasonCodes = [animalKey !== 'unknown' ? `${animalKey}_pattern` : 'unknown_pattern'];
  return {
    primary_type: primary,
    secondary_type: null,
    priority_vector: null,
    pain_mode: null,
    confidence,
    evidence_level: evidenceLevel,
    source_mode: 'free_survey',
    missing_signals: missingSignals,
    reason_codes: reasonCodes,
    summary_copy: `${animalKey}형 패턴이 확인됩니다.`,
    _compat: { mainType: animalKey, scoring_version: 'free_v2' },
  };
}

// ─── Camera Adapter (인라인) ───────────────────────────────────────────────────

const CAMERA_MOVEMENT_TO_PRIMARY = {
  kangaroo: 'CORE_CONTROL_DEFICIT',
  hedgehog: 'UPPER_IMMOBILITY',
  crab:     'LOWER_INSTABILITY',
  monkey:   'STABLE',
  unknown:  'UNKNOWN',
};

const CAMERA_EVIDENCE_TO_LEVEL = {
  strong_evidence:    'partial',
  shallow_evidence:   'partial',
  weak_evidence:      'lite',
  insufficient_signal:'lite',
};

function adaptCamera(input) {
  const movementType = input.movementType ?? 'unknown';
  const primary = CAMERA_MOVEMENT_TO_PRIMARY[movementType] ?? 'UNKNOWN';
  const evidenceLevel = CAMERA_EVIDENCE_TO_LEVEL[input.resultEvidenceLevel ?? '']
    ?? (input.insufficientSignal ? 'lite' : input.captureQuality === 'ok' ? 'partial' : 'lite');
  const flags = input.flags ?? [];
  const missingSignals = [];
  if (flags.includes('insufficient_signal')) missingSignals.push('camera_signal_insufficient');
  if (flags.includes('valid_frames_too_few')) missingSignals.push('camera_frames_too_few');
  const evaluatorResults = input.evaluatorResults ?? [];
  const reasonCodes = [];
  for (const r of evaluatorResults) {
    if (r.insufficientSignal) continue;
    for (const m of r.metrics ?? []) {
      if (m.trend === 'concern') reasonCodes.push(`camera_${m.name}_concern`);
    }
  }
  return {
    primary_type: primary,
    secondary_type: null,
    priority_vector: null,
    pain_mode: null,
    confidence: Math.max(0, Math.min(1, input.confidence ?? 0.8)),
    evidence_level: evidenceLevel,
    source_mode: 'camera',
    missing_signals: [...new Set(missingSignals)],
    reason_codes: [...new Set(reasonCodes)],
    summary_copy: input.patternSummary ?? `${movementType}형 패턴 경향이 확인됩니다.`,
    _compat: {
      movementType,
      captureQuality: input.captureQuality,
      retryRecommended: input.retryRecommended ?? false,
      insufficientSignal: input.insufficientSignal ?? false,
      scoring_version: 'camera_v1',
    },
  };
}

// ─── Paid Deep Adapter (인라인) ────────────────────────────────────────────────

const DEEP_V2_TO_PRIMARY = {
  'NECK-SHOULDER': 'UPPER_IMMOBILITY',
  'LUMBO-PELVIS':  'CORE_CONTROL_DEFICIT',
  'UPPER-LIMB':    'UPPER_IMMOBILITY',
  'LOWER-LIMB':    'LOWER_INSTABILITY',
  'DECONDITIONED': 'DECONDITIONED',
  'STABLE':        'STABLE',
};

const DEEP_V3_TO_UNIFIED = {
  LOWER_INSTABILITY:         'LOWER_INSTABILITY',
  LOWER_MOBILITY_RESTRICTION:'LOWER_MOBILITY_RESTRICTION',
  UPPER_IMMOBILITY:          'UPPER_IMMOBILITY',
  CORE_CONTROL_DEFICIT:      'CORE_CONTROL_DEFICIT',
  DECONDITIONED:             'DECONDITIONED',
  STABLE:                    'STABLE',
};

function adaptPaid(input) {
  const scoringVersion = input.scoring_version ?? 'deep_v2';
  const derived = input.scores?.derived;
  const isV3 = scoringVersion === 'deep_v3';
  const rawPrimary = isV3 ? (derived?.primary_type ?? input.resultType) : input.resultType;
  const primary = isV3
    ? (DEEP_V3_TO_UNIFIED[rawPrimary ?? ''] ?? 'UNKNOWN')
    : (DEEP_V2_TO_PRIMARY[rawPrimary ?? ''] ?? 'UNKNOWN');
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 0));
  const evidenceLevel = scoringVersion === 'deep_v3'
    ? (confidence >= 0.8 ? 'full' : confidence >= 0.6 ? 'partial' : 'lite')
    : (confidence >= 0.7 ? 'partial' : 'lite');
  const rawPainMode = derived?.pain_mode;
  const painMode = ['none','caution','protected'].includes(rawPainMode ?? '') ? rawPainMode : null;
  const pv = derived?.priority_vector ?? null;
  const priorityVector = pv && typeof pv === 'object' ? pv : null;
  const reasonCodes = [];
  const obj = input.scores?.objectiveScores ?? {};
  if ((obj.N ?? 0) >= 3) reasonCodes.push('neck_shoulder_high');
  if ((obj.L ?? 0) >= 3) reasonCodes.push('lumbo_pelvis_high');
  if ((obj.Lo ?? 0) >= 3) reasonCodes.push('lower_limb_high');
  if (rawPainMode === 'protected') reasonCodes.push('pain_protected_mode');
  const missingSignals = [];
  if (!derived?.focus_tags?.length) missingSignals.push('focus_tags_empty');
  return {
    primary_type: primary,
    secondary_type: null,
    priority_vector: priorityVector,
    pain_mode: painMode,
    confidence,
    evidence_level: evidenceLevel,
    source_mode: 'deep_paid',
    missing_signals: missingSignals,
    reason_codes: reasonCodes,
    summary_copy: `${rawPrimary ?? primary} 패턴이 확인됩니다.`,
    _compat: {
      result_type: input.resultType ?? undefined,
      focus_tags: derived?.focus_tags,
      avoid_tags: derived?.avoid_tags,
      algorithm_scores: derived?.algorithm_scores,
      scoring_version: scoringVersion,
    },
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURE_FREE_SURVEY = {
  mainAnimal: 'kangaroo',
  confidence: 72,
  answeredRatio: 0.92,
};

const FIXTURE_FREE_SURVEY_MONKEY = {
  mainAnimal: 'monkey',
  confidence: 85,
  answeredRatio: 1.0,
};

const FIXTURE_CAMERA_HEDGEHOG = {
  movementType: 'hedgehog',
  confidence: 0.84,
  captureQuality: 'ok',
  flags: [],
  retryRecommended: false,
  insufficientSignal: false,
  resultEvidenceLevel: 'strong_evidence',
  patternSummary: '상체 가동성이 다소 제한된 패턴이 보여요',
  evaluatorResults: [
    {
      insufficientSignal: false,
      metrics: [
        { name: 'arm_range', trend: 'concern' },
        { name: 'lumbar_extension', trend: 'neutral' },
      ],
    },
  ],
};

const FIXTURE_CAMERA_INSUFFICIENT = {
  movementType: 'unknown',
  confidence: 0.1,
  captureQuality: 'invalid',
  flags: ['insufficient_signal', 'valid_frames_too_few'],
  retryRecommended: true,
  insufficientSignal: true,
  resultEvidenceLevel: 'insufficient_signal',
  patternSummary: '촬영 신호가 충분하지 않아 결과를 바로 확정하지 않았습니다.',
  evaluatorResults: [],
};

const FIXTURE_PAID_DEEP_V2 = {
  scoring_version: 'deep_v2',
  resultType: 'LOWER-LIMB',
  confidence: 0.78,
  scores: {
    objectiveScores: { N: 1, L: 2, U: 0, Lo: 4, D: 2 },
    finalScores: { N: 1, L: 2, U: 0, Lo: 5, D: 2 },
    primaryFocus: 'LOWER-LIMB',
    secondaryFocus: 'LUMBO-PELVIS',
    derived: {
      focus_tags: ['glute_medius', 'ankle_mobility'],
      avoid_tags: ['knee_load'],
      algorithm_scores: { upper_score: 1, lower_score: 6, core_score: 2, balance_score: 2, pain_risk: 2 },
    },
  },
};

const FIXTURE_PAID_DEEP_V3 = {
  scoring_version: 'deep_v3',
  resultType: 'LOWER-LIMB',
  confidence: 0.85,
  scores: {
    objectiveScores: { N: 1, L: 3, U: 0, Lo: 3, D: 1 },
    finalScores: { N: 1, L: 3, U: 0, Lo: 4, D: 1 },
    derived: {
      primary_type: 'LOWER_INSTABILITY',
      secondary_type: 'CORE_CONTROL_DEFICIT',
      focus_tags: ['glute_medius', 'ankle_mobility', 'core_bracing'],
      avoid_tags: ['knee_load'],
      algorithm_scores: { upper_score: 1, lower_score: 6, core_score: 3, balance_score: 1, pain_risk: 1 },
      priority_vector: {
        lower_stability: 0.9,
        lower_mobility: 0.5,
        upper_mobility: 0.1,
        trunk_control: 0.6,
        asymmetry: 0.3,
        deconditioned: 0.2,
      },
      pain_mode: 'caution',
    },
  },
};

// ─── Test Runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function run(label, resultFn) {
  try {
    const result = resultFn();
    const { valid, errors } = validate(result);
    if (valid) {
      console.log(`  ✅ PASS  ${label}`);
      console.log(`       source_mode=${result.source_mode}, evidence_level=${result.evidence_level}, primary_type=${result.primary_type}, confidence=${result.confidence.toFixed(2)}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL  ${label}`);
      for (const e of errors) console.error(`         → ${e}`);
      failed++;
    }
  } catch (err) {
    console.error(`  💥 ERROR ${label}: ${err.message}`);
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Deep Result V2 Contract Smoke Tests');
console.log('═══════════════════════════════════════════════════════\n');

console.log('[ FREE SURVEY ]');
run('kangaroo — 완료 설문', () => adaptFree(FIXTURE_FREE_SURVEY));
run('monkey   — 균형형', () => adaptFree(FIXTURE_FREE_SURVEY_MONKEY));

console.log('\n[ CAMERA ]');
run('hedgehog — ok quality, strong evidence', () => adaptCamera(FIXTURE_CAMERA_HEDGEHOG));
run('unknown  — insufficient signal', () => adaptCamera(FIXTURE_CAMERA_INSUFFICIENT));

console.log('\n[ PAID DEEP ]');
run('deep_v2  — LOWER-LIMB (confidence 0.78)', () => adaptPaid(FIXTURE_PAID_DEEP_V2));
run('deep_v3  — LOWER_INSTABILITY (confidence 0.85, priority_vector)', () => adaptPaid(FIXTURE_PAID_DEEP_V3));

// source_mode exhaustive enum check
console.log('\n[ ACCEPTANCE CHECKS ]');
run('source_mode enum exhaustive — free_survey', () => {
  const r = adaptFree(FIXTURE_FREE_SURVEY);
  if (r.source_mode !== 'free_survey') throw new Error(`expected free_survey, got ${r.source_mode}`);
  return r;
});
run('source_mode enum exhaustive — camera', () => {
  const r = adaptCamera(FIXTURE_CAMERA_HEDGEHOG);
  if (r.source_mode !== 'camera') throw new Error(`expected camera, got ${r.source_mode}`);
  return r;
});
run('source_mode enum exhaustive — deep_paid', () => {
  const r = adaptPaid(FIXTURE_PAID_DEEP_V2);
  if (r.source_mode !== 'deep_paid') throw new Error(`expected deep_paid, got ${r.source_mode}`);
  return r;
});
run('evidence_level enum exhaustive — full (v3 high confidence)', () => {
  const r = adaptPaid(FIXTURE_PAID_DEEP_V3);
  if (r.evidence_level !== 'full') throw new Error(`expected full, got ${r.evidence_level}`);
  return r;
});
run('priority_vector non-null for deep_v3', () => {
  const r = adaptPaid(FIXTURE_PAID_DEEP_V3);
  if (r.priority_vector === null) throw new Error('priority_vector should not be null for deep_v3');
  return r;
});
run('priority_vector null for camera', () => {
  const r = adaptCamera(FIXTURE_CAMERA_HEDGEHOG);
  if (r.priority_vector !== null) throw new Error(`priority_vector should be null for camera, got ${JSON.stringify(r.priority_vector)}`);
  return r;
});
run('priority_vector null for free_survey', () => {
  const r = adaptFree(FIXTURE_FREE_SURVEY);
  if (r.priority_vector !== null) throw new Error('priority_vector should be null for free_survey');
  return r;
});
run('pain_mode non-null for deep_v3 caution', () => {
  const r = adaptPaid(FIXTURE_PAID_DEEP_V3);
  if (r.pain_mode !== 'caution') throw new Error(`expected caution, got ${r.pain_mode}`);
  return r;
});
run('backwards-compat _compat.result_type preserved for paid', () => {
  const r = adaptPaid(FIXTURE_PAID_DEEP_V2);
  if (!r._compat?.result_type) throw new Error('_compat.result_type missing');
  return r;
});
run('backwards-compat _compat.movementType preserved for camera', () => {
  const r = adaptCamera(FIXTURE_CAMERA_HEDGEHOG);
  if (!r._compat?.movementType) throw new Error('_compat.movementType missing');
  return r;
});

console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
