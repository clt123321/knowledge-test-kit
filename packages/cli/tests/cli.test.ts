import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BIN = path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'knowledge-test.mjs');
const DEMO = path.join(REPO_ROOT, 'examples', 'demo-bank');

function run(args: string[], cwd = REPO_ROOT) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? 1 };
}

describe('cli — help', () => {
  it('prints usage', () => {
    const r = run(['--help']);
    expect(r.stdout).toMatch(/knowledge-test/);
    expect(r.stdout).toMatch(/dev/);
    expect(r.stdout).toMatch(/build/);
    expect(r.stdout).toMatch(/validate/);
  });
});

describe('cli — validate', () => {
  it('validates the demo bank successfully', () => {
    const r = run(['validate', '--content', DEMO]);
    expect(r.stdout + r.stderr).toMatch(/knowledge-test validate/);
    expect(r.stdout + r.stderr).toMatch(/no validation issues/);
    expect(r.status).toBe(0);
  });
});

describe('cli — doctor', () => {
  it('reports on the demo bank', () => {
    const r = run(['doctor', '--content', DEMO]);
    expect(r.stdout).toMatch(/knowledge-test doctor/);
    expect(r.stdout).toMatch(/node/);
    expect(r.stdout).toMatch(/questions/);
    expect(r.status).toBe(0);
  });
});

describe('cli — inspect', () => {
  it('produces migration suggestions', () => {
    const r = run(['inspect', '--content', DEMO]);
    expect(r.stdout).toMatch(/migration suggestions/);
    expect(r.status).toBe(0);
  });
});

describe('cli — init + deploy-init', () => {
  let tmp: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kt-cli-'));
  });
  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('init scaffolds a new bank', () => {
    const target = path.join(tmp, 'new-bank');
    const r = run(['init', target]);
    expect(r.status).toBe(0);
    // Check some expected files exist
    return fs.stat(path.join(target, 'knowledge-test.config.json')).then((s) => {
      expect(s.isFile()).toBe(true);
    });
  });

  it('deploy-init --dry-run does not write', async () => {
    const target = path.join(tmp, 'existing-bank');
    await fs.mkdir(target, { recursive: true });
    const r = run(['deploy-init', '--content', target, '--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/would write/);
    const files = await fs.readdir(target);
    expect(files).toHaveLength(0);
  });

  it('deploy-init writes when not dry-run', async () => {
    const target = path.join(tmp, 'writeable-bank');
    await fs.mkdir(target, { recursive: true });
    const r = run(['deploy-init', '--content', target]);
    expect(r.status).toBe(0);
    await fs.stat(path.join(target, 'knowledge-test.config.json'));
    await fs.stat(path.join(target, '.github', 'workflows', 'pages.yml'));
    await fs.stat(path.join(target, 'docs', 'DEPLOYMENT.md'));
  });

  it('deploy-init does not overwrite without --force', async () => {
    const target = path.join(tmp, 'existing2');
    await fs.mkdir(target, { recursive: true });
    const marker = path.join(target, 'knowledge-test.config.json');
    await fs.writeFile(marker, '{"__mine": true}', 'utf8');
    const r = run(['deploy-init', '--content', target]);
    expect(r.status).toBe(0);
    const raw = await fs.readFile(marker, 'utf8');
    expect(raw).toContain('__mine');
  });
});
