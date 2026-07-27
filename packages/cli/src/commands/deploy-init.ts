import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseCommonArgs, resolveTemplatesDir } from './args.js';
import { log } from '../log.js';

/**
 * Add knowledge-test.config.json + .github/workflows/pages.yml + docs/DEPLOYMENT.md
 * to an existing content repository. Never overwrites without --force.
 */
export async function runDeployInit(argv: string[]): Promise<void> {
  const { content, flags } = parseCommonArgs(argv);
  const dryRun = Boolean(flags['dry-run']);
  const force = Boolean(flags.force);

  log.header(`knowledge-test deploy-init → ${content}`);
  if (dryRun) log.warn('dry-run: no files will be written');
  if (force) log.warn('force: existing files WILL be overwritten');

  const templates = resolveTemplatesDir();
  const deployDir = path.join(templates, 'deploy-init');

  await walk(deployDir, content, { force, dryRun });
  log.ok('deploy-init complete');
}

interface CopyOpts {
  force: boolean;
  dryRun: boolean;
}

async function walk(src: string, dest: string, opts: CopyOpts) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      if (!opts.dryRun) await fs.mkdir(d, { recursive: true });
      await walk(s, d, opts);
    } else {
      if (!opts.force && (await exists(d))) {
        log.dim(`  skip (exists)   ${path.relative(process.cwd(), d)}`);
        continue;
      }
      const content = await fs.readFile(s, 'utf8');
      if (opts.dryRun) {
        log.info(`  would write     ${path.relative(process.cwd(), d)}`);
      } else {
        await fs.mkdir(path.dirname(d), { recursive: true });
        await fs.writeFile(d, content, 'utf8');
        log.ok(`  wrote           ${path.relative(process.cwd(), d)}`);
      }
    }
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
