import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CommonArgs {
  content: string;
  positionals: string[];
  flags: Record<string, string | boolean | (string | boolean)[] | undefined>;
}

export function parseCommonArgs(
  argv: string[],
  extraOptions: Parameters<typeof parseArgs>[0] extends { options?: infer O } ? O : never = {} as never,
): CommonArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      content: { type: 'string' },
      port: { type: 'string' },
      host: { type: 'string' },
      base: { type: 'string' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      'include-draft': { type: 'boolean' },
      ...extraOptions,
    },
  });

  const content = typeof values.content === 'string' ? values.content : 'examples/demo-bank';

  return {
    content: path.resolve(process.cwd(), content),
    positionals: positionals.map((p) => String(p)),
    flags: values as CommonArgs['flags'],
  };
}

/** Absolute path of the `apps/site` directory relative to this package. */
export function resolveSiteDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/commands/args.ts → ../../../../apps/site
  return path.resolve(here, '..', '..', '..', '..', 'apps', 'site');
}

export function resolveTemplatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'templates');
}
