import type { Question } from '@knowledge-test/schema';
import { shuffle, sampleUnique } from '../random.js';

export type ExamMode = 'comprehensive' | 'module' | 'retry-wrong' | 'random';

export interface ExamRuntimeConfig {
  singleCount: number;
  multipleCount: number;
  singleScore: number;
  multipleScore: number;
  passRatio: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export const DEFAULT_EXAM_CONFIG: ExamRuntimeConfig = {
  singleCount: 20,
  multipleCount: 10,
  singleScore: 2,
  multipleScore: 3,
  passRatio: 0.6,
  shuffleQuestions: true,
  shuffleOptions: true,
};

export interface ExamPaper {
  id: string;
  mode: ExamMode;
  moduleId?: string;
  sourceExamId?: string;
  questions: Question[];
  config: ExamRuntimeConfig;
  maxScore: number;
  passScore: number;
}

export function computeMaxScore(cfg: ExamRuntimeConfig): number {
  return cfg.singleCount * cfg.singleScore + cfg.multipleCount * cfg.multipleScore;
}

export function computePassScore(cfg: ExamRuntimeConfig): number {
  return Math.ceil(computeMaxScore(cfg) * cfg.passRatio);
}

/** Recount `singleCount`/`multipleCount` based on the actual sampled set. */
export function configForActualQuestions(
  questions: readonly Question[],
  config: ExamRuntimeConfig,
): ExamRuntimeConfig {
  let single = 0;
  let multiple = 0;
  for (const q of questions) {
    if (q.type === 'single') single++;
    else multiple++;
  }
  return { ...config, singleCount: single, multipleCount: multiple };
}

function withOptionShuffle(q: Question, shouldShuffle: boolean, rand?: () => number): Question {
  if (!shouldShuffle) return q;
  return { ...q, options: shuffle(q.options, rand) };
}

function finalizePaper(input: {
  id: string;
  mode: ExamMode;
  moduleId?: string;
  sourceExamId?: string;
  questions: Question[];
  config: ExamRuntimeConfig;
  rand?: () => number;
}): ExamPaper {
  const { id, mode, moduleId, sourceExamId, questions, config, rand } = input;
  const list = config.shuffleQuestions ? shuffle(questions, rand) : [...questions];
  const withOptions = list.map((q) => withOptionShuffle(q, config.shuffleOptions, rand));
  const actualConfig = configForActualQuestions(withOptions, config);
  return {
    id,
    mode,
    moduleId,
    sourceExamId,
    questions: withOptions,
    config: actualConfig,
    maxScore: computeMaxScore(actualConfig),
    passScore: computePassScore(actualConfig),
  };
}

export function buildComprehensivePaper(
  pool: readonly Question[],
  config: ExamRuntimeConfig = DEFAULT_EXAM_CONFIG,
  opts: { id?: string; rand?: () => number } = {},
): ExamPaper {
  const singles = pool.filter((q) => q.type === 'single');
  const multiples = pool.filter((q) => q.type === 'multiple');
  const picked = [
    ...sampleUnique(singles, config.singleCount, opts.rand),
    ...sampleUnique(multiples, config.multipleCount, opts.rand),
  ];
  return finalizePaper({
    id: opts.id ?? cryptoRandom(),
    mode: 'comprehensive',
    questions: picked,
    config,
    rand: opts.rand,
  });
}

export function buildModulePaper(
  pool: readonly Question[],
  moduleId: string,
  config: ExamRuntimeConfig = DEFAULT_EXAM_CONFIG,
  opts: { id?: string; rand?: () => number } = {},
): ExamPaper {
  const inModule = pool.filter((q) => q.module === moduleId);
  const singles = inModule.filter((q) => q.type === 'single');
  const multiples = inModule.filter((q) => q.type === 'multiple');
  const picked = [
    ...sampleUnique(singles, config.singleCount, opts.rand),
    ...sampleUnique(multiples, config.multipleCount, opts.rand),
  ];
  return finalizePaper({
    id: opts.id ?? cryptoRandom(),
    mode: 'module',
    moduleId,
    questions: picked,
    config,
    rand: opts.rand,
  });
}

export function buildRetryWrongPaper(
  pool: readonly Question[],
  wrongIds: readonly string[],
  sourceExamId: string,
  config: ExamRuntimeConfig = DEFAULT_EXAM_CONFIG,
  opts: { id?: string; rand?: () => number } = {},
): ExamPaper {
  const set = new Set(wrongIds);
  const picked = pool.filter((q) => set.has(q.id));
  return finalizePaper({
    id: opts.id ?? cryptoRandom(),
    mode: 'retry-wrong',
    sourceExamId,
    questions: picked,
    config: { ...config, shuffleQuestions: config.shuffleQuestions },
    rand: opts.rand,
  });
}

export function buildRandomPaper(
  pool: readonly Question[],
  count: number,
  config: ExamRuntimeConfig = DEFAULT_EXAM_CONFIG,
  opts: { id?: string; rand?: () => number } = {},
): ExamPaper {
  const picked = sampleUnique(pool, count, opts.rand);
  return finalizePaper({
    id: opts.id ?? cryptoRandom(),
    mode: 'random',
    questions: picked,
    config,
    rand: opts.rand,
  });
}

function cryptoRandom(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Math.random().toString(36).slice(2, 12);
}
