# Known limitations (v0.1.1)

This document covers `v0.1.1`. `v0.1.1` is a CI-only hotfix over `v0.1.0`;
no user-facing behavior changed. Expected gaps and workarounds:

## `v0.1.0` tag is known-broken on public CI

The `v0.1.0` tag points at commit `3c584a8`, whose `package-lock.json`
resolves packages against `https://npm.corp.kuaishou.com/` (an internal
mirror). Public GitHub Actions runners cannot reach that host, so `npm ci`
silently skips packages like `zod` and `vitest`.

**Fix.** `v0.1.1` re-tags on top of a lockfile regenerated against
`https://registry.npmjs.org`. Downstream content repositories should pin
`@v0.1.1`, not `@v0.1.0`. See `docs/RELEASE_NOTES_v0.1.1.md`.

## Not published to npm yet

The kit is consumable as (a) a Git clone or (b) a reusable Actions
workflow. It has NOT been published as `@clt123321/knowledge-test-kit`.
Once ownership on the npm namespace is confirmed, the `bin` and
`workspaces` layout is already publish-ready.

**Workaround.** Point content repositories at
`clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.1`
for CI, and use `npm run cli -- <command>` inside a local clone for
authoring.

## Practice mode uses a lightweight scoring engine

`apps/site/src/islands/PracticeIsland.tsx` intentionally re-implements the
scoring loop in ~250 lines of React instead of pulling `@knowledge-test/core`
into the client bundle. This keeps the JS payload small but means the
client engine and the core engine could drift.

**Guarantees kept in sync by tests:**

- Same-set answer matching (all-or-nothing multiple-choice).
- Dynamic max score = `sum(single*singleScore + multiple*multipleScore)`.
- `passScore = ceil(maxScore * passRatio)`.

**Guarantees NOT ported to the client** (yet):

- Legacy `deriveExamRecordScore` correction. A record produced by the
  client engine is authoritative; there is no server-side re-derivation.
- Seedable PRNG (`mulberry32`). Client uses `Math.random`.

## Adapter coverage

The adapter recognises three layouts (`canonical`, `rl-legacy`,
`exported`). Other layouts (e.g. per-question directory with images
alongside) require an explicit `content.questionGlobs` override in
`knowledge-test.config.json`.

## KaTeX rendering is server-side only

Question stems and explanations are rendered to HTML at build time. The
practice island does not render KaTeX on user input; option / stem strings
containing raw `$…$` will show as plain text during practice. This is
intentional for v0.1.0 to keep the practice bundle under 30 KB gzipped.

## Pagefind index

The site is served with a fresh Pagefind index every build. There is no
incremental indexing.

## No unified theme editor

Colour themes are driven by `theme.primaryColor` in the config and the CSS
variables in `apps/site/src/styles/global.css`. There is no runtime theme
switcher island in v0.1.0.

## Dark mode is system-controlled only

The site respects `prefers-color-scheme: dark` but does not expose a
toggle island. Users can override via a browser extension.

## Git worktree fan-out was not exercised end-to-end

`AGENTS.md` and `worktrees.json` describe a 4-lane sub-agent + worktree
architecture. For v0.1.0, only the RL-inventory lane was executed as a
separate sub-agent; the other three lanes were executed serially by the
orchestrator on the integration branch. The file-scope contract is
preserved so future rounds can trivially materialise the missing lanes as
real worktrees.

## GitHub Actions permissions

Reusable workflows that themselves call `actions/deploy-pages@v4` may be
restricted on some accounts / organizations. See `docs/DEPLOYMENT.md`
Option B for the inline fallback.
