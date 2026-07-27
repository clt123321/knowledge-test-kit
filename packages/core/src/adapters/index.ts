import { promises as fs } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import type { Question, Module, KnowledgeTestConfig } from '@knowledge-test/schema';
import {
  KnowledgeTestConfigSchema,
  validateQuestions,
  normalizeReviewStatus,
  BaseQuestionSchema,
} from '@knowledge-test/schema';

export type BankLayout = 'canonical' | 'rl-legacy' | 'exported' | 'unknown';

export interface DetectedBank {
  layout: BankLayout;
  contentDir: string;
  configPath: string | null;
  config: KnowledgeTestConfig;
  moduleFilePath: string | null;
}

export interface LoadedBank extends DetectedBank {
  questions: Question[];
  modules: Module[];
  issues: { path: string; message: string; questionId?: string; file?: string }[];
  rawQuestionCount: number;
}

/* -------------------------------------------------------------------------- */
/*  Layout detection                                                          */
/* -------------------------------------------------------------------------- */

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function loadConfigFile(dir: string): Promise<{ path: string; raw: unknown } | null> {
  const jsonPath = path.join(dir, 'knowledge-test.config.json');
  const jsonPath2 = path.join(dir, 'knowledge-test.config.mjs');
  if (await fileExists(jsonPath)) {
    const raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    return { path: jsonPath, raw };
  }
  if (await fileExists(jsonPath2)) {
    const mod = (await import(jsonPath2 + '?t=' + Date.now())) as {
      default?: unknown;
    };
    return { path: jsonPath2, raw: mod.default ?? mod };
  }
  return null;
}

export async function detectLayout(contentDir: string): Promise<BankLayout> {
  const canonical = await fg('questions/**/*.json', { cwd: contentDir, onlyFiles: true, deep: 4 });
  if (canonical.length > 0) return 'canonical';
  const legacy = await fg('src/data/questions/**/questions-*.json', {
    cwd: contentDir,
    onlyFiles: true,
    deep: 5,
  });
  if (legacy.length > 0) return 'rl-legacy';
  const exported = path.join(contentDir, 'exports', 'question-bank.json');
  if (await fileExists(exported)) return 'exported';
  return 'unknown';
}

export async function detectBank(contentDir: string): Promise<DetectedBank> {
  const abs = path.resolve(contentDir);
  const cfgFile = await loadConfigFile(abs);

  let cfg: KnowledgeTestConfig;
  let configPath: string | null = null;
  if (cfgFile) {
    cfg = KnowledgeTestConfigSchema.parse(cfgFile.raw);
    configPath = cfgFile.path;
  } else {
    const inferredId = path.basename(abs).toLowerCase().replace(/\s+/g, '-') || 'bank';
    cfg = KnowledgeTestConfigSchema.parse({
      site: {
        id: inferredId,
        title: inferredId.replace(/-/g, ' '),
      },
    });
  }

  const layout = await detectLayout(abs);

  // Adjust content globs by layout when not explicitly overridden by config
  if (!cfgFile) {
    if (layout === 'rl-legacy') {
      cfg.content.questionGlobs = ['src/data/questions/**/questions-*.json'];
    } else if (layout === 'exported') {
      cfg.content.questionGlobs = ['exports/question-bank.json'];
    }
  }

  const modulePath = path.join(abs, cfg.content.moduleFile ?? 'modules.json');
  const moduleFilePath = (await fileExists(modulePath)) ? modulePath : null;

  return { layout, contentDir: abs, configPath, config: cfg, moduleFilePath };
}

/* -------------------------------------------------------------------------- */
/*  Loading                                                                   */
/* -------------------------------------------------------------------------- */

async function loadJsonFiles(
  contentDir: string,
  globs: string[],
): Promise<{ file: string; raw: unknown }[]> {
  const files = await fg(globs, { cwd: contentDir, onlyFiles: true, absolute: false, unique: true });
  const out: { file: string; raw: unknown }[] = [];
  for (const rel of files) {
    const abs = path.join(contentDir, rel);
    try {
      const text = await fs.readFile(abs, 'utf8');
      out.push({ file: rel, raw: JSON.parse(text) });
    } catch (err) {
      out.push({ file: rel, raw: { __parseError: (err as Error).message } });
    }
  }
  return out;
}

