#!/usr/bin/env node
/* eslint-disable */
// Thin shim: runs the TS CLI through the `tsx` loader so we can ship TS-native
// source across the monorepo without a build step.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, '..', 'src', 'main.ts');

let importArg = null;
try {
  // Resolve the tsx package location; --import will re-resolve it relative to Node.
  require.resolve('tsx');
  importArg = 'tsx';
} catch {
  importArg = null;
}

const nodeArgs = importArg
  ? ['--import', importArg, entry, ...process.argv.slice(2)]
  : [entry, ...process.argv.slice(2)];

const child = spawn(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
