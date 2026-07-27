# STATUS.md — Live build status

Snapshot maintained by the orchestrator. Sub-agents append to their own
handoff notes under `handoffs/`; this file is the top-level dashboard.

## Milestones

- [x] `M0` Baseline commit (LICENSE, README, AGENTS, STATUS, DECISIONS)
- [x] `M1` npm workspaces + tsconfig base
- [x] `M2` `packages/schema` (Zod + status normalization + tests)
- [x] `M3` `packages/core` (adapters, exam, scoring, storage, filtering, content)
- [x] `M4` `packages/cli` (dev/build/preview/validate/doctor/init/inspect/deploy-init)
- [x] `M5` `apps/site` (Astro static site + React Islands + Pagefind + KaTeX)
- [x] `M6` `examples/demo-bank` (10 fictional generic questions, all status
     buckets covered)
- [x] `M7` `skills/knowledge-test-builder` (SKILL.md + 8 prompt templates)
- [x] `M8` `.github/workflows/` (deploy-demo + reusable deploy-content-site)
- [x] `M9` `docs/` + `README.md` + integration plans for the 3 sibling repos
- [x] `M10` Tests + lint + typecheck + demo build + RL integration smoke-check
- [x] `M11` Tag `v0.1.0` pushed to remote (`3c584a8`)
- [x] `M12` Public GitHub Pages live at
     <https://clt123321.github.io/knowledge-test-kit/>
- [x] `M13` `v0.1.1` CI hotfix tag on top of the CI-hardening chain (see
     `docs/RELEASE_NOTES_v0.1.1.md`)

## Push status

Remote SSH probe (`ssh -T git@github.com`) authenticated as `clt123321`.
Origin switched from HTTPS to SSH (`git@github.com:clt123321/knowledge-test-kit.git`).
`git ls-remote origin` returned no refs — remote was **empty**, so `main`
and `v0.1.0` were pushed cleanly without a merge.

`v0.1.1` is a re-tag on top of subsequent CI hardening commits (no
product changes). `v0.1.0` was **not** moved. See
[`docs/RELEASE_NOTES_v0.1.1.md`](docs/RELEASE_NOTES_v0.1.1.md) for the full
commit list and rationale.

No `--force` was ever attempted; nothing was silently reset.

## Deployment snapshot (final)

- Local HEAD: recorded in `docs/RELEASE_NOTES_v0.1.1.md`.
- Remote `refs/heads/main`: fast-forward of local `main`.
- Remote `refs/tags/v0.1.0`: `3c584a8` (frozen; known-broken lockfile).
- Remote `refs/tags/v0.1.1`: current CI-green HEAD.
- GitHub Actions: `CI`, `Deploy Demo`, `Deploy Content Site` (reusable) —
  all green on the `v0.1.1` commit.
- Pages source: **GitHub Actions** (enabled manually via Settings).
- Public URL: <https://clt123321.github.io/knowledge-test-kit/> — HTTP 200,
  static routes verified for `/`, `/modules/`, `/questions/`, `/practice/`,
  `/references/`, `/about/`, `/paths/`, `/pagefind/pagefind.js`, individual
  question pages, and module pages. CSS/JS assets load under the
  `/knowledge-test-kit/_astro/` base path.

## Sub-agent runs

| Agent id | Purpose                             | Branch (planned)      | Result |
|----------|-------------------------------------|-----------------------|--------|
| A        | RL inventory + migration map        | `agent/rl-inventory`  | see `research/rl-repo-inventory.md` + `handoffs/rl-inventory.md` |
| B/C/D    | (not spawned as separate branches — see DECISIONS §3) | n/a | orchestrator-implemented |

## Known limitations

Recorded honestly in the final report and in `docs/KNOWN_LIMITATIONS.md`.
The only new item vs. `v0.1.0` is the immutable-but-broken `v0.1.0` tag
itself — downstream users should pin `@v0.1.1`.
