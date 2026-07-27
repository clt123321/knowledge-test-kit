import { describe, it, expect, beforeEach } from 'vitest';
import { makeStorage, makeExamRecord, DEFAULT_SETTINGS, type ExamRecord } from '../src/storage/index.js';
import { scorePaper } from '../src/scoring/index.js';
import { buildComprehensivePaper, DEFAULT_EXAM_CONFIG } from '../src/exam/index.js';
import type { Question } from '@knowledge-test/schema';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  size() {
    return this.m.size;
  }
  keys() {
    return [...this.m.keys()];
  }
}

const mkQ = (id: string): Question => ({
  id,
  type: 'single',
  module: 'M1',
  stem: 'S',
  options: [
    { id: 'A', text: 'a' },
    { id: 'B', text: 'b' },
  ],
  correctAnswers: ['A'],
  explanation: 'e',
  optionExplanations: { A: 'a', B: 'b' },
  sourceRefs: [],
  misconceptionTags: [],
  distractorRationales: {},
  source: [],
  reviewStatus: 'agent_reviewed',
  version: 1,
});

const pool = [mkQ('q1'), mkQ('q2'), mkQ('q3')];

describe('makeStorage', () => {
  let store: MemStorage;
  let bankA: ReturnType<typeof makeStorage>;
  let bankB: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    store = new MemStorage();
    bankA = makeStorage({ bankId: 'demo', storage: store });
    bankB = makeStorage({ bankId: 'rl', storage: store });
  });

  it('namespaces keys by bank id', () => {
    bankA.saveSettings({ ...DEFAULT_SETTINGS, includeDraft: true });
    bankB.saveSettings({ ...DEFAULT_SETTINGS, includeDraft: false });
    expect(bankA.loadSettings().includeDraft).toBe(true);
    expect(bankB.loadSettings().includeDraft).toBe(false);
    expect(store.keys().some((k) => k.startsWith('knowledge-test:demo:'))).toBe(true);
    expect(store.keys().some((k) => k.startsWith('knowledge-test:rl:'))).toBe(true);
  });

  it('addRecord / findRecord / deleteRecord round-trip', () => {
    const paper = buildComprehensivePaper(pool, { ...DEFAULT_EXAM_CONFIG, singleCount: 3, multipleCount: 0 });
    const scoring = scorePaper(paper, Object.fromEntries(paper.questions.map((q) => [q.id, [...q.correctAnswers]])));
    const record = makeExamRecord({
      examId: 'e-1',
      bankId: 'demo',
      mode: paper.mode,
      startedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      questionIds: paper.questions.map((q) => q.id),
      questionTypes: Object.fromEntries(paper.questions.map((q) => [q.id, q.type])),
      answers: Object.fromEntries(paper.questions.map((q) => [q.id, [...q.correctAnswers]])),
      confidence: {},
      scoring,
      scoringRules: {
        singleScore: paper.config.singleScore,
        multipleScore: paper.config.multipleScore,
        passRatio: paper.config.passRatio,
      },
    });
    bankA.addRecord(record);
    expect(bankA.findRecord('e-1')).toBeDefined();
    bankA.deleteRecord('e-1');
    expect(bankA.findRecord('e-1')).toBeUndefined();
  });

  it('replaceAllRecords imports a batch', () => {
    const r: ExamRecord = {
      examId: 'imp-1',
      bankId: 'demo',
      mode: 'comprehensive',
      startedAt: '',
      submittedAt: '',
      questionIds: [],
      answers: {},
      confidence: {},
      score: 0,
      maxScore: 0,
      passScore: 0,
      passed: false,
      singleCorrect: 0,
      singleTotal: 0,
      multipleCorrect: 0,
      multipleTotal: 0,
      wrongQuestionIds: [],
      scoringVersion: 1,
      scoringRules: { singleScore: 2, multipleScore: 3, passRatio: 0.6 },
      questionTypes: {},
    };
    bankA.replaceAllRecords([r, r, r]);
    expect(bankA.loadRecords()).toHaveLength(3);
  });

  it('caps records at maxRecords', () => {
    const capped = makeStorage({ bankId: 'demo', storage: store, maxRecords: 5 });
    const rec = (id: string): ExamRecord => ({
      examId: id,
      bankId: 'demo',
      mode: 'comprehensive',
      startedAt: '',
      submittedAt: '',
      questionIds: [],
      answers: {},
      confidence: {},
      score: 0,
      maxScore: 0,
      passScore: 0,
      passed: false,
      singleCorrect: 0,
      singleTotal: 0,
      multipleCorrect: 0,
      multipleTotal: 0,
      wrongQuestionIds: [],
      scoringVersion: 1,
      scoringRules: { singleScore: 2, multipleScore: 3, passRatio: 0.6 },
      questionTypes: {},
    });
    capped.replaceAllRecords([rec('a'), rec('b'), rec('c'), rec('d'), rec('e'), rec('f')]);
    expect(capped.loadRecords()).toHaveLength(5);
  });
});
