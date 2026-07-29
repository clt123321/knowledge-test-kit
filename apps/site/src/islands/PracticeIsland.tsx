import { useMemo, useState, useEffect } from 'react';
import { summarizePracticeProgress } from '@knowledge-test/core/storage';

/**
 * Standalone exam engine.
 *
 * Pure React, no framework routing. Uses `localStorage` under
 * `knowledge-test:<bankId>:*` for persistence.
 */

type Option = { id: string; text: string };
type QType = 'single' | 'multiple';

interface PQuestion {
  id: string;
  type: QType;
  module: string;
  subtopic?: string;
  difficulty?: number;
  stem: string;
  options: Option[];
  correctAnswers: string[];
  explanation: string;
  optionExplanations?: Record<string, string>;
}

interface ModuleLite {
  id: string;
  name: string;
}

interface ExamRecord {
  examId: string;
  bankId: string;
  mode: 'comprehensive' | 'module' | 'retry-wrong' | 'retry-correct' | 'random';
  moduleId?: string;
  startedAt: string;
  submittedAt: string;
  questionIds: string[];
  answers: Record<string, string[]>;
  score: number;
  maxScore: number;
  passScore: number;
  passed: boolean;
  wrongQuestionIds: string[];
  durationSeconds?: number;
}

interface Props {
  questions: PQuestion[];
  modules: ModuleLite[];
  bankId: string;
  defaultConfig: {
    singleScore: number;
    multipleScore: number;
    passRatio: number;
    singleCount: number;
    multipleCount: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
}

/* -- utilities ------------------------------------------------------------- */

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
}
function sameSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const v of b) if (!s.has(v)) return false;
  return true;
}
function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 12);
}
function safeGet<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function safeSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function shortDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}小时 ${String(minutes).padStart(2, '0')}分 ${String(seconds).padStart(2, '0')}秒`;
  }
  return `${minutes}分 ${String(seconds).padStart(2, '0')}秒`;
}

function computeDurationSeconds(startedAt: string, submittedAt: string): number {
  const startedMs = new Date(startedAt).getTime();
  const submittedMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(startedMs) || !Number.isFinite(submittedMs)) return 0;
  return Math.max(0, Math.round((submittedMs - startedMs) / 1000));
}

function sanitizeCountInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/^0+(?=\d)/, '');
}

function parseCountInput(value: string, fallback = 0): number {
  if (!value.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function modeLabel(mode: ExamRecord['mode'] | 'random'): string {
  if (mode === 'comprehensive') return '综合考试';
  if (mode === 'module') return '按模块考试';
  if (mode === 'random') return '随机抽题';
  if (mode === 'retry-wrong') return '错题集';
  return '对题集';
}

/* -- component ------------------------------------------------------------- */

type Phase = 'setup' | 'running' | 'result';

export default function PracticeIsland({ questions, modules, bankId, defaultConfig }: Props) {
  const prefix = `knowledge-test:${bankId}`;
  const RECORDS_KEY = `${prefix}:records:v1`;

  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<'comprehensive' | 'module' | 'random'>('comprehensive');
  const [paperMode, setPaperMode] = useState<ExamRecord['mode']>('comprehensive');
  const [moduleId, setModuleId] = useState<string>(modules[0]?.id ?? '');
  const [singleCountInput, setSingleCountInput] = useState(String(defaultConfig.singleCount));
  const [multipleCountInput, setMultipleCountInput] = useState(String(defaultConfig.multipleCount));
  const [randomCountInput, setRandomCountInput] = useState('10');
  const [reviewModuleId, setReviewModuleId] = useState<string>('all');

  const [paper, setPaper] = useState<PQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState<string>('');
  const [lastRecord, setLastRecord] = useState<ExamRecord | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTrendExamId, setActiveTrendExamId] = useState<string | null>(null);

  const [records, setRecords] = useState<ExamRecord[]>(() => safeGet<ExamRecord[]>(RECORDS_KEY, []));
  useEffect(() => {
    setRecords(safeGet<ExamRecord[]>(RECORDS_KEY, []));
  }, [RECORDS_KEY]);

  const moduleNameMap = useMemo(
    () => new Map(modules.map((module) => [module.id, module.name])),
    [modules],
  );
  const progress = useMemo(
    () =>
      summarizePracticeProgress({
        questions: questions.map((question) => ({ id: question.id, module: question.module })),
        records,
      }),
    [questions, records],
  );
  const orderedModuleCoverage = useMemo(() => {
    const order = new Map(modules.map((module, index) => [module.id, index]));
    return [...progress.moduleCoverage].sort((a, b) => {
      const aOrder = order.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = order.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.moduleId.localeCompare(b.moduleId);
    });
  }, [modules, progress.moduleCoverage]);
  const wrongQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of records) {
      for (const questionId of record.wrongQuestionIds) ids.add(questionId);
    }
    return ids;
  }, [records]);
  const correctQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of records) {
      const wrong = new Set(record.wrongQuestionIds);
      for (const questionId of record.questionIds) {
        if (!wrong.has(questionId)) ids.add(questionId);
      }
    }
    return ids;
  }, [records]);
  const availableWrongCount = useMemo(() => {
    return questions.filter(
      (question) =>
        wrongQuestionIds.has(question.id) &&
        (reviewModuleId === 'all' || question.module === reviewModuleId),
    ).length;
  }, [questions, reviewModuleId, wrongQuestionIds]);
  const availableCorrectCount = useMemo(() => {
    return questions.filter(
      (question) =>
        correctQuestionIds.has(question.id) &&
        (reviewModuleId === 'all' || question.module === reviewModuleId),
    ).length;
  }, [correctQuestionIds, questions, reviewModuleId]);
  const activeTrend =
    progress.recentAccuracy.find((point) => point.examId === activeTrendExamId) ??
    progress.recentAccuracy[progress.recentAccuracy.length - 1] ??
    null;
  const activeExamSummary = useMemo(() => {
    const singleCount = paper.filter((question) => question.type === 'single').length;
    const multipleCount = paper.filter((question) => question.type === 'multiple').length;
    const moduleIds = [...new Set(paper.map((question) => question.module))];
    const totalScore =
      singleCount * defaultConfig.singleScore + multipleCount * defaultConfig.multipleScore;
    const passScore = Math.ceil(totalScore * defaultConfig.passRatio);

    let scope = '全部模块';
    if (moduleIds.length === 1) {
      scope = moduleNameMap.get(moduleIds[0]) ?? moduleIds[0];
    } else if (moduleIds.length > 1 && moduleIds.length < modules.length) {
      scope = `${moduleIds.length} 个模块`;
    }

    return {
      scope,
      singleCount,
      multipleCount,
      totalQuestions: paper.length,
      totalScore,
      passScore,
    };
  }, [
    defaultConfig.multipleScore,
    defaultConfig.passRatio,
    defaultConfig.singleScore,
    moduleNameMap,
    modules.length,
    paper,
  ]);

  useEffect(() => {
    if (phase !== 'running' || !startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const startedMs = new Date(startedAt).getTime();
      if (!Number.isFinite(startedMs)) {
        setElapsedSeconds(0);
        return;
      }
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedMs) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== 'running') return;

    const message = '当前考试尚未交卷，是否退出考试？';
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const clickHandler = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', clickHandler, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', clickHandler, true);
    };
  }, [phase]);

  function start() {
    let pool: PQuestion[];
    if (mode === 'module' && moduleId) pool = questions.filter((q) => q.module === moduleId);
    else pool = questions;

    let picked: PQuestion[];
    if (mode === 'random') {
      picked = sample(pool, parseCountInput(randomCountInput, 10));
    } else {
      const singles = pool.filter((q) => q.type === 'single');
      const multiples = pool.filter((q) => q.type === 'multiple');
      picked = [
        ...sample(singles, parseCountInput(singleCountInput, defaultConfig.singleCount)),
        ...sample(multiples, parseCountInput(multipleCountInput, defaultConfig.multipleCount)),
      ];
    }
    if (defaultConfig.shuffleQuestions) picked = shuffle(picked);
    if (defaultConfig.shuffleOptions) picked = picked.map((q) => ({ ...q, options: shuffle(q.options) }));
    if (picked.length === 0) {
      alert('当前筛选条件下没有可用题目，请调整后再试。');
      return;
    }
    setPaper(picked);
    setAnswers({});
    setCurrent(0);
    setStartedAt(new Date().toISOString());
    setPaperMode(mode);
    setLastRecord(null);
    setPhase('running');
  }

  function toggle(qid: string, optId: string, type: QType) {
    setAnswers((prev) => {
      const cur = prev[qid] ?? [];
      let next: string[];
      if (type === 'single') next = [optId];
      else if (cur.includes(optId)) next = cur.filter((x) => x !== optId).sort();
      else next = [...cur, optId].sort();
      return { ...prev, [qid]: next };
    });
  }

  function submit() {
    let score = 0;
    let max = 0;
    const wrong: string[] = [];
    const submittedAt = new Date().toISOString();
    const activeModuleId =
      paper.length > 0 && paper.every((question) => question.module === paper[0]?.module)
        ? paper[0]?.module
        : undefined;
    for (const q of paper) {
      const full = q.type === 'single' ? defaultConfig.singleScore : defaultConfig.multipleScore;
      max += full;
      if (sameSet(answers[q.id] ?? [], q.correctAnswers)) score += full;
      else wrong.push(q.id);
    }
    const passScore = Math.ceil(max * defaultConfig.passRatio);
    const record: ExamRecord = {
      examId: uid(),
      bankId,
      mode: paperMode,
      moduleId: paperMode === 'module' || paperMode === 'retry-wrong' || paperMode === 'retry-correct' ? activeModuleId : undefined,
      startedAt,
      submittedAt,
      questionIds: paper.map((q) => q.id),
      answers,
      score,
      maxScore: max,
      passScore,
      passed: score >= passScore,
      wrongQuestionIds: wrong,
      durationSeconds: computeDurationSeconds(startedAt, submittedAt),
    };
    const cur = safeGet<ExamRecord[]>(RECORDS_KEY, []);
    const next = [record, ...cur].slice(0, 200);
    safeSet(RECORDS_KEY, next);
    setRecords(next);
    setLastRecord(record);
    setPhase('result');
  }

  function retryWrong(rec: ExamRecord) {
    const set = new Set(rec.wrongQuestionIds);
    const picked = questions.filter((q) => set.has(q.id));
    if (picked.length === 0) {
      alert('这份记录里没有可重做的错题。');
      return;
    }
    setPaper(defaultConfig.shuffleQuestions ? shuffle(picked) : picked);
    setAnswers({});
    setCurrent(0);
    setStartedAt(new Date().toISOString());
    setPaperMode('retry-wrong');
    setMode('comprehensive');
    setLastRecord(null);
    setPhase('running');
  }

  function startReview(modeToRun: 'retry-wrong' | 'retry-correct') {
    const sourceSet = modeToRun === 'retry-wrong' ? wrongQuestionIds : correctQuestionIds;
    const picked = questions.filter(
      (question) =>
        sourceSet.has(question.id) &&
        (reviewModuleId === 'all' || question.module === reviewModuleId),
    );
    if (picked.length === 0) {
      alert(modeToRun === 'retry-wrong' ? '当前筛选下还没有错题记录。' : '当前筛选下还没有对题记录。');
      return;
    }
    setPaper(defaultConfig.shuffleQuestions ? shuffle(picked) : picked);
    setAnswers({});
    setCurrent(0);
    setStartedAt(new Date().toISOString());
    setPaperMode(modeToRun);
    setLastRecord(null);
    setPhase('running');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bankId}-records-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        if (!Array.isArray(raw)) throw new Error('expected array');
        safeSet(RECORDS_KEY, raw);
        setRecords(raw);
        alert(`已导入 ${raw.length} 条记录。`);
      } catch (e) {
        alert('导入失败：' + (e as Error).message);
      }
    };
    reader.readAsText(file);
  }
  function clearAll() {
    if (!confirm('确定要清空当前题库的全部本地考试记录吗？')) return;
    try {
      localStorage.removeItem(RECORDS_KEY);
    } catch {
      /* ignore */
    }
    setRecords([]);
  }

  function deleteRecord(examId: string) {
    if (!window.confirm('确定删除这条历史记录吗？')) return;
    const next = records.filter((record) => record.examId !== examId);
    safeSet(RECORDS_KEY, next);
    setRecords(next);
  }

  function exitExam() {
    if (!window.confirm('当前考试尚未交卷，是否退出考试？')) return;
    setPhase('setup');
    setPaper([]);
    setAnswers({});
    setCurrent(0);
    setStartedAt('');
    setElapsedSeconds(0);
    setPaperMode('comprehensive');
  }

  /* -- render ------------------------------------------------------------- */

  if (phase === 'setup') {
    return (
      <div>
        <section className="kt-card">
          <h2>全库进度面板</h2>
          <div className="kt-stat-grid">
            <div className="kt-stat">
              <div className="kt-stat-label">已覆盖题数</div>
              <div className="kt-stat-value">
                {progress.coveredQuestions} / {progress.totalQuestions}
              </div>
            </div>
            <div className="kt-stat">
              <div className="kt-stat-label">覆盖率</div>
              <div className="kt-stat-value">{percentLabel(progress.coverageRatio)}</div>
            </div>
            <div className="kt-stat">
              <div className="kt-stat-label">唯一错题池</div>
              <div className="kt-stat-value">{progress.uniqueWrongQuestions}</div>
            </div>
            <div className="kt-stat">
              <div className="kt-stat-label">最近 7 天考试</div>
              <div className="kt-stat-value">{progress.recent7DayAttempts}</div>
            </div>
          </div>

          {records.length === 0 ? (
            <p style={{ color: 'var(--kt-color-muted)', marginTop: 0 }}>
              还没有已交卷记录。完成任意一套考试后，这里会开始累计覆盖、错题池和正确率趋势。
            </p>
          ) : (
            <p style={{ color: 'var(--kt-color-muted)', marginTop: 0 }}>
              已累计保存 {progress.totalAttempts} 次交卷记录，错题池覆盖 {percentLabel(progress.wrongRatio)} 的题库。
            </p>
          )}

          <div className="kt-progress-grid">
            <div>
              <h3 style={{ marginTop: 0 }}>各模块覆盖率</h3>
              <div className="kt-progress-list">
                {orderedModuleCoverage.map((module) => (
                  <div key={module.moduleId} className="kt-progress-item">
                    <div className="kt-progress-item-header">
                      <strong>{moduleNameMap.get(module.moduleId) ?? module.moduleId}</strong>
                      <span style={{ color: 'var(--kt-color-muted)' }}>
                        {module.coveredQuestions} / {module.totalQuestions} · {percentLabel(module.coverageRatio)}
                      </span>
                    </div>
                    <div className="kt-progress-bar-track">
                      <div
                        className="kt-progress-bar-fill"
                        style={{ width: `${Math.max(module.coverageRatio * 100, 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ marginTop: 0 }}>最近 10 次得分率</h3>
              {progress.recentAccuracy.length === 0 ? (
                <p style={{ color: 'var(--kt-color-muted)' }}>还没有可展示的交卷趋势。</p>
              ) : (
                <>
                  <div className="kt-trend-chart" aria-label="最近 10 次得分率趋势">
                    {progress.recentAccuracy.map((point) => (
                      <div key={point.examId} className="kt-trend-bar-group">
                        <div
                          className="kt-trend-bar"
                          style={{ height: `${Math.max(point.accuracyRatio * 100, 8)}%` }}
                          title={`${shortDateLabel(point.submittedAt)} · ${point.score}/${point.maxScore} · ${percentLabel(point.accuracyRatio)}`}
                          onMouseEnter={() => setActiveTrendExamId(point.examId)}
                        />
                        <div className="kt-trend-label">{shortDateLabel(point.submittedAt)}</div>
                      </div>
                    ))}
                  </div>
                  {activeTrend && (
                    <div className="kt-trend-detail">
                      <strong>{new Date(activeTrend.submittedAt).toLocaleString()}</strong>
                      <span>
                        得分率 {percentLabel(activeTrend.accuracyRatio)} · {activeTrend.score}/{activeTrend.maxScore}
                        · {activeTrend.questionCount} 题 · 错 {activeTrend.wrongCount}
                      </span>
                    </div>
                  )}
                  <p style={{ color: 'var(--kt-color-muted)', marginBottom: 0 }}>
                    趋势按交卷时间排序，展示最近 10 次考试得分率，鼠标移到柱子上会同步显示当次记录。
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="kt-card">
          <div className="kt-section-head">
            <div>
              <h2 style={{ marginBottom: 4 }}>组卷与题集</h2>
              <p style={{ color: 'var(--kt-color-muted)', margin: 0 }}>
                这里直接展示当前出题会使用的模块范围和题量设置，旁边的错题集 / 对题集也会按当前筛选范围生效。
              </p>
            </div>
            <div className="kt-inline-controls">
              <select value={reviewModuleId} onChange={(e) => setReviewModuleId(e.target.value)}>
                <option value="all">全部模块</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
              <button className="kt-btn kt-btn-ghost" onClick={() => startReview('retry-wrong')}>
                错题集 ({availableWrongCount})
              </button>
              <button className="kt-btn kt-btn-ghost" onClick={() => startReview('retry-correct')}>
                对题集 ({availableCorrectCount})
              </button>
            </div>
          </div>
          <p>
            <label>
              <input type="radio" checked={mode === 'comprehensive'} onChange={() => setMode('comprehensive')} /> 综合考试
            </label>{' '}
            <label>
              <input type="radio" checked={mode === 'module'} onChange={() => setMode('module')} /> 按模块考试
            </label>{' '}
            <label>
              <input type="radio" checked={mode === 'random'} onChange={() => setMode('random')} /> 随机抽题
            </label>
          </p>

          {mode === 'module' && (
            <p>
              <label>
                选择模块：{' '}
                <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </p>
          )}

          {mode !== 'random' ? (
            <p>
              <label>
                单选数：{' '}
                <input
                  type="text"
                  inputMode="numeric"
                  value={singleCountInput}
                  onChange={(e) => setSingleCountInput(sanitizeCountInput(e.target.value))}
                  style={{ width: 80 }}
                />
              </label>{' '}
              <label>
                多选数：{' '}
                <input
                  type="text"
                  inputMode="numeric"
                  value={multipleCountInput}
                  onChange={(e) => setMultipleCountInput(sanitizeCountInput(e.target.value))}
                  style={{ width: 80 }}
                />
              </label>
            </p>
          ) : (
            <p>
              <label>
                随机题数：{' '}
                <input
                  type="text"
                  inputMode="numeric"
                  value={randomCountInput}
                  onChange={(e) => setRandomCountInput(sanitizeCountInput(e.target.value))}
                  style={{ width: 80 }}
                />
              </label>
            </p>
          )}

          <p>
            <button className="kt-btn" onClick={start}>
              开始
            </button>
          </p>

        </section>

        <section className="kt-card">
          <h2>历史记录 ({records.length})</h2>
          {records.length === 0 && <p style={{ color: 'var(--kt-color-muted)' }}>暂无记录。</p>}
          {records.slice(0, 10).map((r) => (
            <div key={r.examId} style={{ borderBottom: '1px solid var(--kt-color-border)', padding: '8px 0' }}>
              <div>
                <strong>
                  {r.score} / {r.maxScore}
                </strong>{' '}
                {r.passed ? (
                  <span className="kt-tag kt-tag-status-human_reviewed">通过</span>
                ) : (
                  <span className="kt-tag kt-tag-status-deprecated">未通过</span>
                )}{' '}
                <span style={{ color: 'var(--kt-color-muted)' }}>· {new Date(r.submittedAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--kt-color-muted)' }}>
                {modeLabel(r.mode)}
                {r.moduleId ? ` · ${moduleNameMap.get(r.moduleId) ?? r.moduleId}` : ''} · {r.questionIds.length} 题
                · 错 {r.wrongQuestionIds.length} · 用时{' '}
                {formatDuration(r.durationSeconds ?? computeDurationSeconds(r.startedAt, r.submittedAt))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {r.wrongQuestionIds.length > 0 && (
                  <button className="kt-btn kt-btn-ghost" onClick={() => retryWrong(r)}>
                    错题重做
                  </button>
                )}
                <button className="kt-btn kt-btn-ghost" onClick={() => deleteRecord(r.examId)}>
                  删除记录
                </button>
              </div>
            </div>
          ))}
          <p style={{ marginTop: 12 }}>
            <button className="kt-btn kt-btn-ghost" onClick={exportJson}>
              导出 JSON
            </button>{' '}
            <label className="kt-btn kt-btn-ghost" style={{ cursor: 'pointer' }}>
              导入 JSON
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
              />
            </label>{' '}
            <button className="kt-btn kt-btn-ghost" onClick={clearAll}>
              清空
            </button>
          </p>
        </section>
      </div>
    );
  }

  if (phase === 'running') {
    const q = paper[current];
    const chosen = answers[q.id] ?? [];
    return (
      <section className="kt-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            第 {current + 1} / {paper.length} 题 · <span className="kt-tag">{q.type}</span>{' '}
            <span className="kt-tag">{q.module}</span> <span className="kt-tag">{modeLabel(paperMode)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--kt-color-muted)', marginRight: 12 }}>已用时 {formatDuration(elapsedSeconds)}</span>
            <button className="kt-btn kt-btn-ghost" onClick={exitExam}>
              退出考试
            </button>{' '}
            <button className="kt-btn" onClick={submit}>
              交卷
            </button>
          </div>
        </div>
        <div className="kt-summary-grid" style={{ marginTop: 0 }}>
          <div className="kt-summary-card">
            <div className="kt-summary-label">本场考试</div>
            <strong>{modeLabel(paperMode)}</strong>
            <div className="kt-summary-muted">模块范围：{activeExamSummary.scope}</div>
          </div>
          <div className="kt-summary-card">
            <div className="kt-summary-label">题量</div>
            <strong>共 {activeExamSummary.totalQuestions} 题</strong>
            <div className="kt-summary-muted">
              单选 {activeExamSummary.singleCount} 题 · 多选 {activeExamSummary.multipleCount} 题
            </div>
          </div>
          <div className="kt-summary-card">
            <div className="kt-summary-label">评分</div>
            <strong>
              及格线 {activeExamSummary.passScore} / {activeExamSummary.totalScore}
            </strong>
            <div className="kt-summary-muted">
              单选 {defaultConfig.singleScore} 分 · 多选 {defaultConfig.multipleScore} 分
            </div>
          </div>
        </div>
        <div className="kt-question-stem">
          <p>{q.stem}</p>
        </div>
        <ol className="kt-options">
          {q.options.map((o) => (
            <li
              key={o.id}
              className={'kt-option ' + (chosen.includes(o.id) ? 'kt-option-selected-wrong' : '')}
              onClick={() => toggle(q.id, o.id, q.type)}
              style={{ cursor: 'pointer' }}
            >
              <span className="kt-option-id">{o.id}</span>
              <span>{o.text}</span>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="kt-btn kt-btn-ghost" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
            上一题
          </button>
          <button
            className="kt-btn"
            disabled={current === paper.length - 1}
            onClick={() => setCurrent(current + 1)}
          >
            下一题
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {paper.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              className="kt-btn kt-btn-ghost"
              style={{
                width: 36,
                height: 36,
                padding: 0,
                textAlign: 'center',
                background: answers[qq.id] ? 'var(--kt-color-tag)' : undefined,
                fontWeight: i === current ? 700 : 400,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // result
  if (lastRecord) {
    return (
      <section className="kt-card">
        <h2>
          得分：{lastRecord.score} / {lastRecord.maxScore}{' '}
          {lastRecord.passed ? (
            <span className="kt-tag kt-tag-status-human_reviewed">通过</span>
          ) : (
            <span className="kt-tag kt-tag-status-deprecated">未通过</span>
          )}
        </h2>
        <p>
          错题：{lastRecord.wrongQuestionIds.length} 道 · 及格线：{lastRecord.passScore} · 用时{' '}
          {formatDuration(lastRecord.durationSeconds ?? computeDurationSeconds(lastRecord.startedAt, lastRecord.submittedAt))}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {lastRecord.wrongQuestionIds.length > 0 && (
            <button className="kt-btn" onClick={() => retryWrong(lastRecord)}>
              错题重做
            </button>
          )}
          <button className="kt-btn kt-btn-ghost" onClick={() => setPhase('setup')}>
            返回
          </button>
        </div>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>逐题查看</summary>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {paper.map((q) => {
              const user = answers[q.id] ?? [];
              const ok = sameSet(user, q.correctAnswers);
              return (
                <li key={q.id} style={{ borderBottom: '1px solid var(--kt-color-border)', padding: '12px 0' }}>
                  <div>
                    <strong>{q.id}</strong>{' '}
                    {ok ? (
                      <span className="kt-tag kt-tag-status-human_reviewed">正确</span>
                    ) : (
                      <span className="kt-tag kt-tag-status-deprecated">错误</span>
                    )}
                  </div>
                  <div>{q.stem}</div>
                  <div style={{ fontSize: 14 }}>
                    正确答案：<strong>{q.correctAnswers.join(', ')}</strong>；你的答案：{user.join(', ') || '（未答）'}
                  </div>
                  <div style={{ color: 'var(--kt-color-muted)', fontSize: 14, marginTop: 4 }}>{q.explanation}</div>
                </li>
              );
            })}
          </ul>
        </details>
      </section>
    );
  }
  return null;
}
