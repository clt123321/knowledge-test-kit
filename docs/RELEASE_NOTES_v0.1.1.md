# Knowledge Test Kit v0.1.1

A CI-only hotfix release on top of [`v0.1.0`](./RELEASE_NOTES_v0.1.0.md).

No user-facing feature changes. No schema or CLI API changes. Downstream
content repositories should prefer this tag over `v0.1.0` when referencing
the reusable workflow.

## Why this tag exists

`v0.1.0` was tagged at commit `3c584a8`, which contains a `package-lock.json`
whose `resolved:` URLs point at an internal Kuaishou npm mirror
(`https://npm.corp.kuaishou.com/`). That host is unreachable from public
GitHub Actions runners: `npm ci` returns success while silently skipping
packages such as `zod` and `vitest`, breaking downstream CI.

`v0.1.1` fixes this by re-tagging on top of a chain of CI-hardening commits
whose lockfile was regenerated against `https://registry.npmjs.org`.

## What changed since v0.1.0

All commits are CI/build fixes only. No files under `packages/**/src`,
`apps/site/src`, `skills/**`, or `examples/**/questions` changed behavior.

- `fix(ci): regenerate package-lock against public npmjs.org registry`
  — root-cause fix for the corporate-mirror lockfile.
- `debug(ci): add workspace layout probe + trim typecheck to src`
  — narrow `astro check` to `src/` so tests outside `src/` do not fight
    tsconfig `moduleResolution`.
- `fix(ci): pin schema+core to moduleResolution NodeNext`
  — override the base `Bundler` resolver for packages whose tests live
    outside `src/`.
- `fix(ci): drop node types from schema tsconfig`
  — schema package no longer relied on `@types/node`.
- `fix(ci): stabilize CI on Node 20 (CLI shim + typecheck→test)`
  — CLI shim spawns `tsx` directly via `node_modules/.bin/tsx` for
    portability across Node 20 (CI) and Node 22 (local).
- `fix(build): drop rootDir from schema/core tsconfigs`
  — allows tests outside `src/` without a rootDir conflict.
- `chore(ci): drop paths filter on deploy-demo` and
  `fix(ci): remove configure-pages@v5 enablement`
  — Pages workflow simplifications after enabling Pages via the UI.

## Reusable workflow

Downstream content repositories should now use:

```yaml
jobs:
  deploy:
    uses: clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.1
    with:
      kit_ref: v0.1.1
      content_path: .
```

`@v0.1.0` still exists but is known-broken for public runners.

## Verification

- CI on tag commit: green (test + lint + typecheck + validate + build).
- Deploy Demo on tag commit: green.
- Public Pages URL: <https://clt123321.github.io/knowledge-test-kit/> (HTTP 200).
- All 64 tests still pass (17 schema + 39 core + 8 CLI).
- Demo build: 23 static HTML pages + Pagefind index.
- RL integration build (`../rl-question-base`): 426 static HTML pages +
  Pagefind index.

## Compatibility

- Package versions in workspace `package.json` files are bumped
  `0.1.0` → `0.1.1`. No published npm packages yet; the version bump is
  informational for downstream forks and future publish steps.
- Content schema (`knowledge-test.config.json`, question JSON) is
  unchanged. Content banks built for `v0.1.0` build unchanged under
  `v0.1.1`.

## Known limitations (unchanged from v0.1.0)

See [`docs/KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md).
