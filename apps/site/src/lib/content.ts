import { loadBank, summarizeBank, filterQuestions, groupByModule } from '@knowledge-test/core';
import type { Question, Module } from '@knowledge-test/schema';
import path from 'node:path';

const CONTENT_DIR =
  process.env.KT_CONTENT_DIR ||
  path.resolve(process.cwd(), '..', '..', 'examples', 'demo-bank');

const INCLUDE_DRAFT = !!process.env.KT_INCLUDE_DRAFT;

let cache: Awaited<ReturnType<typeof loadBank>> | null = null;

export async function getBank() {
  if (!cache) cache = await loadBank(CONTENT_DIR);
  return cache!;
}

export async function getVisibleQuestions(): Promise<Question[]> {
  const bank = await getBank();
  return filterQuestions(bank.questions, { includeDraft: INCLUDE_DRAFT });
}

export async function getAllQuestionsIncludingDrafts(): Promise<Question[]> {
  const bank = await getBank();
  return bank.questions;
}

export async function getModulesResolved(): Promise<Module[]> {
  const bank = await getBank();
  if (bank.modules.length > 0) return bank.modules;
  // Derive modules from question set if none declared
  const seen = new Set<string>();
  for (const q of bank.questions) seen.add(q.module);
  return Array.from(seen)
    .sort()
    .map((id, i) => ({ id, name: id, order: i } as Module));
}

export async function getQuestionsByModule(): Promise<Map<string, Question[]>> {
  return groupByModule(await getVisibleQuestions());
}

export async function getSummary() {
  const bank = await getBank();
  return summarizeBank(bank);
}

export function siteBase(): string {
  return process.env.KT_BASE_PATH || '/';
}

export function toStaticPath(relative: string): string {
  const base = siteBase();
  const norm = relative.startsWith('/') ? relative.slice(1) : relative;
  const withBase = (base.endsWith('/') ? base : base + '/') + norm;
  return withBase.replace(/\/{2,}/g, '/');
}
