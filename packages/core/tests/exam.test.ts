import { describe, it, expect } from 'vitest';
import type { Question } from '@knowledge-test/schema';
import {
  buildComprehensivePaper,
  buildModulePaper,
  buildRetryWrongPaper,
  buildRandomPaper,
  computeMaxScore,
  computePassScore,
  configForActualQuestions,
  DEFAULT_EXAM_CONFIG,
} from '../src/exam/index.js';
import { isAnswerCorrect, scorePaper } from '../src/scoring/index.js';
import { mulberry32 } from '../src/random.js';

function makeQ(id: string, type: 'single' | 'multiple', module: string, correct: string[]): Question {
  return {
    id,
    type,
    module,
    stem: `Question ${id}`,
    options: [
      { id: 'A', text: 'A' },
      { id: 'B', text: 'B' },
      { id: 'C', text: 'C' },
      { id: 'D', text: 'D' },
    ],
    correctAnswers: correct,
    explanation: `expl ${id}`,
    optionExplanations: { A: 'a', B: 'b', C: 'c', D: 'd' },
    sourceRefs: [],
    misconceptionTags: [],
    distractorRationales: {},
    source: [],
    reviewStatus: 'agent_reviewed',
    version: 1,
  };
}

const singles: Question[] = Array.from({ length: 10 }, (_, i) => makeQ(`s${i}`, 'single', 'M1', ['A']));
const multiples: Question[] = Array.from({ length: 8 }, (_, i) => makeQ(`m${i}`, 'multiple', 'M1', ['A', 'B']));
const module2: Question[] = Array.from({ length: 3 }, (_, i) => makeQ(`x${i}`, 'single', 'M2', ['C']));
const pool = [...singles, ...multiples, ...module2];

describe('isAnswerCorrect', () => {
  const q = makeQ('t', 'multiple', 'M1', ['A', 'C']);
  it('exact match → true', () => expect(isAnswerCorrect(q, ['A', 'C'])).toBe(true));
  it('reordered match → true', () => expect(isAnswerCorrect(q, ['C', 'A'])).toBe(true));
  it('missing one → false', () => expect(isAnswerCorrect(q, ['A'])).toBe(false));
  it('extra one → false', () => expect(isAnswerCorrect(q, ['A', 'B', 'C'])).toBe(false));
  it('empty / undefined → false', () => {
    expect(isAnswerCorrect(q, [])).toBe(false);
    expect(isAnswerCorrect(q, undefined)).toBe(false);
  });
});

describe('scorePaper', () => {
  it('all-correct paper scores full marks', () => {
    const paper = buildComprehensivePaper(
      pool,
      { ...DEFAULT_EXAM_CONFIG, singleCount: 4, multipleCount: 2 },
      { rand: mulberry32(1) },
    );
    const answers: Record<string, string[]> = {};
    for (const q of paper.questions) answers[q.id] = [...q.correctAnswers];
    const result = scorePaper(paper, answers);
    expect(result.score).toBe(result.maxScore);
    expect(result.passed).toBe(true);
  });

  it('partial multiple choice earns 0 (no partial credit)', () => {
    const paper = buildComprehensivePaper(
      pool,
      { ...DEFAULT_EXAM_CONFIG, singleCount: 0, multipleCount: 2 },
      { rand: mulberry32(2) },
    );
    const answers: Record<string, string[]> = {};
    for (const q of paper.questions) answers[q.id] = [q.correctAnswers[0]]; // only one of two
    const result = scorePaper(paper, answers);
    expect(result.score).toBe(0);
    expect(result.multipleCorrect).toBe(0);
  });

  it('dynamic max score reflects actual mix', () => {
    // Ask for 40+20 but pool only has 13 singles (10 + 3) + 8 multi
    const paper = buildComprehensivePaper(pool, {
      ...DEFAULT_EXAM_CONFIG,
      singleCount: 40,
      multipleCount: 20,
    });
    expect(paper.config.singleCount).toBe(13);
    expect(paper.config.multipleCount).toBe(8);
    expect(paper.maxScore).toBe(13 * 2 + 8 * 3);
    expect(paper.passScore).toBe(Math.ceil((13 * 2 + 8 * 3) * 0.6));
  });

  it('pass threshold uses ceil', () => {
    const cfg = { ...DEFAULT_EXAM_CONFIG, singleCount: 5, multipleCount: 4 };
    // 5*2 + 4*3 = 22; 22*0.6 = 13.2 → ceil = 14
    expect(computeMaxScore(cfg)).toBe(22);
    expect(computePassScore(cfg)).toBe(14);
  });

  it('records wrong question ids', () => {
    const paper = buildComprehensivePaper(pool, {
      ...DEFAULT_EXAM_CONFIG,
      singleCount: 3,
      multipleCount: 0,
    });
    const answers: Record<string, string[]> = {};
    paper.questions.forEach((q, i) => {
      answers[q.id] = i === 0 ? ['Z'] : [...q.correctAnswers];
    });
    const result = scorePaper(paper, answers);
    expect(result.wrongQuestionIds).toContain(paper.questions[0].id);
    expect(result.wrongQuestionIds).toHaveLength(1);
  });
});

describe('buildComprehensivePaper', () => {
  it('does not produce duplicate questions', () => {
    const paper = buildComprehensivePaper(pool, { ...DEFAULT_EXAM_CONFIG, singleCount: 8, multipleCount: 5 });
    const ids = new Set(paper.questions.map((q) => q.id));
    expect(ids.size).toBe(paper.questions.length);
  });
});

describe('buildModulePaper', () => {
  it('only draws from the requested module', () => {
    const paper = buildModulePaper(pool, 'M2', { ...DEFAULT_EXAM_CONFIG, singleCount: 5, multipleCount: 0 });
    for (const q of paper.questions) expect(q.module).toBe('M2');
    expect(paper.questions).toHaveLength(3);
  });
});

describe('buildRetryWrongPaper', () => {
  it('reproduces exactly the requested ids', () => {
    const paper = buildRetryWrongPaper(pool, ['s0', 's3', 'm1'], 'source-exam');
    expect(new Set(paper.questions.map((q) => q.id))).toEqual(new Set(['s0', 's3', 'm1']));
    expect(paper.mode).toBe('retry-wrong');
    expect(paper.sourceExamId).toBe('source-exam');
  });
});

describe('buildRandomPaper', () => {
  it('samples up to `count` items without duplicates', () => {
    const p = buildRandomPaper(pool, 7, DEFAULT_EXAM_CONFIG, { rand: mulberry32(9) });
    expect(p.questions).toHaveLength(7);
    expect(new Set(p.questions.map((q) => q.id)).size).toBe(7);
  });
});

describe('configForActualQuestions', () => {
  it('recounts by type', () => {
    const cfg = configForActualQuestions([...singles.slice(0, 3), ...multiples.slice(0, 2)], DEFAULT_EXAM_CONFIG);
    expect(cfg.singleCount).toBe(3);
    expect(cfg.multipleCount).toBe(2);
  });
});
