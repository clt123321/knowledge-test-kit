import type { UserAnswers, UserConfidence, ExamScoreResult } from '../scoring/index.js';
import type { ExamMode, ExamRuntimeConfig } from '../exam/index.js';

/**
 * Persisted exam record. Written on submit; used by the result page,
 * the history list, and the "retry wrong" flow.
 */
export interface ExamRecord {
  examId: string;
  bankId: string;
  mode: ExamMode;
  moduleId?: string;
  sourceExamId?: string;
  startedAt: string; // ISO
  submittedAt: string; // ISO
  questionIds: string[];
  answers: UserAnswers;
  confidence: UserConfidence;
  score: number;
  maxScore: number;
  passScore: number;
  passed: boolean;
  singleCorrect: number;
  singleTotal: number;
  multipleCorrect: number;
  multipleTotal: number;
  wrongQuestionIds: string[];
  scoringVersion: number;
  scoringRules: Pick<ExamRuntimeConfig, 'singleScore' | 'multipleScore' | 'passRatio'>;
  questionTypes: Record<string, 'single' | 'multiple'>;
  /** Filled on read when a legacy record was rescored. */
  scoreCorrection?: {
    reason: 'legacy_score_metadata_mismatch';
    original: { score: number; maxScore: number; passScore: number; passed: boolean };
  };
}

export const CURRENT_SCORING_VERSION = 1;

export interface AppSettings {
  confidenceEnabled: boolean;
  includeDraft: boolean;
  theme?: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  confidenceEnabled: false,
  includeDraft: false,
  theme: 'system',
};

/* -------------------------------------------------------------------------- */
/*  Storage abstraction — the browser passes `window.localStorage`; Node      */
/*  tests pass a mock.                                                        */
/* -------------------------------------------------------------------------- */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageOptions {
  bankId: string;
  storage: StorageLike;
  maxRecords?: number;
}

export * from './progress.js';

export function makeStorage(opts: StorageOptions) {
  const { bankId, storage, maxRecords = 200 } = opts;
  const prefix = `knowledge-test:${bankId}`;
  const RECORDS_KEY = `${prefix}:records:v1`;
  const SETTINGS_KEY = `${prefix}:settings:v1`;

  function safeGet<T>(key: string, fallback: T): T {
    try {
      const raw = storage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  function safeSet(key: string, value: unknown): void {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded, private mode, etc. — swallow */
    }
  }

  function loadRecords(): ExamRecord[] {
    return safeGet<ExamRecord[]>(RECORDS_KEY, []);
  }
  function saveRecords(records: ExamRecord[]): void {
    const capped = records.slice(0, maxRecords);
    safeSet(RECORDS_KEY, capped);
  }
  function addRecord(record: ExamRecord): void {
    const cur = loadRecords();
    cur.unshift(record);
    saveRecords(cur);
  }
  function findRecord(examId: string): ExamRecord | undefined {
    return loadRecords().find((r) => r.examId === examId);
  }
  function deleteRecord(examId: string): void {
    saveRecords(loadRecords().filter((r) => r.examId !== examId));
  }
  function clearRecords(): void {
    try {
      storage.removeItem(RECORDS_KEY);
    } catch {
      /* ignore */
    }
  }
  function replaceAllRecords(records: ExamRecord[]): void {
    saveRecords(records);
  }

  function loadSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...safeGet<Partial<AppSettings>>(SETTINGS_KEY, {}) };
  }
  function saveSettings(s: AppSettings): void {
    safeSet(SETTINGS_KEY, s);
  }

  return {
    keys: { records: RECORDS_KEY, settings: SETTINGS_KEY, prefix },
    loadRecords,
    saveRecords,
    addRecord,
    findRecord,
    deleteRecord,
    clearRecords,
    replaceAllRecords,
    loadSettings,
    saveSettings,
  };
}

/** Build an ExamRecord from paper metadata + a scoring result. */
export function makeExamRecord(input: {
  examId: string;
  bankId: string;
  mode: ExamMode;
  moduleId?: string;
  sourceExamId?: string;
  startedAt: string;
  submittedAt: string;
  questionIds: string[];
  questionTypes: Record<string, 'single' | 'multiple'>;
  answers: UserAnswers;
  confidence: UserConfidence;
  scoring: ExamScoreResult;
  scoringRules: Pick<ExamRuntimeConfig, 'singleScore' | 'multipleScore' | 'passRatio'>;
}): ExamRecord {
  return {
    examId: input.examId,
    bankId: input.bankId,
    mode: input.mode,
    moduleId: input.moduleId,
    sourceExamId: input.sourceExamId,
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    questionIds: input.questionIds,
    answers: input.answers,
    confidence: input.confidence,
    score: input.scoring.score,
    maxScore: input.scoring.maxScore,
    passScore: input.scoring.passScore,
    passed: input.scoring.passed,
    singleCorrect: input.scoring.singleCorrect,
    singleTotal: input.scoring.singleTotal,
    multipleCorrect: input.scoring.multipleCorrect,
    multipleTotal: input.scoring.multipleTotal,
    wrongQuestionIds: [...input.scoring.wrongQuestionIds],
    scoringVersion: CURRENT_SCORING_VERSION,
    scoringRules: input.scoringRules,
    questionTypes: input.questionTypes,
  };
}
