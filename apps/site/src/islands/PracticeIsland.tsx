import React, { useMemo, useState, useEffect } from 'react';

/**
 * Standalone practice engine.
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
  mode: 'comprehensive' | 'module' | 'retry-wrong' | 'random';
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

/* -- component ------------------------------------------------------------- */

type Phase = 'setup' | 'running' | 'result';

export default function PracticeIsland({ questions, modules, bankId, defaultConfig }: Props) {
  const prefix = `knowledge-test:${bankId}`;
  const RECORDS_KEY = `${prefix}:records:v1`;

  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<'comprehensive' | 'module' | 'random'>('comprehensive');
  const [moduleId, setModuleId] = useState<string>(modules[0]?.id ?? '');
  const [singleCount, setSingleCount] = useState(defaultConfig.singleCount);
  const [multipleCount, setMultipleCount] = useState(defaultConfig.multipleCount);
  const [randomCount, setRandomCount] = useState(10);

  const [paper, setPaper] = useState<PQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState<string>('');
  const [lastRecord, setLastRecord] = useState<ExamRecord | null>(null);

  const [records, setRecords] = useState<ExamRecord[]>(() => safeGet<ExamRecord[]>(RECORDS_KEY, []));
  useEffect(() => {
    setRecords(safeGet<ExamRecord[]>(RECORDS_KEY, []));
  }, [RECORDS_KEY]);

  function start() {
    let pool: PQuestion[];
    if (mode === 'module' && moduleId) pool = questions.filter((q) => q.module === moduleId);
    else pool = questions;

    let picked: PQuestion[];
    if (mode === 'random') {
      picked = sample(pool, randomCount);
    } else {
      const singles = pool.filter((q) => q.type === 'single');
      const multiples = pool.filter((q) => q.type === 'multiple');
      picked = [...sample(singles, singleCount), ...sample(multiples, multipleCount)];
    }
    if (defaultConfig.shuffleQuestions) picked = shuffle(picked);
    if (defaultConfig.shuffleOptions) picked = picked.map((q) => ({ ...q, options: shuffle(q.options) }));
    if (picked.length === 0) {
      alert('No questions in the selected pool.');
      return;
    }
    setPaper(picked);
    setAnswers({});
    setCurrent(0);
    setStartedAt(new Date().toISOString());
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
      mode: mode as ExamRecord['mode'],
      moduleId: mode === 'module' ? moduleId : undefined,
      startedAt,
      submittedAt: new Date().toISOString(),
      questionIds: paper.map((q) => q.id),
      answers,
      score,
      maxScore: max,
      passScore,
      passed: score >= passScore,
      wrongQuestionIds: wrong,
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
      alert('No wrong questions to retry — great job!');
      return;
    }
    setPaper(defaultConfig.shuffleQuestions ? shuffle(picked) : picked);
    setAnswers({});
    setCurrent(0);
    setStartedAt(new Date().toISOString());
    setMode('comprehensive');
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
        alert(`Imported ${raw.length} record(s).`);
      } catch (e) {
        alert('Import failed: ' + (e as Error).message);
      }
    };
    reader.readAsText(file);
  }
  function clearAll() {
    if (!confirm('Delete ALL records for this bank?')) return;
    try {
      localStorage.removeItem(RECORDS_KEY);
    } catch {
      /* ignore */
    }
    setRecords([]);
  }

  /* -- render ------------------------------------------------------------- */

  if (phase === 'setup') {
    return (
      <div>
        <section className="kt-card">
          <h2>组卷</h2>
          <p>
            <label>
              <input type="radio" checked={mode === 'comprehensive'} onChange={() => setMode('comprehensive')} /> 综合考试
            </label>{' '}
            <label>
              <input type="radio" checked={mode === 'module'} onChange={() => setMode('module')} /> 按模块练习
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
                  type="number"
                  min={0}
                  value={singleCount}
                  onChange={(e) => setSingleCount(parseInt(e.target.value || '0', 10))}
                  style={{ width: 80 }}
                />
              </label>{' '}
              <label>
                多选数：{' '}
                <input
                  type="number"
                  min={0}
                  value={multipleCount}
                  onChange={(e) => setMultipleCount(parseInt(e.target.value || '0', 10))}
                  style={{ width: 80 }}
                />
              </label>
            </p>
          ) : (
            <p>
              <label>
                随机题数：{' '}
                <input
                  type="number"
                  min={1}
                  value={randomCount}
                  onChange={(e) => setRandomCount(parseInt(e.target.value || '1', 10))}
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
                {r.mode}
                {r.moduleId ? ` · ${r.moduleId}` : ''} · {r.questionIds.length} 题 · 错 {r.wrongQuestionIds.length}
              </div>
              {r.wrongQuestionIds.length > 0 && (
                <button className="kt-btn kt-btn-ghost" style={{ marginTop: 6 }} onClick={() => retryWrong(r)}>
                  错题重做
                </button>
              )}
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
            <span className="kt-tag">{q.module}</span>
          </div>
          <div>
            <button className="kt-btn kt-btn-ghost" onClick={() => setPhase('setup')}>
              放弃
            </button>{' '}
            <button className="kt-btn" onClick={submit}>
              交卷
            </button>
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
          错题：{lastRecord.wrongQuestionIds.length} 道 · 及格线：{lastRecord.passScore}
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
