import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parseCommonArgs, resolveSiteDir } from './args.js';
import { log } from '../log.js';
import { loadBank, summarizeBank } from '@knowledge-test/core';

function derivePagesBase(): string {
  const repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
  if (!repo) return '/';
  const [, name] = repo.split('/');
  if (!name) return '/';
  return `/${name}/`;
}

export async function runBuild(argv: string[]): Promise<void> {
  const { content, flags } = parseCommonArgs(argv);
  const bank = await loadBank(content);
  const summary = summarizeBank(bank);

  log.header('knowledge-test build');
  log.info(`  bank id     : ${summary.bankId}`);
  log.info(`  content     : ${bank.contentDir}`);
  log.info(`  layout      : ${summary.layout}`);
  log.info(`  questions   : ${summary.totalValid} (raw ${summary.totalRaw}, issues ${summary.totalIssues})`);

  if (summary.totalIssues > 0) {
    log.warn(`bank has ${summary.totalIssues} validation issue(s) — see 'knowledge-test validate' for details`);
    for (const iss of bank.issues.slice(0, 5)) {
      log.dim(`    ${iss.path} — ${iss.message}${iss.file ? ' [' + iss.file + ']' : ''}`);
    }
    if (bank.issues.length > 5) log.dim(`    …and ${bank.issues.length - 5} more`);
  }

  const site = resolveSiteDir();
  const base = typeof flags.base === 'string' ? flags.base : derivePagesBase();
  const env = {
    ...process.env,
    KT_CONTENT_DIR: bank.contentDir,
    KT_BANK_ID: bank.config.site.id,
    KT_INCLUDE_DRAFT: flags['include-draft'] ? '1' : '',
    KT_BASE_PATH: base,
  };

  log.step(`running: astro build (base=${base})`);
  const astroBuild = spawn('npm', ['exec', '--', 'astro', 'build'], { cwd: site, stdio: 'inherit', env });
  const rc1 = await new Promise<number>((resolve) => astroBuild.on('exit', (c) => resolve(c ?? 1)));
  if (rc1 !== 0) throw new Error('astro build failed');

  // Pagefind post-processing over dist/
  const distDir = path.join(site, 'dist');
  if (await exists(distDir)) {
    log.step('running: pagefind (index dist/)');
    const pf = spawn(
      'npm',
      ['exec', '--', 'pagefind', '--site', 'dist'],
      { cwd: site, stdio: 'inherit', env },
    );
    const rc2 = await new Promise<number>((resolve) => pf.on('exit', (c) => resolve(c ?? 1)));
    if (rc2 !== 0) log.warn('pagefind indexing failed (site is still usable without search)');
  } else {
    log.warn(`expected build output at ${distDir} — Pagefind indexing skipped`);
  }

  const finalDist = path.resolve(site, 'dist');
  log.ok(`build complete → ${finalDist}`);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
