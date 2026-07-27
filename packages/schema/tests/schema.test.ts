import { describe, it, expect } from 'vitest';
import {
  BaseQuestionSchema,
  extendQuestionSchema,
  normalizeReviewStatus,
  validateQuestions,
  KnowledgeTestConfigSchema,
} from '../src/index.js';

const goodSingle = {
  id: 'Q-1',
  type: 'single' as const,
  module: 'basics',
  subtopic: 'variables',
  difficulty: 2,
  stem: 'Which JavaScript keyword declares a block-scoped variable?',
  options: [
    { id: 'A', text: 'var' },
    { id: 'B', text: 'let' },
    { id: 'C', text: 'const' },
    { id: 'D', text: 'define' },
  ],
  correctAnswers: ['B'],
  explanation: '`let` is block-scoped as of ES2015.',
  optionExplanations: {
    A: 'function-scoped',
    B: 'correct',
    C: 'also block scoped but immutable binding',
    D: 'not a keyword',
  },
  reviewStatus: 'agent_reviewed' as const,
  version: 1,
};

const goodMultiple = {
  ...goodSingle,
  id: 'Q-2',
  type: 'multiple' as const,
  correctAnswers: ['B', 'C'],
};

describe('BaseQuestionSchema', () => {
  it('accepts a good single-choice question', () => {
    expect(BaseQuestionSchema.safeParse(goodSingle).success).toBe(true);
  });

  it('accepts a good multiple-choice question', () => {
    expect(BaseQuestionSchema.safeParse(goodMultiple).success).toBe(true);
  });

  it('rejects a single-choice question with 2 correct answers', () => {
    const res = BaseQuestionSchema.safeParse({
      ...goodSingle,
      correctAnswers: ['A', 'B'],
    });
    expect(res.success).toBe(false);
  });

  it('rejects a multiple-choice question with only 1 correct answer', () => {
    const res = BaseQuestionSchema.safeParse({
      ...goodMultiple,
      correctAnswers: ['B'],
    });
    expect(res.success).toBe(false);
  });

  it('rejects a question whose correct answer is not in options', () => {
    const res = BaseQuestionSchema.safeParse({
      ...goodSingle,
      correctAnswers: ['Z'],
    });
    expect(res.success).toBe(false);
  });

  it('rejects duplicate option ids', () => {
    const res = BaseQuestionSchema.safeParse({
      ...goodSingle,
      options: [
        { id: 'A', text: 'a' },
        { id: 'A', text: 'b' },
        { id: 'C', text: 'c' },
      ],
    });
    expect(res.success).toBe(false);
  });

  it('accepts the legacy `reviewed` status as a raw value', () => {
    const res = BaseQuestionSchema.safeParse({
      ...goodSingle,
      reviewStatus: 'reviewed',
    });
    expect(res.success).toBe(true);
  });
});

describe('extendQuestionSchema', () => {
  const schema = extendQuestionSchema({
    moduleIds: ['basics', 'advanced'],
    requireOptionExplanations: true,
    requireSourceRefs: true,
  });

  it('rejects an unknown module', () => {
    const res = schema.safeParse({ ...goodSingle, module: 'nope' });
    expect(res.success).toBe(false);
  });

  it('rejects when optionExplanations is missing an option', () => {
    const res = schema.safeParse({
      ...goodSingle,
      optionExplanations: { A: 'x' },
    });
    expect(res.success).toBe(false);
  });

  it('rejects when sourceRefs is empty on a non-deprecated question', () => {
    const res = schema.safeParse({ ...goodSingle, sourceRefs: [] });
    expect(res.success).toBe(false);
  });

  it('allows deprecated questions to have empty sourceRefs', () => {
    const res = schema.safeParse({
      ...goodSingle,
      reviewStatus: 'deprecated',
      sourceRefs: [],
    });
    expect(res.success).toBe(true);
  });
});

describe('normalizeReviewStatus', () => {
  it('folds legacy `reviewed` into `agent_reviewed`', () => {
    expect(normalizeReviewStatus('reviewed')).toBe('agent_reviewed');
  });
  it('keeps canonical statuses as-is', () => {
    expect(normalizeReviewStatus('draft')).toBe('draft');
    expect(normalizeReviewStatus('agent_reviewed')).toBe('agent_reviewed');
    expect(normalizeReviewStatus('human_reviewed')).toBe('human_reviewed');
    expect(normalizeReviewStatus('deprecated')).toBe('deprecated');
  });
  it('falls back to draft on unknown', () => {
    expect(normalizeReviewStatus('unicorn')).toBe('draft');
  });
});

describe('validateQuestions', () => {
  it('flags duplicate ids across the input list', () => {
    const result = validateQuestions([goodSingle, goodSingle]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });
  it('returns parsed questions when ok', () => {
    const result = validateQuestions([goodSingle, goodMultiple]);
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(2);
  });
});

describe('KnowledgeTestConfigSchema', () => {
  it('fills sensible defaults', () => {
    const cfg = KnowledgeTestConfigSchema.parse({
      site: { id: 'demo', title: 'Demo' },
    });
    expect(cfg.exam.passingRatio).toBe(0.6);
    expect(cfg.content.questionGlobs).toEqual(['questions/**/*.json']);
    expect(cfg.review.publicStatuses).toEqual(['agent_reviewed', 'human_reviewed']);
  });
});
