# knowledge-test-kit v0.1.0

**First release.** A domain-agnostic knowledge test kit that turns any folder
of JSON questions into a fully-static site with local practice mode.

Tag: `v0.1.0`  ·  Release date: 2026-07-27

---

## What's inside

### Astro static site generator (`apps/site`)

- Astro 4 + React Islands + KaTeX + Pagefind
- Pure static output — no backend, no database, no accounts
- File-based routing:
  - `/` — home with stats and module index
  - `/modules/` + `/modules/[module]/`
  - `/questions/` + `/questions/[id]/` (every question gets a stable URL)
  - `/references/{,books,papers,docs}/`
  - `/paths/` — learning path
  - `/practice/` — local answering island
  - `/about/`
- KaTeX rendering server-side at build time
- Pagefind full-text search across stems, options, explanations, tags
- GitHub Pages base path derived automatically from `GITHUB_REPOSITORY`

### Local practice engine (`apps/site/src/islands/PracticeIsland.tsx`)

- Modes: comprehensive / per-module / random / retry-wrong
- Single- and multiple-choice scoring (all-or-nothing on multi, matches
  the RL kit's semantics)
- Dynamic max score (recomputed from actual sampled question mix)
- 60% pass threshold with `ceil`
- LocalStorage records, wrong-question queue, JSON import / export
- Records namespaced by bank id: `knowledge-test:<bankId>:*`

### Content schema (`packages/schema`)

- Zod-based `BaseQuestionSchema` + `extendQuestionSchema()`
- Canonical review-status normalization
  (`reviewed` → `agent_reviewed` at load time; source files never
  mutated)
- `KnowledgeTestConfigSchema` with sensible defaults

### Framework-free core (`packages/core`)

- **adapters** — auto-detects three bank layouts:
  - `canonical` (`questions/**/*.json`)
  - `rl-legacy` (`src/data/questions/**/questions-*.json` + `manifest.json`)
  - `exported` (`exports/question-bank.json`)
- **exam** — comprehensive / module / retry-wrong / random paper builders
- **scoring** — `scorePaper`, `deriveExamRecordScore` legacy re-scoring
- **storage** — bank-namespaced `localStorage` model + capped record log
- **filtering** — status + module + subtopic + difficulty + keyword
- **random** — Fisher-Yates + `mulberry32` seeded PRNG

### CLI (`packages/cli`)

Binary: `knowledge-test` (alias `kt`).

Commands:

- `dev` — Astro dev server against any content dir
- `build` — validated static build + Pagefind index
- `preview` — serve `dist/`
- `validate` — deep bank check (parse, dupe id, answer sanity, status
  distribution)
- `doctor` — deploy readiness report
- `init <target>` — scaffold a lightweight content-only bank
- `inspect` — migration suggestions for an existing bank
- `deploy-init` — add config + Pages workflow to an existing bank
  (`--dry-run`, `--force`)

### Demo bank (`examples/demo-bank`)

10 fictional generic software-engineering questions across 3 modules;
covers every review-status bucket (`draft`, `agent_reviewed`,
`human_reviewed`, `deprecated`) and every question type.

### Authoring skill (`skills/knowledge-test-builder`)

- `SKILL.md` — 10-stage workflow: goal → sources → syllabus → canary →
  generation → primary review → repair → verification → human queue →
  publish
- 8 prompt templates (orchestrator / research / generator /
  primary-reviewer / repair / verifier / global-reviewer / publisher)
- JSON Schema mirror of the question shape
- Example module manifest

### GitHub Actions (`.github/workflows`)

- `ci.yml` — typecheck + test + validate + demo build on push / PR
- `deploy-demo.yml` — builds and deploys the demo bank to Pages, auto-
  enables Pages via `actions/configure-pages@v5`
- `deploy-content-site.yml` — **reusable workflow** any downstream
  content repo can call at
  `clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.0`

---

## Verification receipts

| Check                                | Result                              |
|--------------------------------------|-------------------------------------|
| `npm test`                           | 64 / 64 tests pass (17 schema + 39 core + 8 CLI) |
| `npm run typecheck`                  | 0 errors, 6 unused-import hints     |
| `npm run validate:demo`              | 12 questions, 0 issues              |
| `npm run build:demo` (with `GITHUB_REPOSITORY`) | 23 HTML pages, Pagefind 622 words, base `/knowledge-test-kit/` |
| `knowledge-test validate --content ../rl-question-base` | 400 questions, 16 modules, 0 issues (all `reviewed` → `agent_reviewed`) |
| `knowledge-test build --content ../rl-question-base`    | 426 static pages, Pagefind 4570 words |
| `knowledge-test deploy-init --dry-run` | never overwrites existing files    |

Full receipts are recorded in `STATUS.md`.

---

## Known limitations

- **Not on npm yet.** Install by cloning the repo or by using the reusable
  workflow. Namespace `@clt123321/knowledge-test-kit` is reserved for a
  future minor release.
- Practice mode has its own trimmed scoring loop (~250 lines of React)
  instead of importing `@knowledge-test/core` into the client bundle, to
  keep the payload small. Kept in sync by tests.
- Sitemap integration is deferred to v0.2.0 — an incompatibility between
  `@astrojs/sitemap` and the current Astro output surfaced during release
  verification.
- No runtime theme-switch island (respects `prefers-color-scheme` only).
- Only one sub-agent lane (RL inventory) was materialised as a real
  worktree; the others were orchestrator-implemented on the integration
  branch (see `DECISIONS.md §3`).

See `docs/KNOWN_LIMITATIONS.md` for the full list.

---

## Getting started

```bash
git clone https://github.com/clt123321/knowledge-test-kit.git
cd knowledge-test-kit
npm install
npm run dev                                    # demo bank
npm run dev  -- --content ../rl-question-base  # sibling RL bank
npm run build -- --content ../rl-question-base
```

Deploy your own bank in three files: see
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) and
[`docs/integrations/`](../docs/integrations/).

## Reproducing this release

- Kit HEAD (`main`): commit tagged `v0.1.0`
- Content used for RL smoke-check: `../rl-question-base` at whatever
  commit is checked out locally (the kit does not modify the RL repo)
- Node: 20.x (release-tested on 22.22.3 locally)

## Next milestones (not in v0.1.0)

- Publish `@clt123321/knowledge-test-kit` to npm
- Merge integration workflows into `../rl-question-base`,
  `../ml-compiler-knowledge-test`, `../quant-trade-knowledge-test`
- Bring back `@astrojs/sitemap` when the upstream fix lands
- Materialise the remaining three sub-agent lanes in a real
  `git worktree`-based release
