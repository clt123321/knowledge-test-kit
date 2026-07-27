import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectLayout, loadBank } from '../src/adapters/index.js';
import { summarizeBank } from '../src/content/index.js';

/**
 * Create a temp bank on disk for each layout and verify detection + loading.
 */

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

const goodQ = (id: string) => ({
  id,
  type: 'single',
  module: 'basics',
  stem: 'stem',
  options: [
    { id: 'A', text: 'a' },
    { id: 'B', text: 'b' },
  ],
  correctAnswers: ['A'],
  explanation: 'e',
  optionExplanations: { A: 'a', B: 'b' },
  reviewStatus: 'agent_reviewed',
  version: 1,
});

describe('adapters', () => {
  let root: string;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kt-adapter-'));
  });

  it('detects a canonical layout and loads questions', async () => {
    const dir = path.join(root, 'canonical');
    await writeJson(path.join(dir, 'questions', 'basics', 'batch-1.json'), [goodQ('c-1'), goodQ('c-2')]);
    await writeJson(path.join(dir, 'knowledge-test.config.json'), {
      site: { id: 'canon', title: 'Canonical' },
    });
    expect(await detectLayout(dir)).toBe('canonical');
    const bank = await loadBank(dir);
    expect(bank.questions).toHaveLength(2);
    expect(bank.issues).toHaveLength(0);
    expect(bank.layout).toBe('canonical');
  });

  it('detects an RL-legacy layout and loads questions', async () => {
    const dir = path.join(root, 'rl-legacy');
    await writeJson(path.join(dir, 'src', 'data', 'questions', '01_basics', 'questions-01.json'), [
      { ...goodQ('r-1'), reviewStatus: 'reviewed' },
    ]);
    await writeJson(path.join(dir, 'src', 'data', 'questions', '01_basics', 'manifest.json'), {
      module: 'basics',
      name: 'Basics',
      totalCount: 1,
    });
    expect(await detectLayout(dir)).toBe('rl-legacy');
    const bank = await loadBank(dir);
    expect(bank.questions).toHaveLength(1);
    // Legacy `reviewed` should be normalized to `agent_reviewed`
    expect(bank.questions[0].reviewStatus).toBe('agent_reviewed');
    // Manifest → inferred module
    expect(bank.modules.some((m) => m.id === 'basics' && m.name === 'Basics')).toBe(true);
  });

  it('detects an exported layout', async () => {
    const dir = path.join(root, 'exported');
    await writeJson(path.join(dir, 'exports', 'question-bank.json'), [goodQ('e-1')]);
    expect(await detectLayout(dir)).toBe('exported');
    const bank = await loadBank(dir);
    expect(bank.questions).toHaveLength(1);
  });

  it('reports duplicate ids as issues', async () => {
    const dir = path.join(root, 'duplicate');
    await writeJson(path.join(dir, 'questions', 'batch.json'), [goodQ('d-1'), goodQ('d-1')]);
    await writeJson(path.join(dir, 'knowledge-test.config.json'), { site: { id: 'dup', title: 'Dup' } });
    const bank = await loadBank(dir);
    expect(bank.questions).toHaveLength(1);
    expect(bank.issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });

  it('returns "unknown" for an empty repo', async () => {
    const dir = path.join(root, 'empty');
    await fs.mkdir(dir, { recursive: true });
    expect(await detectLayout(dir)).toBe('unknown');
  });

  it('summarizeBank groups by type / status / module', async () => {
    const dir = path.join(root, 'summary');
    await writeJson(path.join(dir, 'questions', 'a.json'), [
      { ...goodQ('s-1'), type: 'single' },
      { ...goodQ('s-2'), type: 'multiple', correctAnswers: ['A', 'B'] },
      { ...goodQ('s-3'), reviewStatus: 'draft' },
    ]);
    await writeJson(path.join(dir, 'knowledge-test.config.json'), { site: { id: 'sum', title: 'Sum' } });
    const bank = await loadBank(dir);
    const s = summarizeBank(bank);
    expect(s.totalValid).toBe(3);
    expect(s.byType.single).toBeGreaterThanOrEqual(2);
    expect(s.byStatus.draft).toBeGreaterThanOrEqual(1);
  });
});
