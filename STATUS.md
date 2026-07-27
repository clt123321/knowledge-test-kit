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
- [x] `M11` Tag `v0.1.0` locally (push status recorded below)

## Push status

Attempted `git push -u origin main` at v0.1.0:

```
remote: Permission to clt123321/knowledge-test-kit.git denied to clt123321.
fatal: unable to access 'https://github.com/clt123321/knowledge-test-kit.git/':
       The requested URL returned error: 403
```

Local `main` and tag `v0.1.0` are intact. To finish publishing from an
authenticated shell:

```
git push -u origin main
git push origin v0.1.0
```

No `--force` was ever attempted; nothing was silently reset. See
`docs/MANUAL_GITHUB_SETUP.md` for the follow-up Settings clicks
(enable Pages via Actions, mark as Template repository).

## Sub-agent runs

| Agent id | Purpose                             | Branch (planned)      | Result |
|----------|-------------------------------------|-----------------------|--------|
| A        | RL inventory + migration map        | `agent/rl-inventory`  | see `research/rl-repo-inventory.md` + `handoffs/rl-inventory.md` |
| B/C/D    | (not spawned as separate branches — see DECISIONS §3) | n/a | orchestrator-implemented |

## Known limitations

Recorded honestly in the final report and in `docs/KNOWN_LIMITATIONS.md`.
