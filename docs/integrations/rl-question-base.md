# Integration plan — `../rl-question-base`

This document describes how to plug the existing RL post-training question
bank into `knowledge-test-kit` without modifying the RL repo's content.

## Current state (as of the initial audit)

- Layout: **`rl-legacy`** — questions live at
  `src/data/questions/<NN>_<slug>/questions-*.json`, one `manifest.json`
  per module directory, 16 modules.
- Aggregate: 400 questions, all `reviewStatus: "reviewed"` (which the
  kit normalises to `agent_reviewed`).
- `exports/question-bank.json` — flat array of the same 400 questions.
- Front-end: Vite + React + `HashRouter` + Tailwind, `base: './'`. No
  GitHub Actions workflow; deployment is manual via
  `peaceiris/actions-gh-pages`.
- Custom scripts: `validate-questions`, `build-question-bank`,
  `audit-questions`, `export-questions`, `reviews/*`.

## What the kit does out of the box

- Auto-detects the `rl-legacy` layout — no config file needed.
- Normalises `reviewed` → `agent_reviewed` at load time.
- Reads the per-module `manifest.json` files to infer module names.
- Renders every question at a stable URL:
  `/rl-question-base/questions/<QID>/`.
- Ships the practice mode with `bankId: rl-question-base`.

Verified locally with `node packages/cli/bin/knowledge-test.mjs validate
--content ../rl-question-base`.

## Recommended additions to `../rl-question-base`

Two files, both non-invasive:

1. `knowledge-test.config.json`:

   ```json
   {
     "schemaVersion": "1.0.0",
     "site": {
       "id": "rl-question-base",
       "title": "PostTrain Exam · 强化学习与大模型后训练选择题",
       "description": "极简、可开源的强化学习与大模型后训练选择题系统",
       "language": "zh-CN",
       "repository": "clt123321/rl-question-base"
     },
     "content": {
       "questionGlobs": ["src/data/questions/**/questions-*.json"],
       "referenceGlobs": ["references/**/*.{json,md}"],
       "syllabusGlobs": ["docs/*.md"],
       "moduleFile": ""
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
       "defaultSingleCount": 40,
       "defaultMultipleCount": 20
     },
     "theme": { "primaryColor": "#4f6bed", "darkMode": true }
   }
   ```

2. `.github/workflows/pages.yml` — the standard reusable-workflow snippet
   (see `docs/DEPLOYMENT.md`).

Everything else — including the existing `src/**` React app — can stay in
place. When ready, delete the following once you're satisfied with the
kit-rendered site:

- `src/` (the whole SPA)
- `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
- `dist/` (pre-committed build output)
- React-only dependencies from `package.json`

Keep:

- `src/data/questions/**` — the actual content
- `references/`, `reviews/`
- `scripts/` — if you still want the legacy audit / export scripts
- `docs/SYLLABUS.md`, `docs/QUESTION_AUTHORING_GUIDE.md`

## Publishing

Once the two files above are committed and Pages is switched to GitHub
Actions, every push to `main` will re-build and deploy the site at
`https://clt123321.github.io/rl-question-base/`.

## Migration risks

- `HashRouter` links (`/#/exam`, `/#/bank`) will not exist in the new
  site; if you had bookmarks, migrate them to `/questions/<id>/` /
  `/practice/`.
- The RL project's `exports/question-bank.json` is not consumed by the
  kit (which prefers the raw JSON tree), but leaving it in place is
  harmless.
- The RL project used a custom score-correction record migration
  (`deriveExamRecordScore`); the kit reimplements the same semantics but
  under a **different** `localStorage` key (`knowledge-test:rl-question-base:*`
  vs `posttrain-exam:*`). Old records from the SPA will **not** appear in
  the new site — advertise this if user records matter to you.