function flattenQuestions(items: { file: string; raw: unknown }[]): {
  question: unknown;
  file: string;
}[] {
  const out: { question: unknown; file: string }[] = [];
  for (const { file, raw } of items) {
    if (Array.isArray(raw)) {
      for (const q of raw) out.push({ question: q, file });
    } else if (raw && typeof raw === 'object' && 'questions' in (raw as Record<string, unknown>)) {
      const inner = (raw as { questions: unknown }).questions;
      if (Array.isArray(inner)) for (const q of inner) out.push({ question: q, file });
    } else if (raw && typeof raw === 'object' && '__parseError' in (raw as Record<string, unknown>)) {
      // Skip; will be reported via issues at a higher layer
    } else if (raw && typeof raw === 'object') {
      // Single question object
      out.push({ question: raw, file });
    }
  }
  return out;
}

function normalizeRawQuestion(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const q = { ...(raw as Record<string, unknown>) };
  if (typeof q.reviewStatus === 'string') {
    // Keep the raw one on _rawReviewStatus; feed normalized to schema so
    // publishing filters work uniformly.
    (q as Record<string, unknown>)._rawReviewStatus = q.reviewStatus;
    (q as Record<string, unknown>).reviewStatus = normalizeReviewStatus(q.reviewStatus as string);
  }
  return q;
}

async function loadModules(bank: DetectedBank): Promise<Module[]> {
  if (bank.moduleFilePath) {
    try {
      const raw = JSON.parse(await fs.readFile(bank.moduleFilePath, 'utf8'));
      if (Array.isArray(raw)) return raw as Module[];
      if (raw && Array.isArray(raw.modules)) return raw.modules as Module[];
    } catch {
      /* fall through to inference */
    }
  }
  // Legacy RL: try to synthesise from manifests
  if (bank.layout === 'rl-legacy') {
    const manifests = await fg('src/data/questions/*/manifest.json', {
      cwd: bank.contentDir,
      onlyFiles: true,
    });
    const mods: Module[] = [];
    for (const m of manifests) {
      try {
        const raw = JSON.parse(await fs.readFile(path.join(bank.contentDir, m), 'utf8'));
        if (typeof raw.module === 'string' && typeof raw.name === 'string') {
          mods.push({ id: raw.module, name: raw.name });
        }
      } catch {
        /* ignore */
      }
    }
    if (mods.length > 0) return mods;
  }
  return [];
}

/**
 * Load a full bank: config + modules + validated questions.
 *
 * `contentDir` is a directory that either has a `knowledge-test.config.json`
 * or matches one of the auto-detected layouts.
 */
export async function loadBank(contentDir: string): Promise<LoadedBank> {
  const bank = await detectBank(contentDir);
  const files = await loadJsonFiles(bank.contentDir, bank.config.content.questionGlobs);
  const flat = flattenQuestions(files);
  const normalized = flat.map((f) => ({ file: f.file, question: normalizeRawQuestion(f.question) }));

  const rawCount = normalized.length;

  const validation = validateQuestions(
    normalized.map((n) => n.question),
    BaseQuestionSchema,
  );

  // Attach source-file info to issues where possible
  const issues = validation.issues.map((iss) => {
    const m = /^\[(\d+)\]/.exec(iss.path);
    if (m) {
      const idx = parseInt(m[1], 10);
      return { ...iss, file: normalized[idx]?.file };
    }
    return iss;
  });

  const modules = await loadModules(bank);

  return {
    ...bank,
    questions: validation.items,
    modules,
    issues,
    rawQuestionCount: rawCount,
  };
}

/** Small utility: infer a bank id and title from a directory path. */
export function inferBankIdentity(contentDir: string): { id: string; title: string } {
  const base = path.basename(path.resolve(contentDir));
  const id = base.toLowerCase().replace(/\s+/g, '-') || 'bank';
  const title = base.replace(/[-_]/g, ' ');
  return { id, title };
}
