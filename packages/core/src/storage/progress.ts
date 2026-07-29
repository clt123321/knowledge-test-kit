export interface PracticeProgressQuestionLike {
  id: string;
  module: string;
}

export interface PracticeProgressRecordLike {
  examId: string;
  submittedAt: string;
  questionIds: readonly string[];
  wrongQuestionIds: readonly string[];
  score: number;
  maxScore: number;
}

export interface ModuleCoverageSummary {
  moduleId: string;
  totalQuestions: number;
  coveredQuestions: number;
  coverageRatio: number;
}

export interface RecentAccuracyPoint {
  examId: string;
  submittedAt: string;
  accuracyRatio: number;
  score: number;
  maxScore: number;
  questionCount: number;
  wrongCount: number;
}

export interface PracticeProgressSummary {
  totalQuestions: number;
  totalAttempts: number;
  coveredQuestions: number;
  coverageRatio: number;
  uniqueWrongQuestions: number;
  wrongRatio: number;
  recent7DayAttempts: number;
  moduleCoverage: ModuleCoverageSummary[];
  recentAccuracy: RecentAccuracyPoint[];
}

export interface SummarizePracticeProgressInput {
  questions: readonly PracticeProgressQuestionLike[];
  records: readonly PracticeProgressRecordLike[];
  now?: Date | string | number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toMillis(value: Date | string | number): number | null {
  const millis = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
}

export function summarizePracticeProgress(
  input: SummarizePracticeProgressInput,
): PracticeProgressSummary {
  const questionIds = new Set<string>();
  const questionModule = new Map<string, string>();
  const moduleTotals = new Map<string, number>();

  for (const question of input.questions) {
    questionIds.add(question.id);
    questionModule.set(question.id, question.module);
    moduleTotals.set(question.module, (moduleTotals.get(question.module) ?? 0) + 1);
  }

  const coveredIds = new Set<string>();
  const wrongIds = new Set<string>();

  for (const record of input.records) {
    for (const qid of record.questionIds) {
      if (questionIds.has(qid)) coveredIds.add(qid);
    }
    for (const qid of record.wrongQuestionIds) {
      if (questionIds.has(qid)) wrongIds.add(qid);
    }
  }

  const moduleCovered = new Map<string, number>();
  for (const qid of coveredIds) {
    const moduleId = questionModule.get(qid);
    if (!moduleId) continue;
    moduleCovered.set(moduleId, (moduleCovered.get(moduleId) ?? 0) + 1);
  }

  const moduleCoverage: ModuleCoverageSummary[] = Array.from(moduleTotals.entries()).map(
    ([moduleId, totalQuestions]) => {
      const coveredQuestions = moduleCovered.get(moduleId) ?? 0;
      return {
        moduleId,
        totalQuestions,
        coveredQuestions,
        coverageRatio: totalQuestions > 0 ? coveredQuestions / totalQuestions : 0,
      };
    },
  );

  const nowMs = toMillis(input.now ?? new Date()) ?? Date.now();
  const recent7DayAttempts = input.records.filter((record) => {
    const submittedMs = toMillis(record.submittedAt);
    return submittedMs != null && submittedMs >= nowMs - WEEK_MS && submittedMs <= nowMs;
  }).length;

  const recentAccuracy = input.records
    .map((record) => {
      const submittedMs = toMillis(record.submittedAt);
      if (submittedMs == null || record.maxScore <= 0) return null;
      return {
        examId: record.examId,
        submittedAt: record.submittedAt,
        submittedMs,
        accuracyRatio: record.score / record.maxScore,
        score: record.score,
        maxScore: record.maxScore,
        questionCount: record.questionIds.length,
        wrongCount: record.wrongQuestionIds.length,
      };
    })
    .filter((record): record is RecentAccuracyPoint & { submittedMs: number } => record != null)
    .sort((a, b) => a.submittedMs - b.submittedMs)
    .slice(-10)
    .map(({ submittedMs: _submittedMs, ...record }) => record);

  const totalQuestions = input.questions.length;
  const coveredQuestions = coveredIds.size;
  const uniqueWrongQuestions = wrongIds.size;

  return {
    totalQuestions,
    totalAttempts: input.records.length,
    coveredQuestions,
    coverageRatio: totalQuestions > 0 ? coveredQuestions / totalQuestions : 0,
    uniqueWrongQuestions,
    wrongRatio: totalQuestions > 0 ? uniqueWrongQuestions / totalQuestions : 0,
    recent7DayAttempts,
    moduleCoverage,
    recentAccuracy,
  };
}
