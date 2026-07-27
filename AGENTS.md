# AGENTS.md — Working Rules for AI Coding Agents

This file tells any AI coding agent (Codex, Cortex, MyFlicker, Claude Code,
Gemini CLI, etc.) how to behave in **this** repository.

If you are a human, you can read it too — it doubles as an architecture map.

---

## 1. Project mission

`knowledge-test-kit` is a **domain-agnostic** knowledge test kit. It does
three things at once:

1. Turn a *content repository* (JSON questions + Markdown references) into a
   deployable, fully-static knowledge site (Astro + Pagefind + KaTeX,
   deploy-friendly for GitHub Pages).
2. Provide a local, no-backend **answering / practice engine**
   (React Islands, `localStorage`-only).
3. Ship a `skills/knowledge-test-builder/` workflow that any agent can follow
   to produce a fresh, audited knowledge bank from scratch.

**A specific knowledge bank repository must stay lightweight**: it only owns
its content (`questions/`, `references/`, `syllabus/`, `reviews/`,
`knowledge-test.config.*`, `.github/workflows/pages.yml`). It does **not**
copy the Astro app, the CSS, or the answering core.

---

## 2. Repository layout (source of truth)

```
apps/site/                Astro site (renderer) — only place with React/JSX
packages/schema/          Zod schemas + status normalization
packages/core/            Framework-free logic: adapters, exam, scoring,
                          storage, filtering, content loader
packages/cli/             `knowledge-test` binary
examples/demo-bank/       Small demo content bank (6-10 generic questions)
skills/knowledge-test-builder/
                          SKILL.md + prompt templates for content authoring
scripts/                  Ops scripts (release, integration checks)
docs/                     User-facing docs and integration plans
research/                 Read-only analyses of reference repos
handoffs/                 Sub-agent handoff notes (kept in git)
.github/workflows/        CI + Pages workflows
```

---

## 3. Ownership map (who touches what)

The orchestrator (main agent) is the ONLY writer for these files. Sub-agents
must not modify them:

```
package.json
package-lock.json
tsconfig.base.json
STATUS.md
DECISIONS.md
AGENTS.md
worktrees.json
.github/workflows/*
```

Recommended sub-agent lanes (branch names + write-scope):

| Lane                 | Branch                | May write to                                      |
|----------------------|-----------------------|---------------------------------------------------|
| RL inventory         | `agent/rl-inventory`  | `research/`, `handoffs/rl-inventory.md`           |
| Astro site           | `agent/astro-site`    | `apps/site/`, `handoffs/astro-site.md`            |
| Schema + Core        | `agent/core-engine`   | `packages/schema/`, `packages/core/`, handoff     |
| CLI + Skill          | `agent/cli-skill`     | `packages/cli/`, `skills/`, `docs/`, `examples/`  |

Sub-agent contract:

1. Only write inside your lane.
2. Run tests inside your lane.
3. Commit and return the commit hash.
4. The orchestrator inspects the diff, cherry-picks, and resolves dep/config
   changes centrally on the integration branch `feat/knowledge-test-kit-v1`.

---

## 4. Hard rules

- **Never** modify `../rl-question-base`, `../ml-compiler-knowledge-test`,
  `../quant-trade-knowledge-test`, or any sibling repository from within this
  repo.
- **Never** copy the real question banks from those repos. Only 6-10
  fictional generic examples belong under `examples/demo-bank`.
- **Never** commit tokens, credentials, or `.env` files.
- **Never** `git push --force`, `git reset --hard`, or delete sibling
  worktrees / repos.
- **Never** silently claim success. If `git push`, tests, or a build fail,
  report the exact failure and stop.
- **Never** embed a full React SPA inside an Astro page — use Astro pages +
  React Islands.

---

## 5. Content contract

A knowledge bank repository is any directory containing a
`knowledge-test.config.json` **or** matching one of the auto-detected layouts:

- Canonical: `questions/**/*.json`
- RL legacy: `src/data/questions/**/*.json` + `src/lib/modules.*`
- Exported: `exports/question-bank.json`

`packages/core/adapters/` auto-detects. Explicit config always wins.

Review statuses are normalized inside the loader:

```
draft            → draft
reviewed         → agent_reviewed   (legacy remap)
agent_reviewed   → agent_reviewed
human_reviewed   → human_reviewed
deprecated       → deprecated
```

Publicly served / practice-eligible: `agent_reviewed`, `human_reviewed`
(plus the raw `reviewed` alias). `draft` is only visible in dev mode.

---

## 6. Definition of done for this repo

- `npm install` succeeds from a clean checkout.
- `npm test` passes.
- `npm run lint` and `npm run typecheck` pass.
- `npm run validate:demo` and `npm run build:demo` succeed.
- `npm run dev -- --content ../rl-question-base` boots (locally verified,
  not necessarily long-running).
- `npm run build -- --content ../rl-question-base` produces `dist/` with
  static question pages and a `pagefind/` index.
- `README.md` explains user actions before architecture.
- `skills/knowledge-test-builder/SKILL.md` is directly usable by another
  agent.

---

## 7. When in doubt

Read `DECISIONS.md` for architectural rationale, `STATUS.md` for what has
actually been built vs. what is aspirational, and the relevant `handoffs/`
note for hand-over context between sub-agents.
