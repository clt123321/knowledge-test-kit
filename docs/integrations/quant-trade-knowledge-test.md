# Integration plan — `../quant-trade-knowledge-test`

> This plan was drafted from a directory listing only. The kit team has
> NOT modified `../quant-trade-knowledge-test`.

## Assumed current state

Similar scaffold to `ml-compiler-knowledge-test`: `AGENTS.md`,
`DECISIONS.md`, `PROJECT_SPEC.md`, `PLAN.md`, `STATUS.md`, plus `config/`,
`docs/`, `handoffs/`, `manifests/`, `research/`, `scripts/`, `src/`,
`tests/`, `worktrees/`. No content in a shape the kit adapter can
auto-detect at first glance — `src/` may still be a Vite SPA in progress.

## Recommended steps

1. Decide where questions will live. Two choices:
   - `questions/**/*.json` (canonical, kit's preferred layout), or
   - `src/data/questions/**/questions-*.json` (RL-legacy — auto-detected).

2. Add `knowledge-test.config.json` at the repo root pointing at that
   location:

   ```json
   {
     "schemaVersion": "1.0.0",
     "site": {
       "id": "quant-trade-knowledge-test",
       "title": "Quant Trade Knowledge Test",
       "language": "zh-CN",
       "repository": "clt123321/quant-trade-knowledge-test"
     },
     "content": {
       "questionGlobs": ["questions/**/*.json"],
       "referenceGlobs": ["references/**/*.{json,md}"],
       "syllabusGlobs": ["docs/*.md"],
       "moduleFile": "manifests/modules.json"
     },
     "exam": {
       "singleScore": 2,
       "multipleScore": 3,
       "passingRatio": 0.6,
       "shuffleQuestions": true,
       "shuffleOptions": true,
       "defaultSingleCount": 20,
       "defaultMultipleCount": 10
     }
   }
   ```

3. Add `.github/workflows/pages.yml` (see `docs/DEPLOYMENT.md`).

## Once the bank exists

```bash
node /path/to/knowledge-test-kit/packages/cli/bin/knowledge-test.mjs \
     validate --content /path/to/quant-trade-knowledge-test
```

Verify:

- All questions in `agent_reviewed` or `human_reviewed`.
- No duplicate `id`s.
- Every option has an `optionExplanations[optId]` entry.
- Every non-deprecated question has at least one `sourceRefs` entry.

## Open questions the maintainer should answer

- What is the primary content language? (used to set `site.language`)
- Is there a stricter version of the schema (e.g. a fixed set of
  archetypes or claim types)? If yes, mirror it via
  `extendQuestionSchema()` and validate in a repo-local test.
- Are the sources primarily papers, official docs, or vendor whitepapers?
  This affects which `type` value to prefer in `sourceRefs`.

## Non-goals for this plan

- The kit team is not modifying the repo. Any actual edits must be
  performed by the maintainer or by an agent explicitly authorised to
  write outside this kit.
