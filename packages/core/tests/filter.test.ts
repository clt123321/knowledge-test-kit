import { describe, it, expect } from 'vitest';
import type { Question } from '@knowledge-test/schema';
import { filterQuestions, statusDistribution } from '../src/filtering/index.js';

function q(id: string, status: string, module = 'M1', overrides: Partial<Question> = {}): Question {
  return {
    id,
    type: 'single',
    module,
    stem: 'stem ' + id,
    options: [
      { id: 'A', text: 'a' },
      { id: 'B', text: 'b' },
    ],
    correctAnswers: ['A'],
    explanation: 'x',
    optionExplanations: { A: 'a', B: 'b' },
    sourceRefs: [],
    misconceptionTags: [],
    distractorRationales: {},
    source: [],
    reviewStatus: status as Question['reviewStatus'],
    version: 1,
    ...overrides,
  };
}

const pool = [
  q('a', 'agent_reviewed'),
  q('b', 'human_reviewed'),
  q('c', 'draft'),
  q('d', 'deprecated'),
  q('e', 'reviewed'), // legacy → normalized to agent_reviewed
  q('f', 'agent_reviewed', 'M2'),
];

describe('filterQuestions', () => {
  it('excludes deprecated always', () => {
    const out = filterQuestions(pool, { includeDraft: true });
    expect(out.map((q) => q.id)).not.toContain('d');
  });
  it('excludes draft by default', () => {
    const out = filterQuestions(pool);
    expect(out.map((q) => q.id)).not.toContain('c');
  });
  it('includes draft when includeDraft=true', () => {
    const out = filterQuestions(pool, { includeDraft: true });
    expect(out.map((q) => q.id)).toContain('c');
  });
  it('normalizes legacy reviewed → agent_reviewed', () => {
    const out = filterQuestions(pool);
    expect(out.map((q) => q.id)).toContain('e');
  });
  it('respects module filter', () => {
    const out = filterQuestions(pool, { moduleId: 'M2' });
    expect(out.map((q) => q.id)).toEqual(['f']);
  });
  it('keyword search hits stems', () => {
    const out = filterQuestions([q('kw', 'agent_reviewed', 'M1', { stem: 'pandas dataframe' })], { keyword: 'panda' });
    expect(out).toHaveLength(1);
  });
});

describe('statusDistribution', () => {
  it('counts by normalized status', () => {
    const dist = statusDistribution(pool);
    expect(dist.agent_reviewed).toBe(3); // a, e, f
    expect(dist.human_reviewed).toBe(1);
    expect(dist.draft).toBe(1);
    expect(dist.deprecated).toBe(1);
  });
});
