import type { Question } from '@knowledge-test/schema';
import {
  type ExamPaper,
  type ExamRuntimeConfig,
  computeMaxScore,
  computePassScore,
  configForActualQuestions,
  DEFAULT_EXAM_CONFIG,
} from '../exam/index.js';

export type UserAnswers = Record<string, string[]>;
export type UserConfidence = Record<string, 'low' | 'medium' | 'high'>;

export interface QuestionScoreDetail {
  questionId: string;
  type: 'single' | 'multiple';
  correct: boolean;
  earned: number;
  fullScore: number;
  userAnswer: string[];
  correctAnswer: string[];
}

export interface ExamScoreResult {
  score: number;
  maxScore: number;
  passScore: number;
  passed: boolean;
  singleCorrect: number;
  singleTotal: number;
  multipleCorrect: number;
  multipleTotal: number;
  wrongQuestionIds: string[];
  details: QuestionScoreDetail[];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const v of b) if (!s.has(v)) return false;
  return true;
}

export function isAnswerCorrect(question: Question, userAnswer: readonly string[] | undefined): boolean {
  if (!userAnswer || userAnswer.length === 0) return false;
  return sameSet(userAnswer, question.correctAnswers);
}

/**
 * Score a paper against a user's answers.
 *
 * Follows the RL bank's rule set:
 *   - single choice: full points on exact match, 0 otherwise
 *   - multiple choice: full points on exact match, 0 on any deviation
 *   - max score is recomputed from actual question mix
 *   - pass threshold = ceil(maxScore * passRatio)
 */
export function scorePaper(paper: ExamPaper, answers: UserAnswers): ExamScoreResult {
  const config = configForActualQuestions(paper.questions, paper.config);
  const maxScore = computeMaxScore(config);
  const passScore = computePassScore(config);

  let score = 0;
  let singleCorrect = 0;
  let multipleCorrect = 0;
  let singleTotal = 0;
  let multipleTotal = 0;
  const details: QuestionScoreDetail[] = [];
  const wrongQuestionIds: string[] = [];

  for (const q of paper.questions) {
    const userAnswer = answers[q.id] ?? [];
    const correct = isAnswerCorrect(q, userAnswer);
    const fullScore = q.type === 'single' ? config.singleScore : config.multipleScore;
    const earned = correct ? fullScore : 0;
    score += earned;
    if (q.type === 'single') {
      singleTotal++;
      if (correct) singleCorrect++;
    } else {
      multipleTotal++;
      if (correct) multipleCorrect++;
    }
    if (!correct) wrongQuestionIds.push(q.id);
    details.push({
      questionId: q.id,
      type: q.type,
      correct,
      earned,
      fullScore,
      userAnswer: [...userAnswer],
      correctAnswer: [...q.correctAnswers],
    });
  }

  return {
    score,
    maxScore,
    passScore,
    passed: score >= passScore,
    singleCorrect,
    singleTotal,
    multipleCorrect,
    multipleTotal,
    wrongQuestionIds,
    details,
  };
}

/**
 * Re-derive score for a persisted exam record whose questions may have moved
 * or whose scoring rules may have been updated. Never mutates the input.
 */
export interface RawExamRecord {
  score?: number;
  maxScore?: number;
  passScore?: number;
  passed?: boolean;
  questionIds?: string[];
  answers?: UserAnswers;
  questionTypes?: Record<string, 'single' | 'multiple'>;
  scoringRules?: Partial<Pick<ExamRuntimeConfig, 'singleScore' | 'multipleScore' | 'passRatio'>>;
  [key: string]: unknown;
}

export function deriveExamRecordScore(
  record: RawExamRecord,
  cfg: ExamRuntimeConfig = DEFAULT_EXAM_CONFIG,
): {
  score: number;
  maxScore: number;
  passScore: number;
  passed: boolean;
  legacyMismatch: boolean;
} {
  const rules: ExamRuntimeConfig = {
    ...cfg,
    ...(record.scoringRules ?? {}),
  };

  if (!record.questionTypes || !record.questionIds) {
    // Not enough info to recompute — trust the record.
    return {
      score: record.score ?? 0,
      maxScore: record.maxScore ?? 0,
      passScore: record.passScore ?? 0,
      passed: record.passed ?? false,
      legacyMismatch: false,
    };
  }

  let singleCount = 0;
  let multipleCount = 0;
  for (const qid of record.questionIds) {
    const t = record.questionTypes[qid];
    if (t === 'single') singleCount++;
    else if (t === 'multiple') multipleCount++;
  }
  const conf: ExamRuntimeConfig = { ...rules, singleCount, multipleCount };
  const maxScore = computeMaxScore(conf);
  const passScore = computePassScore(conf);
  const score = record.score ?? 0;
  const passed = score >= passScore;

  const legacyMismatch =
    (record.maxScore ?? maxScore) !== maxScore ||
    (record.passScore ?? passScore) !== passScore;

  return { score, maxScore, passScore, passed, legacyMismatch };
}
