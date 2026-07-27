import { parseCommonArgs } from './args.js';
import { log } from '../log.js';
import { loadBank, summarizeBank } from '@knowledge-test/core';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function runDoctor(argv: string[]): Promise<void> {
  const { content } = parseCommonArgs(argv);

  log.header('knowledge-test doctor');
  log.info(`  node        : ${process.version}`);
  log.info(`  platform    : ${process.platform} ${process.arch}`);
  log.info(`  cwd         : ${process.cwd()}`);
  log.info(`  content dir : ${content}`);

  const bank = await loadBank(content);
  const s = summarizeBank(bank);
  log.info(`  bank id     : ${s.bankId}`);
  log.info(`  layout      : ${s.layout}`);
  log.info(`  config path : ${bank.configPath ?? '(none — inferred defaults)'}`);
  log.info(`  questions   : ${s.totalValid} (raw ${s.totalRaw}, issues ${s.totalIssues})`);
  log.info(`  modules     : ${s.byModule.length}`);
  log.info(
    `  statuses    : draft=${s.byStatus.draft} agent=${s.byStatus.agent_reviewed} human=${s.byStatus.human_reviewed} deprecated=${s.byStatus.deprecated}`,
  );

  const ghRepo = process.env.GITHUB_REPOSITORY;
  const basePath = ghRepo ? `/${ghRepo.split('/')[1]}/` : '/';
  log.info(`  GH repo     : ${ghRepo ?? '(not set)'} `);
  log.info(`  Pages base  : ${basePath}`);

  const workflow = path.join(bank.contentDir, '.github', 'workflows', 'pages.yml');
  const workflowExists = await exists(workflow);
  log.info(`  Pages workflow: ${workflowExists ? workflow : '(missing — run `knowledge-test deploy-init`)'}`);

  const missing: string[] = [];
  if (s.totalValid === 0) missing.push('no valid questions');
  if (s.totalIssues > 0) missing.push(`${s.totalIssues} validation issue(s)`);
  if (!bank.configPath) missing.push('knowledge-test.config.json is inferred (recommend committing one)');

  if (missing.length === 0) {
    log.ok('deploy readiness: OK');
  } else {
    log.warn('deploy readiness: needs attention');
    for (const m of missing) log.info(`    - ${m}`);
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
