import type { LoadedBank } from '../adapters/index.js';
import type { Question, Reference, Module } from '@knowledge-test/schema';
import { normalizeReviewStatus, type ReviewStatus } from '@knowledge-test/schema';

/** Group questions by module. */
export function groupByModule(questions: readonly Question[]): Map<string, Question[]> {
  const m = new Map<string, Question[]>();
  for (const q of questions) {
    const arr = m.get(q.module) ?? [];
    arr.push(q);
    m.set(q.module, arr);
  }
  return m;
}

/** Build a module list from questions if none was declared. */
export function inferModules(questions: readonly Question[]): Module[] {
  const ids = new Set<string>();
  for (const q of questions) ids.add(q.module);
  return Array.from(ids)
    .sort()
    .map((id, i) => ({ id, name: id, order: i }));
}

export interface BankSummary {
  bankId: string;
  title: string;
  layout: string;
  totalRaw: number;
  totalValid: number;
  totalIssues: number;
  byType: { single: number; multiple: number };
  byStatus: Record<ReviewStatus, number>;
  byModule: { moduleId: string; count: number }[];
}

export function summarizeBank(bank: LoadedBank): BankSummary {
  const byType = { single: 0, multiple: 0 };
  const byStatus: Record<ReviewStatus, number> = {
    draft: 0,
    agent_reviewed: 0,
    human_reviewed: 0,
    deprecated: 0,
  };
  const byModule = new Map<string, number>();
  for (const q of bank.questions) {
    if (q.type === 'single') byType.single++;
    else byType.multiple++;
    byStatus[normalizeReviewStatus(q.reviewStatus)]++;
    byModule.set(q.module, (byModule.get(q.module) ?? 0) + 1);
  }
  return {
    bankId: bank.config.site.id,
    title: bank.config.site.title,
    layout: bank.layout,
    totalRaw: bank.rawQuestionCount,
    totalValid: bank.questions.length,
    totalIssues: bank.issues.length,
    byType,
    byStatus,
    byModule: Array.from(byModule.entries())
      .map(([moduleId, count]) => ({ moduleId, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Very small markdown -> HTML escape helper; used inside Astro pages. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type { Question, Reference, Module };
