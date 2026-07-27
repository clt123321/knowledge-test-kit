#!/usr/bin/env node
/* eslint-disable */
// Thin shim: runs the TS CLI through the `tsx` binary so we can ship
// TS-native source across the monorepo without a build step.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, '..', 'src', 'main.ts');

/**
 * Resolve the `tsx` CLI binary. We look up `tsx/package.json` to find its
 * install root, then read the `bin.tsx` field.
 */
function resolveTsxBin() {
  try {
    const pkgPath = require.resolve('tsx/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const binField = pkg.bin;
    const binRel = typeof binField === 'string' ? binField : binField && binField.tsx;
    if (!binRel) return null;
    return path.join(path.dirname(pkgPath), binRel);
  } catch {
    return null;
  }
}

const tsxBin = resolveTsxBin();

let cmd, cmdArgs;
if (tsxBin) {
  cmd = process.execPath;
  cmdArgs = [tsxBin, entry, ...process.argv.slice(2)];
} else {
  // Last-resort: try `--import tsx`. Node 20.6+ supports this.
  cmd = process.execPath;
  cmdArgs = ['--import', 'tsx', entry, ...process.argv.slice(2)];
}

const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
