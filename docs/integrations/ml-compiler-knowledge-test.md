# Integration plan — `../ml-compiler-knowledge-test`

> This plan was drafted from a structural inventory only. The kit team has
> NOT modified `../ml-compiler-knowledge-test`. Any concrete migration
> should be gated on the maintainer's approval.

## Assumed current state

`ml-compiler-knowledge-test/` sits alongside `knowledge-test-kit/` and
already carries a rich scaffold: `AGENTS.md`, `DECISIONS.md`,
`PROJECT_SPEC.md`, `PLAN.md`, `STATUS.md`, plus `data/`, `docs/`,
`exports/`, `handoffs/`, `manifests/`, `references/`, `reviews/`,
`schemas/`, and `scripts/`.

If `data/` follows the same per-module directory pattern as `rl-question-base`
(e.g. `data/questions/**/*.json`), the kit's canonical adapter will pick it
up with only a config change (`content.questionGlobs`).

## Recommended additions

1. `knowledge-test.config.json`:

   ```json
   {
     "schemaVersion": "1.0.0",
     "site": {
       "id": "ml-compiler-knowledge-test",
       "title": "ML Compiler Knowledge Test",
       "language": "zh-CN",
       "repository": "clt123321/ml-compiler-knowledge-test"
     },
     "content": {
       "questionGlobs": ["data/questions/**/*.json"],
       "referenceGlobs": ["references/**/*.{json,md}"],
       "syllabusGlobs": ["docs/*.md"],
       "moduleFile": "manifests/modules.json"
     },
     "review": {
       "publicStatuses": ["agent_reviewed", "human_reviewed"],
       "practiceStatuses": ["agent_reviewed", "human_reviewed"]
     },
     "exam": {
       "singleScore": 2,
       "multipleScore": 3,
       "passingRatio": 0.6,
       "shuffleQuestions": true,
       "shuffleOptions": true,
       "defaultSingleCount": 30,
       "defaultMultipleCount": 15
     },
     "theme": { "primaryColor": "", "darkMode": true }
   }
   ```

2. `.github/workflows/pages.yml` (already exists in the ML compiler repo per
   the `ls` inventory — verify it references
   `clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.1`
   and update if not).

3. If `data/questions/**/*.json` uses a different top-level structure (e.g.
   `{ "questions": [...] }` wrapper), the kit already handles it — the
   adapter flattens both flat arrays and `{questions: [...]}` wrappers.

## Pre-flight checks (for the maintainer to run)

```bash
node /path/to/knowledge-test-kit/packages/cli/bin/knowledge-test.mjs \
     validate --content /path/to/ml-compiler-knowledge-test

node /path/to/knowledge-test-kit/packages/cli/bin/knowledge-test.mjs \
     doctor --content /path/to/ml-compiler-knowledge-test

node /path/to/knowledge-test-kit/packages/cli/bin/knowledge-test.mjs \
     inspect --content /path/to/ml-compiler-knowledge-test
```

Expect the `inspect` output to flag: missing config file, missing Pages
workflow (or existing custom deploy), and any raw `reviewed` statuses that
would be normalised to `agent_reviewed`.

## What NOT to touch

- Any existing scripts under `scripts/`
- Any existing `handoffs/*.md`
- The existing `PROJECT_SPEC.md` — it can coexist with the kit
- The existing schema under `schemas/` — the kit re-validates but does
  not overwrite

## Follow-up

If the ML compiler bank uses a domain-specific extended schema (custom
archetypes, difficulty scale beyond 1-5, etc.), file an issue against
`knowledge-test-kit` describing the extra fields. The kit's
`extendQuestionSchema()` helper in `packages/schema` is designed to accept
per-bank enum extensions without forking.
