import { parseCommonArgs } from './args.js';
import { log } from '../log.js';
import { loadBank, summarizeBank } from '@knowledge-test/core';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Analyse an existing content directory and print migration guidance.
 * Never writes files.
 */
export async function runInspect(argv: string[]): Promise<void> {
  const { content } = parseCommonArgs(argv);
  const bank = await loadBank(content);
  const s = summarizeBank(bank);

  log.header('knowledge-test inspect');
  log.info(`  content dir : ${bank.contentDir}`);
  log.info(`  layout      : ${s.layout}`);
  log.info(`  config file : ${bank.configPath ?? '(none)'}`);
  log.info(`  questions   : ${s.totalValid} (raw ${s.totalRaw}, issues ${s.totalIssues})`);

  log.header('migration suggestions:');

  if (!bank.configPath) {
    log.warn('missing knowledge-test.config.json');
    log.info('    → run `knowledge-test deploy-init --content <dir>`');
  } else {
    log.ok('knowledge-test.config.json present');
  }

  const workflow = path.join(bank.contentDir, '.github', 'workflows', 'pages.yml');
  if (!(await exists(workflow))) {
    log.warn('no Pages workflow');
    log.info('    → `knowledge-test deploy-init --content <dir>` will add one');
  } else {
    log.ok('.github/workflows/pages.yml present');
  }

  if (bank.layout === 'rl-legacy') {
    log.info(
      '\n  layout is `rl-legacy` (src/data/questions/**/questions-*.json). The kit\n' +
        '  reads this format directly — no migration required. If you eventually\n' +
        '  wish to move to the canonical `questions/**` layout, mirror the files\n' +
        '  and delete the old ones in a follow-up commit.',
    );
  }

  const legacyReviewed = bank.questions.filter((q) => q.reviewStatus === 'agent_reviewed').length;
  if (legacyReviewed > 0) {
    log.info(
      `\n  ${legacyReviewed} question(s) whose raw status was 'reviewed' were normalized\n` +
        '  to `agent_reviewed`. Source files are NOT rewritten. Update them in-place\n' +
        '  once you have run an actual human review pass.',
    );
  }

  if (s.totalIssues > 0) {
    log.warn(`\n  ${s.totalIssues} validation issue(s) — see \`knowledge-test validate\``);
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
