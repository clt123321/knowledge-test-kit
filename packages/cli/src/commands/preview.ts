import { spawn } from 'node:child_process';
import { parseCommonArgs, resolveSiteDir } from './args.js';
import { log } from '../log.js';

export async function runPreview(argv: string[]): Promise<void> {
  const { flags } = parseCommonArgs(argv);
  const site = resolveSiteDir();
  const port = typeof flags.port === 'string' ? flags.port : '4322';
  log.header('knowledge-test preview');
  log.step(`serving dist/ on http://localhost:${port}`);
  const child = spawn('npm', ['exec', '--', 'astro', 'preview', '--port', port], {
    cwd: site,
    stdio: 'inherit',
  });
  await new Promise<void>((resolve) => child.on('exit', () => resolve()));
}
