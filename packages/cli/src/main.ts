#!/usr/bin/env tsx
/**
 * `knowledge-test` — CLI entry.
 *
 * Subcommands:
 *   dev, build, preview, validate, doctor, init, inspect, deploy-init
 */
import { parseArgs } from 'node:util';
import { runDev } from './commands/dev.js';
import { runBuild } from './commands/build.js';
import { runPreview } from './commands/preview.js';
import { runValidate } from './commands/validate.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runInspect } from './commands/inspect.js';
import { runDeployInit } from './commands/deploy-init.js';
import { printHelp, printVersion } from './help.js';
import { logError } from './log.js';

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
    printVersion();
    return;
  }

  try {
    switch (cmd) {
      case 'dev':
        await runDev(rest);
        return;
      case 'build':
        await runBuild(rest);
        return;
      case 'preview':
        await runPreview(rest);
        return;
      case 'validate':
        await runValidate(rest);
        return;
      case 'doctor':
        await runDoctor(rest);
        return;
      case 'init':
        await runInit(rest);
        return;
      case 'inspect':
        await runInspect(rest);
        return;
      case 'deploy-init':
        await runDeployInit(rest);
        return;
      default:
        logError(`Unknown command: ${cmd}`);
        printHelp();
        process.exit(2);
    }
  } catch (err) {
    logError(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  }
}

main();
export { parseArgs };
