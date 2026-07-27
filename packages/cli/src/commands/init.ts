import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseCommonArgs, resolveTemplatesDir } from './args.js';
import { log } from '../log.js';

export async function runInit(argv: string[]): Promise<void> {
  const { positionals, flags } = parseCommonArgs(argv);
  const target = positionals[0];
  if (!target) {
    throw new Error('Usage: knowledge-test init <target-dir>');
  }
  const abs = path.resolve(process.cwd(), target);
  const force = Boolean(flags.force);
  const dryRun = Boolean(flags['dry-run']);

  log.header(`knowledge-test init → ${abs}`);
  if (dryRun) log.warn('dry-run mode: no files will be written');

  const templatesDir = resolveTemplatesDir();
  const initDir = path.join(templatesDir, 'init');

  await copyTemplate(initDir, abs, { force, dryRun, replacements: { BANK_ID: path.basename(abs), BANK_TITLE: path.basename(abs).replace(/[-_]/g, ' ') } });

  log.ok(`initialized new bank at ${abs}`);
  log.dim('next steps:');
  log.info(`    cd ${path.relative(process.cwd(), abs) || '.'}`);
  log.info('    edit knowledge-test.config.json');
  log.info('    add questions/**/*.json');
  log.info('    knowledge-test validate --content .');
  log.info('    knowledge-test dev --content .');
}

interface CopyOpts {
  force: boolean;
  dryRun: boolean;
  replacements?: Record<string, string>;
}

async function copyTemplate(src: string, dest: string, opts: CopyOpts): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await maybeMkdir(dest, opts.dryRun);
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyTemplate(s, d, opts);
    } else {
      if (!opts.force && (await exists(d))) {
        log.dim(`  skip (exists) ${path.relative(process.cwd(), d)}`);
        continue;
      }
      let content = await fs.readFile(s, 'utf8');
      if (opts.replacements) {
        for (const [k, v] of Object.entries(opts.replacements)) {
          content = content.split(`{{${k}}}`).join(v);
        }
      }
      if (opts.dryRun) {
        log.dim(`  would write ${path.relative(process.cwd(), d)} (${content.length} bytes)`);
      } else {
        await fs.writeFile(d, content, 'utf8');
        log.ok(`  wrote ${path.relative(process.cwd(), d)}`);
      }
    }
  }
}

async function maybeMkdir(d: string, dryRun: boolean) {
  if (dryRun) return;
  await fs.mkdir(d, { recursive: true });
}
async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
