# SKILL — knowledge-test-builder

> **Type**: content-authoring workflow
> **Owner**: [`clt123321/knowledge-test-kit`](https://github.com/clt123321/knowledge-test-kit)
> **Version**: 0.1.0 (matches kit release)
> **Intended agents**: Codex, Cortex, MyFlicker, Claude Code, Gemini CLI,
>   or any coding agent that can read Markdown + call other agents

This skill teaches an agent (or an orchestrator running several agents) how
to produce a **complete, audited, domain-specific knowledge test bank** from
scratch and publish it as a static GitHub Pages site using
[`knowledge-test-kit`](../../README.md).

## When to use this skill

Use it when a user says any of:

- "build me a knowledge bank for `<topic>`"
- "生成 `<主题>` 的题库"
- "make a static quiz site for `<topic>` and deploy it"
- "帮我搞 400 道 `<主题>` 单选/多选题"

Do **not** use it for one-off questions (write them in-line) or for open-ended
essay banks (the kit only supports single- and multiple-choice items).

## Inputs the agent must collect from the user

| Key                    | Meaning                                                             |
|------------------------|---------------------------------------------------------------------|
| `topic`                | Subject of the bank (e.g. "quantitative trading")                   |
| `audience`             | Target reader (e.g. "junior quant researchers")                     |
| `target_count`         | Total questions (recommended range: 100 - 500)                      |
| `module_count`         | Number of modules; each module gets a directory                     |
| `single_vs_multiple`   | Ratio of single to multiple choice (default 3:1)                    |
| `difficulty_dist`      | Distribution across L1-L5 (default 15/25/30/20/10)                  |
| `source_policy`        | Which source tiers to require (`tier1` textbook / `tier2` peer      |
|                        | reviewed paper / `tier3` frontier note)                             |
| `output_repo`          | Target Git repository for the bank                                  |
| `enable_subagents`     | true if the orchestrator can fan-out sub-agents                     |
| `enable_worktrees`     | true if `git worktree` is available                                 |
| `publish_site`         | true → also deploy to GitHub Pages after audit passes               |

If any of these are unspecified, ask **one** question at a time before
starting Stage 0; do not assume defaults silently.

## The 10 stages

Every stage has a matching prompt template under `prompts/`.

### Stage 0 — Goal & boundaries (see `prompts/orchestrator.md`)

Write a `goal.md` inside the target repo that names the audience, the
success criteria, and — critically — what the bank will **not** cover.

### Stage 1 — Source survey (see `prompts/research-agent.md`)

Spawn a `research-agent`. Output: `references/references.json` with tiered
sources. Every source needs `type`, `tier`, `title`, `url|isbn|arxivId`.

### Stage 2 — Syllabus & question quotas

Write `syllabus/overview.md` and `manifests/*.json` per module. Each module
lists its subtopics, target question count, type mix, difficulty mix,
archetype mix, and depth mix.

### Stage 3 — Canary questions

Generate 5 - 10 questions in **one** module, run the audit and blind
review, and update the generator prompts before touching the other modules.
Catch systematic template failures early.

### Stage 4 — Bulk generation (see `prompts/generator-agent.md`)

Fan-out one `generator-agent` per module. Each writes JSON files
(`questions/<module>/<batch>.json`), max 25 questions per file. Every
question starts in `reviewStatus: "draft"`.

### Stage 5 — Primary review (blind) (see `prompts/primary-reviewer.md`)

Strip correct answers, ask a **different** agent to answer & explain, then
reveal the intended answer. Grade each item PASS / MINOR / MAJOR / BLOCKER.

### Stage 6 — Repair (see `prompts/repair-agent.md`)

Only touch flagged items. Bump `version`. Do not regenerate the whole bank.

### Stage 7 — Verification (see `prompts/verifier-agent.md`)

A **third** agent reviews all modified items + a random sample of PASS
items. Promote survivors to `reviewStatus: "agent_reviewed"`.

### Stage 8 — Human queue (see `prompts/global-reviewer.md`)

Export a compact JSON of "still contested" items (BLOCKER, disagreement
between rounds, weak distractors, single-source items) for a human to
skim. Human sign-off promotes them to `"human_reviewed"`.

### Stage 9 — Publish (see `prompts/publisher.md`)

```
knowledge-test validate --content .
knowledge-test build     --content .
git commit / push / tag
```

Ensure `.github/workflows/pages.yml` exists (or run `knowledge-test
deploy-init`).

## Non-negotiable rules

- Every question **must** validate against `packages/schema` (see
  `schemas/question.schema.json` in this skill).
- No LLM-fabricated citations. If an agent cannot cite a real source in
  `sourceRefs`, the question stays `draft` and enters the human queue.
- Round 1 and Round 2 reviewers must be **different** agents (different
  vendor **or** different model family). Same-model self-review has been
  shown to leak intended answers.
- Never rewrite an existing question in-place after promotion. Bump
  `version`, keep the old id.
- Do not commit intermediate agent scratchpads to the content repo — keep
  them under `reviews/round-N-work/` and add that path to `.gitignore` if
  the reviews are large.

## Sub-agent orchestration recipe

The kit's `AGENTS.md` describes a 4-lane split (RL inventory, Astro site,
Core engine, CLI/Skill). For **content** work, mirror the pattern:

| Lane              | Branch                          | Writes                                    |
|-------------------|---------------------------------|-------------------------------------------|
| research          | `content/research`              | `references/`, `syllabus/`                |
| generator (per M) | `content/gen-<module-id>`       | `questions/<module>/`, `manifests/*.json` |
| primary reviewer  | `content/review-round-1`        | `reviews/round-1-<module>.md`             |
| repair            | `content/repair-<module>`       | `questions/<module>/*.json` (in place)    |
| verifier          | `content/verify`                | `reviews/round-2-<module>.md`             |
| publisher         | `main`                          | `.github/workflows/`, tag                 |

Only the publisher touches the default branch.

## Files in this skill

- `SKILL.md` (this file)
- `prompts/orchestrator.md`
- `prompts/research-agent.md`
- `prompts/generator-agent.md`
- `prompts/primary-reviewer.md`
- `prompts/repair-agent.md`
- `prompts/verifier-agent.md`
- `prompts/global-reviewer.md`
- `prompts/publisher.md`
- `schemas/question.schema.json` — JSON Schema mirror of `packages/schema`
  (for agents that speak JSON Schema natively)
- `examples/module-manifest.example.json`

## Escalation

If any stage produces > 20 % BLOCKERs, stop and revisit Stage 2 (syllabus)
before continuing — the target is too broad or the source coverage is too
thin. Report the finding to the user and wait for revised quotas.
