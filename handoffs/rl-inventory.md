# Handoff — Agent A (RL inventory)

**Lane**: `agent/rl-inventory`
**Status**: complete
**Artefacts**:

- `research/rl-repo-inventory.md` — full markdown inventory (28 sections)
- `research/rl-repo-inventory.json` — machine-readable summary + migration map

## Key findings for downstream agents

### For Agent C (Schema + Core)

1. **Schema split**. The RL `QuestionSchema` is 90 % generic; the RL-only
   parts are (a) the `module` enum, (b) `archetype`/`depth`/`claimType`
   enums, (c) the `bank-400-` batch rule, and (d) the "paper_design_intent
   requires research-grade claim" cross-field rule. Ship a `baseQuestion`
   Zod schema that accepts `module: string`, `difficulty: number()`, and an
   optional `subtopic`, then expose `extendQuestion({ moduleIds, archetypes,
   claimTypes, extraRules })` that returns a narrower schema for kits that
   want it.

2. **Status normalization**. RL uses `draft | reviewed | deprecated`. Map:

   ```
   reviewed → agent_reviewed
   ```

   in the loader, keeping the raw value on `question._rawReviewStatus` for
   UI display.

3. **Dynamic max score is a keeper**. `configForActualQuestions` +
   `scorePaper` recomputing `maxScore` from actual sampled questions is the
   right shape — port verbatim, only rename types.

4. **Storage keys must be bank-namespaced**:
   `knowledge-test:<bankId>:records:v1`,
   `knowledge-test:<bankId>:settings:v1`.

5. **`deriveExamRecordScore` legacy-correction pattern** should stay.
   Rewriting stored records is dangerous; deriving corrected scores at read
   time is safe.

### For Agent B (Astro site)

1. **HashRouter → file-based Astro routing** with `base` derived from
   `GITHUB_REPOSITORY`. Do **not** use `HashRouter` — Pagefind and OG tags
   need real URLs.
2. Existing RL pages (`HomePage`, `ExamPage`, `ResultPage`,
   `QuestionBankPage`) are monolithic and inline all sub-components. Split
   into: `PracticeIsland` (exam runner), `QuestionCard`, `OptionChip`,
   `QuestionNavGrid`, `ProgressBar`, `SearchBox`, `RecordList`.
3. `MathText.tsx` — lift as-is into the site; it handles `$$...$$`,
   `$...$`, `` ` ` `` and preserves `\n` as `<br/>`.
4. Tailwind `brand` palette (`#4f6bed` family) is a decent default; make
   it themeable via `theme.primaryColor` in `knowledge-test.config.json`.

### For Agent D (CLI + Skill)

1. The RL bank's `manifest.json` per module directory is a good pattern —
   surface it as an optional feature (`validate` can cross-check
   `manifest.totalCount` if a manifest exists).
2. The `docs/SYLLABUS.md` + `config/question-generation.yaml` pair is
   exactly the shape the Skill should teach — carry the pattern into the
   `Stage 2` / `Stage 4` prompts without copying the RL content.
3. The RL repo has **no** GitHub Actions workflow — deploy is
   README-only. The kit's `.github/workflows/deploy-content-site.yml`
   reusable workflow is a strict improvement worth advertising in the RL
   integration doc.

## What was NOT touched

- No file inside `../rl-question-base` was modified. All reads were
  read-only.
- No RL content, exports, review notes, or `node_modules` were copied
  into this repo.
