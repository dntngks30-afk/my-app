import type {
    Answer,
    MultipleAnswer,
    Question,
    TypeScores,
    MovementType,
    SubType,
    TestResult,
  } from '../../types/movement-test';
  import { isMultipleAnswer, isMultipleQuestion } from '../../types/movement-test';
  
  const WEIGHTS = [1.0, 0.5] as const;
  
  const emptyScores = (): TypeScores => ({
    담직: 0,
    날림: 0,
    버팀: 0,
    흘림: 0,
  });
  
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  
  const toMainType = (scores: TypeScores): MovementType => {
    const entries: Array<[MovementType, number]> = [
      ['담직', scores.담직],
      ['날림', scores.날림],
      ['버팀', scores.버팀],
      ['흘림', scores.흘림],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };
  
  const confidenceFromScores = (scores: TypeScores): number => {
    const arr = [scores.담직, scores.날림, scores.버팀, scores.흘림].slice().sort((a, b) => b - a);
    const top = arr[0] ?? 0;
    const second = arr[1] ?? 0;
    const total = arr.reduce((s, v) => s + v, 0);
    if (total <= 0) return 0;
  
    const ratio = (top - second) / total;
    const conf = 50 + ratio * 50;
    return Math.round(clamp(conf, 0, 100));
  };
  
  const GROUP_SUBTYPES: Record<MovementType, SubType[]> = {
    담직: ['담직-상체고착형', '담직-하체고착형', '담직-호흡잠김형', '담직-전신둔화형'],
    날림: ['날림-관절흐름형', '날림-중심이탈형', '날림-좌우불균형형', '날림-동작과속형'],
    버팀: ['버팀-허리의존형', '버팀-목어깨과로형', '버팀-무릎집중형', '버팀-단측지배형'],
    흘림: ['흘림-힘누수형', '흘림-체인단절형', '흘림-비대칭전달형', '흘림-효율저하형'],
  };
  
  const resolveSubType = (mainType: MovementType, answers: Answer[], questions: Question[]): SubType => {
    const candidates = GROUP_SUBTYPES[mainType];
    const subScore = new Map<SubType, number>(candidates.map((s) => [s, 0]));
  
    for (const a of answers) {
      if (!isMultipleAnswer(a)) continue;
  
      const q = questions.find((qq) => qq.id === a.questionId);
      if (!q || !isMultipleQuestion(q) || !q.options) continue;
  
      if (q.subTypeWeight !== true) continue;
  
      const ids = (a as MultipleAnswer).selectedOptionIds?.slice(0, 2) ?? [];
      for (let i = 0; i < ids.length; i++) {
        const opt = q.options.find((o) => o.id === ids[i]);
        if (!opt) continue;
  
        const mod = opt.subTypeModifier;
        if (!mod) continue;
  
        if ((candidates as unknown as string[]).includes(mod)) {
          const st = mod as SubType;
          const w = WEIGHTS[i] ?? 0;
          const optScore = typeof opt.score === 'number' ? opt.score : 1;
          subScore.set(st, (subScore.get(st) ?? 0) + optScore * w);
        }
      }
    }
  
    const sorted = Array.from(subScore.entries()).sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    if (!best) return candidates[candidates.length - 1];
    if (best[1] <= 0) return candidates[candidates.length - 1];
    return best[0];
  };
  
  const addToTypeScores = (typeScores: TypeScores, type: MovementType, value: number) => {
    typeScores[type] += value;
  };
  
  export const calculateTestResult = (answers: Answer[], questions: Question[]): TestResult => {
    const typeScores = emptyScores();
  
    for (const ans of answers) {
      if (isMultipleAnswer(ans)) {
        const q = questions.find((qq) => qq.id === ans.questionId);
        if (!q || !isMultipleQuestion(q) || !q.options) continue;
  
        const ids = (ans as MultipleAnswer).selectedOptionIds?.slice(0, 2) ?? [];
        for (let i = 0; i < ids.length; i++) {
          const opt = q.options.find((o) => o.id === ids[i]);
          if (!opt) continue;
  
          const w = WEIGHTS[i] ?? 0;
          const optScore = typeof opt.score === 'number' ? opt.score : 1;
  
          addToTypeScores(typeScores, opt.type, optScore * w);
        }
      }
    }
  
    const mainType = toMainType(typeScores);
    const confidence = confidenceFromScores(typeScores);
    const subType = resolveSubType(mainType, answers, questions);
  
    return {
      mainType,
      subType,
      typeScores,
      confidence,
      completedAt: new Date().toISOString(),
      answers,
    };
  };
  