import { spawn } from 'node:child_process';
import { parseCommonArgs, resolveSiteDir } from './args.js';
import { log } from '../log.js';
import { loadBank } from '@knowledge-test/core';
import { summarizeBank } from '@knowledge-test/core';
import path from 'node:path';

export async function runDev(argv: string[]): Promise<void> {
  const { content, flags } = parseCommonArgs(argv);
  const bank = await loadBank(content);
  const summary = summarizeBank(bank);
  log.header('knowledge-test dev');
  log.info(`  bank id     : ${summary.bankId}`);
  log.info(`  title       : ${summary.title}`);
  log.info(`  content     : ${bank.contentDir}`);
  log.info(`  layout      : ${summary.layout}`);
  log.info(`  questions   : ${summary.totalValid} (raw ${summary.totalRaw}, issues ${summary.totalIssues})`);
  log.info(`  modules     : ${summary.byModule.length}`);
  log.info(
    `  statuses    : draft=${summary.byStatus.draft} agent=${summary.byStatus.agent_reviewed} human=${summary.byStatus.human_reviewed} deprecated=${summary.byStatus.deprecated}`,
  );
  if (summary.totalIssues > 0) {
    log.warn(`bank has ${summary.totalIssues} validation issue(s); run 'knowledge-test validate' for details`);
  }

  const site = resolveSiteDir();
  const port = typeof flags.port === 'string' ? flags.port : '4321';
  const host = typeof flags.host === 'string' ? flags.host : undefined;

  const env = {
    ...process.env,
    KT_CONTENT_DIR: bank.contentDir,
    KT_BANK_ID: bank.config.site.id,
    KT_INCLUDE_DRAFT: flags['include-draft'] ? '1' : '',
    KT_BASE_PATH: typeof flags.base === 'string' ? flags.base : '/',
  };

  const astroArgs = ['exec', '--', 'astro', 'dev', '--port', port];
  if (host) astroArgs.push('--host', host);

  log.step(`starting Astro dev server on http://localhost:${port} (cwd=${path.relative(process.cwd(), site) || '.'})`);
  const child = spawn('npm', astroArgs, { cwd: site, stdio: 'inherit', env });
  await new Promise<void>((resolve) => {
    child.on('exit', (code) => {
      if (code !== 0) process.exitCode = code ?? 1;
      resolve();
    });
  });
}
