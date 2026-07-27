# DECISIONS.md — Architectural decisions

## 1. Monorepo shape: npm workspaces (not pnpm, not turbo)

**Decision.** Use plain `npm` workspaces at the root and keep the workspace
graph flat: `apps/site`, `packages/schema`, `packages/core`, `packages/cli`,
`examples/demo-bank`.

**Why.**
- Every developer already has `npm`; the target audience of this kit
  includes non-JS specialists who just want to publish a static site.
- `npm@10` is stable enough for workspaces.
- No turbo/nx needed: three packages, one app.

**Trade-off.** No cache-based orchestration; individual `npm -w <pkg> run
<script>` calls are used from the root.

## 2. Content-model boundary: `packages/schema` is the source of truth

**Decision.** Define the canonical `Question`, `QuestionOption`, `Module`,
`Reference`, `KnowledgeTestConfig` types **exactly once** in
`packages/schema/src/index.ts` using Zod. `packages/core`, `packages/cli`,
and `apps/site` all import the same schemas.

**Why.** Prevents drift between the loader and the renderer, which was the
biggest source of bugs in prior iterations. Zod also gives runtime
validation for free — reused by the `validate` CLI command.

## 3. Sub-agents and Git worktrees

**Decision.** The empty target repository has no existing code, so literal
`git worktree` fan-out provides no benefit — there is nothing to conflict on
and no long-lived branches to protect. We use **sub-agents** (via the
platform's `task` tool) for parallelizable, read-only work (RL inventory
research), and the orchestrator implements the code path serially on the
integration branch `feat/knowledge-test-kit-v1`.

The **file-scope contract** described in `AGENTS.md` §3 is preserved so that
future rounds of work (e.g. `v0.2.0`, external contributors) can trivially
turn each lane into a real worktree without restructuring the codebase. The
`worktrees.json` file records the intended lane layout for future runs.

## 4. Astro pages + React Islands (no SPA)

**Decision.** All content pages (home, modules, questions, references, about,
learning paths) are pure `.astro` pages rendered at build time. Only three
Islands are hydrated:

- `PracticeIsland` (the answering engine)
- `SearchBox` (Pagefind consumer)
- `ThemeToggle`

**Why.** The old RL project bundled a full React SPA and shipped it via
Vite. That approach:

1. Ships ~200 KB of runtime JS to render mostly static text.
2. Breaks Pagefind and search-engine crawlability without extra plumbing.
3. Forces every knowledge bank to re-build React infrastructure.

**Trade-off.** Practice mode still needs client-side JS, but it is isolated
to one route (`/practice`) and one component tree.

## 5. Review-status normalization at the loader layer only

**Decision.** Normalize `reviewed` → `agent_reviewed` inside
`packages/core/src/adapters/normalize.ts`. Never mutate source JSON files.
Display **both** the raw status and the normalized status on question
pages.

**Why.** Existing content banks (notably `rl-question-base`) use the older
`reviewed` label. Rewriting their files would break the "content repo owns
its content" principle.

## 6. Storage keys are namespaced by bank id

**Decision.** All `localStorage` keys start with
`knowledge-test:<bankId>:`. `bankId` comes from `knowledge-test.config.json
.site.id`.

**Why.** A single browser will accumulate records for multiple banks. Global
keys (e.g. `wrongQuestions`) cause silent cross-contamination.

## 7. GitHub Pages base path is derived at build time

**Decision.** Read `GITHUB_REPOSITORY` from the environment during the CLI
build; fall back to `siteConfig.publicUrl` or `/`. Pass the value to Astro
as `base` and to the client-side router as a `BASE_PATH` constant.

**Why.** GitHub Pages serves project sites under `/<repo>/`, and hard-coded
absolute paths break locally. Automating this avoids per-bank `astro.config`
overrides.

## 8. Skill lives in-tree, not as a separate repo

**Decision.** `skills/knowledge-test-builder/` is committed to this repo.
Agents that consume the skill either clone this repo or vendor the folder.

**Why.** Versioning the skill alongside the tooling guarantees the prompts
match the CLI's behaviour. A `v0.1.0` tag freezes both simultaneously.

## 9. No npm publish in `v0.1.0`

**Decision.** Do not publish `@clt123321/knowledge-test-kit` to npm yet.
Consumers install by cloning this repo or by using the reusable workflow
(`clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.1`).

**Why.** Namespace ownership on npm is unverified at build time; the
publish step should be a deliberate follow-up. The `bin` field, workspace
layout, and CLI already work with `npm link`, so promoting to a package is
mechanical.

## 10. Question rendering is HTML-in-JSON with sanitisation off

**Decision.** Question stems and explanations are treated as **Markdown**
by `packages/core/src/content/renderMarkdown.ts` (using `marked`) and
formulas as **KaTeX** via a rehype-katex-style pass. HTML is escaped by
default; only Markdown constructs are honoured.

**Why.** Content banks are trusted (they live in the same repo as the
site), but a strict rendering layer avoids XSS surprises when a bank
accepts external contributions.
