import type { DeepAnswerValue } from '../types';
import type { DeepV1Result, DeepV1Scores } from '../types';

const SCORING_VERSION = 'deep_v1';
const QUESTION_TO_AXIS: Record<string, 1|2|3|4|5> = { d1:1, d2:2, d3:3, d4:4, d5:5 };
const WEIGHT = 1;

function toNumber(v: DeepAnswerValue): number|null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') { const n = parseFloat(v); return Number.isNaN(n) ? null : n; }
  return null;
}

export function calculateDeepV1(answers: Record<string, DeepAnswerValue>): DeepV1Result {
  const raw: DeepV1Scores = { t1:0, t2:0, t3:0, t4:0, t5:0 };
  for (const [qId, value] of Object.entries(answers)) {
    const axis = QUESTION_TO_AXIS[qId];
    if (!axis) continue;
    const n = toNumber(value);
    if (n !== null) raw[`t${axis}` as keyof DeepV1Scores] += n * WEIGHT;
  }
  const maxPerAxis = 4;
  const scores: DeepV1Scores = {
    t1: Math.min(1, raw.t1/maxPerAxis), t2: Math.min(1, raw.t2/maxPerAxis),
    t3: Math.min(1, raw.t3/maxPerAxis), t4: Math.min(1, raw.t4/maxPerAxis),
    t5: Math.min(1, raw.t5/maxPerAxis),
  };
  const entries = [['T1',scores.t1],['T2',scores.t2],['T3',scores.t3],['T4',scores.t4],['T5',scores.t5]] as const;
  entries.sort((a,b)=>b[1]-a[1]);
  const result_type = entries[0][0];
  let answeredCount = 0;
  for (const [id,v] of Object.entries(answers)) {
    if (QUESTION_TO_AXIS[id] && toNumber(v) !== null) answeredCount += 1;
  }
  const confidence = 5 > 0 ? Math.round((answeredCount/5)*100)/100 : 0;
  return { scores, result_type, confidence };
}

export { SCORING_VERSION };