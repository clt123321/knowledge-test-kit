# RL Question Base — Comprehensive Inventory & Migration Analysis

Repository: `/Users/chenglitao/Desktop/work_project/rl-question-base`
Project name (internal): `posttrain-exam`, v0.1.0, MIT
Stated purpose (README): "极简、可开源的强化学习与大模型后训练选择题系统" — a minimal, pure-frontend exam kit for RL / PPO / GRPO / LLM post-training / RL Systems knowledge self-testing.

---

## 1. `package.json`

- **name**: `posttrain-exam`
- **type**: `"module"` (ESM)
- **scripts**:
  - `dev`: `vite`
  - `build`: `tsc --noEmit && vite build`
  - `preview`: `vite preview`
  - `test`: `vitest run` ; `test:watch`: `vitest`
  - `validate:questions`: `tsx scripts/validate-questions.ts`
  - `generate:questions`: `tsx scripts/build-question-bank.ts`
  - `audit:questions`: `tsx scripts/audit-questions.ts`
  - `export:questions`: `tsx scripts/export-questions.ts`
  - `lint`: `tsc --noEmit`
- **dependencies**:
  - `react` ^18.3.1, `react-dom` ^18.3.1
  - `react-router-dom` ^6.26.2
  - `katex` ^0.16.11, `react-katex` ^3.0.1
  - `zod` ^3.23.8
- **devDependencies**:
  - Vite `^5.4.8`, `@vitejs/plugin-react` ^4.3.2
  - TypeScript `^5.6.2`, `tsx` ^4.19.1
  - Tailwind `^3.4.13`, `postcss` ^8.4.47, `autoprefixer` ^10.4.20
  - Vitest `^2.1.2`, `jsdom` ^25.0.1
  - `@testing-library/react` ^16.0.1, `@testing-library/jest-dom` ^6.5.0
  - `@types/node`, `@types/react`, `@types/react-dom`, `@types/katex`
  - `yaml` ^2.9.0 (used by generation config)

No linter beyond `tsc --noEmit`. No Prettier config committed.

---

## 2. Vite config (`vite.config.ts`)

```ts
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

- **base**: hard-coded `'./'` — relative, so it works on GitHub Pages under any sub-path without env-var wiring.
- **plugins**: only `@vitejs/plugin-react`.
- **aliases**: `@` → `./src`.
- **test config** is inline (Vite + Vitest fused, no separate `vitest.config`).

---

## 3. TypeScript config (`tsconfig.json`)

- `strict: true`, `noFallthroughCasesInSwitch: true`
- `noUnusedLocals: false`, `noUnusedParameters: false` (relaxed)
- `moduleResolution: bundler`, `jsx: react-jsx`, `resolveJsonModule: true`, `allowImportingTsExtensions: true`
- `types`: `["vitest/globals", "@testing-library/jest-dom"]`
- Paths: `"@/*": ["src/*"]`
- Includes: `src`, `tests`, `scripts`, `vite.config.ts`

Single tsconfig; no split app/node/tests configs.

---

## 4. Entry point (`src/main.tsx`)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
```

`index.html` is trivial (Chinese lang, brand color `#4f6bed`, mounts `<div id="root">`, loads `/src/main.tsx`).

---

## 5. Router

- **Library**: `react-router-dom` v6 (`HashRouter` — chosen so GitHub Pages doesn't need URL rewrites).
- **Routes** (defined in `src/App.tsx`):
  - `/` → `HomePage`
  - `/exam` → `ExamPage`
  - `/result/:examId` → `ResultPage`
  - `/bank` → `QuestionBankPage`
  - `*` → inline "404" card with a link home
- Shared `<Header/>` and `<Footer/>` bracket the routes; header hides the top nav during `/exam`.
- App is wrapped in `<ExamProvider>` (see hooks below) so `ExamPage` can pick up the paper built by `HomePage`.

---

## 6. Pages

All under `src/pages/`.

- **`HomePage.tsx`** (376 lines):
  - Loads full bank via `getAllQuestions(settings.includeDraft)`.
  - Computes stats: total / single / multiple / #modules, per-module counts.
  - Three action cards: **综合考试** (comprehensive), **按专题练习** (per-module select), and the recent-records list.
  - Records section: list last 8 exam records, delete/clear/import/export JSON, "错题重做" per record.
  - Settings section: toggles `confidenceEnabled` and `includeDraft`.
  - Handles JSON records import (`replaceAllRecords`, reports `scoreCorrection` count).

- **`ExamPage.tsx`** (329 lines):
  - Reads `paper` from context; navigates home if none.
  - Local state: `currentIdx`, `answers`, `confidence`, `startedAt`.
  - `toggle(optionId)`: for `single` replaces the array; for `multiple` toggles membership then sorts.
  - Renders header (question index, answered count, max/pass score), question card (stem via `MathText`, options as buttons with icon `A/B/C/D`), optional confidence chips, and a `QuestionNav` grid of numbered buttons.
  - `submit()` computes score, persists `ExamRecord` (with scoring rules & questionTypes snapshot), then routes to result.
  - `abort()` clears the paper without saving.

- **`ResultPage.tsx`** (371 lines):
  - Looks up record by `examId`, loads bank so questions can be re-rendered.
  - Score summary card (score/maxScore, pass/fail, pass ratio %, duration, timestamps).
  - Actions: back home, "重做错题" (build retry-wrong paper), export JSON, export CSV (fields: `questionId, module, subtopic, difficulty, type, correctAnswer, userAnswer, correct, confidence`).
  - If `record.scoreCorrection` exists, shows an amber banner explaining the on-the-fly legacy rescore.
  - Detail list per question: option cells colored green (correct), rose (picked-wrong), tags for "正确答案 / 你的选择", explanation + `optionExplanations[opt.id]`, `misconceptionTags`, `source` links.
  - "仅看错题" checkbox filter.

- **`QuestionBankPage.tsx`** (352 lines):
  - Browse & filter the whole bank; filters: module, subtopic (dynamically populated), difficulty, type, `reviewStatus`, keyword search over stem/options/explanation/tags.
  - Draws validation-issue banner if `getRawValidationResult().ok === false`.
  - Each question card is expandable to show full explanation, per-option explanations, misconception tags, and source links.

---

## 7. Components

Only one shared component under `src/components/`:

- **`MathText.tsx`** — mini tokenizer that splits a string into `$$...$$` (block), `$...$` (inline) and plain text segments; plain-text segments additionally handle inline backtick-`code`. Delegates to `<InlineMath/>` and `<BlockMath/>` from `react-katex`, wrapped in try/catch that falls back to `<code>` on render error. Preserves `\n` as `<br/>`.
  - Note: option renderer, question card, nav grid, stat card, progress bar, "field" wrapper, etc. are NOT separate components — they are locally defined `function`s inside the page files. Migration to a component library is a real opportunity.

---

## 8. Hooks

Only one custom hook, under `src/hooks/`:

- **`ExamContext.tsx`** — React Context holding:
  - `paper: ExamPaper | null`, `setPaper`
  - `settings: AppSettings`, `updateSettings(partial)` (merges + persists via `saveSettings`).
  - `useExamContext()` throws if used outside provider.
  - `useEffect` on mount hydrates settings from `localStorage`.

No custom hooks for questions, storage, timing, or shuffling — pages call the lib functions directly.

---

## 9. Exam / 组卷 logic (`src/lib/exam.ts`)

Key exports:

```ts
export type ExamMode = 'comprehensive' | 'module' | 'retry-wrong';

export interface ExamPaper {
  questions: Question[];
  config: ExamConfig;
  mode: ExamMode;
  moduleId?: string;
  sourceExamId?: string;
  maxScore: number;
  passScore: number;
}
```

Builders:

- `buildComprehensivePaper(pool, config)`:
  - Splits pool by type; `sampleUnique(singles, singleCount)` + `sampleUnique(multiples, multipleCount)`.
  - Optionally shuffles the concatenated question list and each question's options.
  - Calls `finalizePaper` which invokes `configForActualQuestions` to recount by actual sampled questions and recomputes `maxScore` / `passScore` — so a smaller bank naturally produces a smaller paper without breaking scoring.
- `buildModulePaper(pool, moduleId, config)`: filters `q.module === moduleId`, then same shuffle/sample as above (with `Math.min(count, available)`).
- `buildRetryWrongPaper(pool, wrongQuestionIds, sourceExamId, config)`: filters by ID set, no sampling; records `sourceExamId` and `mode = 'retry-wrong'`.

Utilities:

- `configForActualQuestions(questions, config)` overrides `singleCount`/`multipleCount` to actual counts.
- `withOptionShuffle(q, shouldShuffle)` returns a shallow-cloned question with `options` shuffled.

Algorithms: Fisher–Yates (see §12), no dedup by subtopic, no weighting by `difficulty`, no seeding.

---

## 10. Scoring logic (`src/lib/exam.ts` + `src/lib/config.ts`)

`ExamConfig` (from `config.ts`):

```ts
export const DEFAULT_EXAM_CONFIG: ExamConfig = {
  singleCount: 40,
  multipleCount: 20,
  singleScore: 2,
  multipleScore: 3,
  passRatio: 0.6,
  shuffleQuestions: true,
  shuffleOptions: true,
  includeDraftInDev: false,
};

export function computeMaxScore(cfg) {
  return cfg.singleCount * cfg.singleScore + cfg.multipleCount * cfg.multipleScore;
}
export function computePassScore(cfg) {
  return Math.ceil(computeMaxScore(cfg) * cfg.passRatio);
}
```

Rules:

- **Single choice**: 2 points, all-or-nothing (`isAnswerCorrect` uses set equality via `sameSet`).
- **Multiple choice**: 3 points, all-or-nothing — no partial credit. Missed / extra / wrong / blank → 0.
- **Dynamic max score**: `scorePaper` always calls `configForActualQuestions(paper.questions, paper.config)` — never trusts the theoretical `singleCount`/`multipleCount`. Example (from tests): `10 × 2 + 4 × 3 = 32`, pass = `ceil(32*0.6) = 20`.
- **Pass threshold**: 60%, `Math.ceil`. Configurable per exam via `passRatio` in ExamConfig.
- **Result**: `ExamScoreResult` returns `score / maxScore / passScore / passed / singleCorrect / singleTotal / multipleCorrect / multipleTotal / details[]`, where each detail has `{ questionId, type, correct, earned, fullScore, userAnswer, correctAnswer }`.

Legacy score correction: `storage.deriveExamRecordScore` uses `record.scoringRules` (or `DEFAULT_EXAM_CONFIG`) plus a `questionTypes` map to recompute score/maxScore/pass at read time — never rewrites the raw record. Persists an audit blob in `scoreCorrection.original`.

---

## 11. Storage (localStorage) (`src/lib/storage.ts`)

Keys:

- `posttrain-exam:records:v1` → `ExamRecord[]` (list; new records `unshift`ed; capped at 200).
- `posttrain-exam:settings:v1` → `AppSettings`.

`ExamRecord` (major fields):

```ts
{
  examId, mode, moduleId?, sourceExamId?,
  startedAt, submittedAt,
  questionIds: string[],
  answers: { [qid]: string[] },     // user selections per question
  confidence: { [qid]: 'low'|'medium'|'high' },
  score, maxScore, passScore, passed,
  singleCorrect, singleTotal, multipleCorrect, multipleTotal,
  wrongQuestionIds: string[],       // ← the wrong-question tracker
  scoringVersion?: number,          // CURRENT_SCORING_VERSION = 2
  scoringRules?: { singleScore, multipleScore, passRatio },
  questionTypes?: { [qid]: 'single'|'multiple' },
  scoreCorrection?: {               // derived, only when legacy mismatch detected
    reason: 'legacy_score_metadata_mismatch',
    original: { score, maxScore, passScore, passed }
  }
}
```

`AppSettings`:

```ts
export const DEFAULT_SETTINGS = { confidenceEnabled: false, includeDraft: false };
```

**Wrong-question tracking**: derived at submit time by `scorePaper`, stored inline on the record as `wrongQuestionIds`. `HomePage.retryWrong(record)` builds a retry paper from those IDs. There is no cross-exam "wrong pool" / SRS / interval logic — wrong tracking is per-exam only.

**Confidence tracking**: `low` / `medium` / `high` per question, stored per record; doesn't affect score, only shown in Result page as a tag. Opt-in via settings.

Import/export: JSON only, `downloadBlob` → `posttrain-exam-records-YYYY-MM-DD.json`.

`safeGet`/`safeSet` wrap `localStorage` in try/catch (quota / privacy modes).

---

## 12. Random / shuffle utilities (`src/lib/random.ts`)

Full file:

```ts
export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function sampleUnique<T>(arr, n, rand = Math.random): T[] {
  return shuffle(arr, rand).slice(0, Math.min(n, arr.length));
}
export function uuid(): string { /* crypto.randomUUID || v4 fallback */ }
```

- Algorithm: **Fisher–Yates** in place on a clone.
- **Seedable in principle** (accepts a custom `rand: () => number`), but nothing in the app passes a seed — always uses `Math.random`. No PRNG constructor helper.

---

## 13. Question loader / content loading (`src/lib/questions.ts`)

- Uses **Vite `import.meta.glob`** with `eager: true, import: 'default'` to statically bundle every `src/data/questions/**/questions-*.json` into the app bundle at build time:

```ts
const rawModules = import.meta.glob(
  '@/data/questions/**/questions-*.json',
  { eager: true, import: 'default' },
) as Record<string, unknown>;
```

- All files are concatenated (arrays flattened, single objects pushed as one), then validated with `validateQuestions`. Result is **cached** in module scope (`cachedResult`).
- `getAllQuestions(includeDraft=false)` throws with a preview of validation issues on failure — good UX for a broken bank at dev time.
- `filterActiveQuestions(questions, includeDraft=false)`: always drops `deprecated`; drops `draft` unless `includeDraft`.
- Node-side loader is `scripts/load.ts` (used by CLI scripts and Node tests) — walks the directory with `fs.readdirSync` recursively, parses each file, and runs the same `validateQuestions` from `src/lib/schema.ts`. Files must be named `questions-*.json`.

Files are **statically imported** into the browser bundle. No lazy loading, no async fetch, no network content source.

---

## 14. Schema / Question type (`src/lib/schema.ts`)

Central Zod-derived types. Actual TS (excerpted):

```ts
export const OptionSchema = z.object({
  id: z.string().regex(/^[A-Z]$/),   // single uppercase letter
  text: z.string().min(1),
});

export const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  note: z.string().optional(),
});

export const SourceRefSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['book','paper','official_docs','frontier_note']),
  tier: z.enum(['tier1','tier2','tier3']),
  chapter: z.string().optional(),
  section: z.string().optional(),
  equation: z.string().optional(),
  url: z.string().url().optional(),
  supports: z.string().min(1),
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['single','multiple']),
  module: z.enum(MODULE_IDS as [string, ...string[]]),
  subtopic: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),          // 1..5, mapped to L1..L5
  stem: z.string().min(1),
  options: z.array(OptionSchema).min(2),
  correctAnswers: z.array(z.string().regex(/^[A-Z]$/)).min(1),
  explanation: z.string().min(1),
  optionExplanations: z.record(z.string(), z.string()),  // must cover every option
  learningObjective: z.string().min(1).optional(),
  archetype: z.enum(ARCHETYPES).optional(),
  depth: z.enum(DEPTHS).optional(),
  claimType: z.enum(CLAIM_TYPES).optional(),
  sourceRefs: z.array(SourceRefSchema).default([]),
  misconceptionTags: z.array(z.string()).default([]),
  distractorRationales: z.record(z.string(), z.string()).default({}),
  source: z.array(SourceSchema).default([]),            // legacy compat
  generationBatch: z.string().min(1).optional(),
  reviewStatus: z.enum(REVIEW_STATUSES),                // draft|reviewed|deprecated
  version: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type Question = z.infer<typeof QuestionSchema>;
export type QuestionOption = z.infer<typeof OptionSchema>;
export type QuestionSource = z.infer<typeof SourceSchema>;
export type QuestionSourceRef = z.infer<typeof SourceRefSchema>;
```

`superRefine` cross-field rules:
- No duplicate option IDs.
- `single` → exactly 1 correct; `multiple` → 2 or 3 correct (a real domain choice — no 4-of-4).
- Every correct answer must be in `options`.
- Every option must have an `optionExplanations[optId]` (non-empty).
- `archetype === 'paper_design_intent'` requires a research-grade `claimType`.
- Non-`deprecated` questions must have `learningObjective`, `archetype`, `depth`, `claimType`, `sourceRefs.length > 0`, and a `distractorRationales` entry for every wrong option.
- `generationBatch` starting with `bank-400-` must have exactly 4 options and `reviewStatus in {draft,reviewed}`.

`validateQuestions(input)` returns `{ ok, questions, issues[] }` and adds an explicit **duplicate-ID** check on top of Zod.

---

## 15. Modules definition (`src/lib/modules.ts`)

```ts
export const MODULES = [
  { id: 'math_probability_optimization',   code: 'A', name: '数学、概率、随机逼近与优化' },
  { id: 'bandit_exploration',              code: 'B', name: '多臂老虎机、探索与利用' },
  { id: 'mdp_dynamic_programming',         code: 'C', name: 'MDP、价值函数与动态规划' },
  { id: 'mc_td_function_approximation',    code: 'D', name: 'Monte Carlo、TD、Eligibility Trace 与函数逼近' },
  { id: 'planning_model_based',            code: 'E', name: '规划、Dyna 与 Model-based RL' },
  { id: 'value_based_deep_rl',             code: 'F', name: 'Value-based 深度强化学习' },
  { id: 'policy_gradient_actor_critic',    code: 'G', name: 'Policy Gradient、Actor-Critic 与连续控制' },
  { id: 'trpo_ppo_importance_sampling',    code: 'H', name: 'TRPO、PPO 与重要性采样' },
  { id: 'imitation_offline_goal',          code: 'I', name: '模仿学习、离线 RL 与目标导向 RL' },
  { id: 'multi_agent',                     code: 'J', name: '多智能体强化学习与博弈基础' },
  { id: 'llm_post_training',               code: 'K', name: 'LLM 后训练基础' },
  { id: 'reward_verifier_credit',          code: 'L', name: 'Reward、Verifier、PRM 与 Credit Assignment' },
  { id: 'grpo_dapo_gspo',                  code: 'M', name: 'GRPO、DAPO、GSPO 与 Reasoning RL' },
  { id: 'sampling_data_evaluation',        code: 'N', name: 'Prompt、Sampling、数据工程与评测' },
  { id: 'rl_systems',                      code: 'O', name: 'RL Systems 与训练基础设施' },
  { id: 'agent_multimodal_frontier',       code: 'P', name: 'Agent、多模态与前沿研究判断' },
] as const;
```

Also declared: `MODULE_IDS`, `moduleName(id)`, `DIFFICULTY_LABELS` (`1..5 → 'L1 · 定义识记' … 'L5 · 研究判断'`), `REVIEW_STATUSES`, and enum tuples `ARCHETYPES` (7 archetypes: `precise_definition, concept_boundary, formula_mechanism, application_diagnosis, code_implementation, systems_dataflow, paper_design_intent`), `DEPTHS` (`textbook | implementation | research`), `CLAIM_TYPES` (11 values including `textbook_consensus, paper_established, official_implementation, author_stated, evidence_supported_inference, speculative_inference, frontier_note, engineering_observation, single_paper_result, internal_experiment, unverified_hypothesis`).

Modules are **hard-coded**; no way to define modules in data files. The Zod schema uses `z.enum(MODULE_IDS)` — a question with an unknown module fails validation.

---

## 16. JSON question bank layout on disk

Root: `src/data/questions/<NN>_<slug>/`

```
src/data/questions/
├── 01_math_probability_optimization/
│   ├── manifest.json
│   └── questions-01.json
├── 02_bandit_exploration/…
├── 03_mdp_dynamic_programming/…
├── 04_mc_td_function_approximation/
│   ├── manifest.json
│   ├── questions-01.json
│   └── questions-02.json
… (16 directories total, matching the 16 modules A–P)
├── 15_rl_systems/
│   ├── manifest.json
│   ├── questions-01.json
│   └── questions-02.json
└── 16_agent_multimodal_frontier/
```

Rules (enforced by `tests/question-bank.test.ts`):
- Exactly 16 directories.
- Every dir has a `manifest.json` **plus** one or more `questions-NN.json` (glob `questions-*.json`).
- Each `questions-*.json` is capped at **≤ 25 questions**.
- Sum of question counts across `questions-*.json` in a dir equals `manifest.totalCount`.

`manifest.json` fields (example, `08_trpo_ppo_importance_sampling`):

```json
{
  "module": "trpo_ppo_importance_sampling",
  "name": "TRPO、PPO 与重要性采样",
  "targetCount": 35,
  "existingCount": 5,
  "generatedCount": 30,
  "totalCount": 35,
  "subtopics": { "ppo_clip": 1, "old_policy_vs_reference": 1, … },
  "questionTypes": { "single": 23, "multiple": 12 },
  "archetypes": { "formula_mechanism": 11, "concept_boundary": 7, … },
  "difficulty": { "L1": 8, "L2": 5, "L3": 15, "L4": 5, "L5": 2 },
  "depth": { "textbook": 15, "research": 7, "implementation": 13 },
  "sourceDistribution": { "tier2:Proximal Policy Optimization Algorithms": 26, … },
  "reviewStatus": { "reviewed": 2, "draft": 33 },
  "generatedBatch": "bank-400-2026-07",
  "updatedAt": "2026-07-26"
}
```

Full sample of one question object (`PPO-CLIP-001` from `08_trpo_ppo_importance_sampling/questions-01.json`):

```json
{
  "id": "PPO-CLIP-001",
  "type": "single",
  "module": "trpo_ppo_importance_sampling",
  "subtopic": "ppo_clip",
  "difficulty": 3,
  "stem": "PPO 的 clipped surrogate 目标为 $L(\\theta)=\\mathbb{E}\\left[\\min\\bigl(r_t(\\theta)\\hat{A}_t,\\; \\mathrm{clip}(r_t(\\theta),1-\\epsilon,1+\\epsilon)\\hat{A}_t\\bigr)\\right]$，其中 $r_t(\\theta)=\\pi_\\theta(a_t\\mid s_t)/\\pi_{\\theta_\\mathrm{old}}(a_t\\mid s_t)$。关于该 clip 的正确理解是：",
  "options": [
    { "id": "A", "text": "clip 直接约束新旧策略在参数空间的距离，等价于对参数施加 $L_2$ 硬约束。" },
    { "id": "B", "text": "clip 通过 $\\min$ 操作，在 $\\hat{A}_t>0$ 时限制 ratio 向上超过 $1+\\epsilon$ 的收益，从而抑制过大更新；对负优势方向仍允许远离 clip 边界。" },
    { "id": "C", "text": "clip 是硬约束：一旦 ratio 越过 $1\\pm\\epsilon$，反向传播的梯度立即为 0，因此 PPO 保证 ratio 恒在此区间内。" },
    { "id": "D", "text": "clip 会将梯度按 $1+\\epsilon$ 缩放，起到调整学习率的作用。" }
  ],
  "correctAnswers": ["B"],
  "explanation": "正确答案：B。\n关键定义或机制：解释 PPO clipped surrogate 不是硬信赖域约束。\n推理步骤：…（完整多段中文解析）…\n来源具体支持：支持 PPO clipped surrogate 的定义和 pessimistic surrogate 动机。",
  "optionExplanations": {
    "A": "错误。clip 作用在 probability ratio 上，而非参数空间距离…",
    "B": "正确。这才是 clipped surrogate 的实际几何含义。",
    "C": "错误。ratio 可以自由取值…",
    "D": "错误。clip 不是对梯度做缩放…"
  },
  "misconceptionTags": ["ppo_clip_is_hard_constraint", "ppo_clip_scales_gradient"],
  "source": [
    { "title": "Proximal Policy Optimization Algorithms", "url": "https://arxiv.org/abs/1707.06347" }
  ],
  "reviewStatus": "reviewed",
  "version": 1,
  "createdAt": "2026-07-24",
  "updatedAt": "2026-07-24",
  "learningObjective": "解释 PPO clipped surrogate 不是硬信赖域约束。",
  "archetype": "formula_mechanism",
  "depth": "textbook",
  "claimType": "paper_established",
  "sourceRefs": [
    {
      "title": "Proximal Policy Optimization Algorithms",
      "type": "paper",
      "tier": "tier2",
      "url": "https://arxiv.org/abs/1707.06347",
      "supports": "支持 PPO clipped surrogate 的定义和 pessimistic surrogate 动机。"
    }
  ],
  "distractorRationales": {
    "A": "错误。clip 作用在 probability ratio 上…",
    "C": "错误。ratio 可以自由取值…",
    "D": "错误。clip 不是对梯度做缩放…"
  }
}
```

---

## 17. `exports/question-bank.json`

- **Exists.** Generated by `npm run export:questions` (`scripts/export-questions.ts`).
- **Shape**: a flat JSON array of Question objects (29,178 lines in the current export; array of 400 questions). It appears to be the same shape as the Question schema — no wrapper object.
- Companion exports in `exports/`: `question-bank.csv`, `question-review.md`, `question-audit.{json,md}`, `module-coverage.json`, `source-coverage.json`, `hands-on-rl-coverage.json`, `option-source-support-audit.json`, `option-template-audit.json`, `regeneration-audit.{json,md}`.
- Used at test time (`tests/question-bank.test.ts`) as an integrity check.

---

## 18. `reviewStatus` / review workflow

- **Statuses** (`REVIEW_STATUSES` in `modules.ts`): `'draft' | 'reviewed' | 'deprecated'`.
- **Filter semantics** (`filterActiveQuestions`):
  - `deprecated` → always excluded.
  - `draft` → excluded unless `includeDraft=true` (opt-in via user settings, meant for internal review).
  - `reviewed` → always included.
- Consumed by `getAllQuestions(includeDraft)`, which is called from `HomePage`, `ResultPage` and `QuestionBankPage` (`QuestionBankPage` fetches with `includeDraft=true` and re-filters in the UI so it can show a `reviewStatus` dropdown).
- The workflow encoded in README and `reviews/` is: LLM generates → `draft` → human review captured in `reviews/*` markdown → explicit promotion `draft → reviewed`. `deprecated` is retained in git for audit and never returns to the pool.

---

## 19. Build / deploy

- **Build**: `npm run build` runs `tsc --noEmit && vite build`. Output goes to `dist/` (present in repo; ~1.3 MB JS bundle `index-DriAv5SE.js`, ~1 CSS + KaTeX font files).
- **GitHub Pages**: `vite.config.ts` sets `base: './'` unconditionally — relative asset URLs work under any GH Pages sub-path; **no env-var-driven base derivation** and no `BASE_PATH` in scripts.
- Router uses `HashRouter`, so no need for a SPA fallback / 404 rewrite.
- README instructs: `npm run build` → push `dist/` to a `gh-pages` branch, or use `peaceiris/actions-gh-pages`. No GitHub Actions workflow file exists in the repo — deploy is described as manual.
- Vercel: recognised as Vite; `Build Command: npm run build`, `Output Directory: dist`.

---

## 20. KaTeX / formula rendering

- **Yes**, KaTeX is fully integrated.
- Libraries: `katex@^0.16.11` (styles) + `react-katex@^3.0.1` (components).
- CSS: `src/styles/index.css` starts with `@import 'katex/dist/katex.min.css';` — so KaTeX fonts (KaTeX_Main, KaTeX_Math, etc.) are bundled by Vite and end up as the many `KaTeX_*.woff2/woff/ttf` assets in `dist/assets/`.
- Custom TS shim: `src/types/react-katex.d.ts` (module declaration for `InlineMath`/`BlockMath`, since `react-katex` ships without types).
- Rendering wrapper: `src/components/MathText.tsx` — tokenises `$$…$$` (block) and `$…$` (inline), preserves newlines, and additionally supports inline `` `code` ``. Try/catch around each math render; on failure falls back to `<code>` so a broken LaTeX string never breaks the whole app.

---

## 21. CSS / styling

- **Tailwind CSS** v3.4.13 (with `autoprefixer` + `postcss`). `postcss.config.js` is standard.
- `tailwind.config.js`:
  - `content`: `./index.html`, `./src/**/*.{ts,tsx}`.
  - Extends `fontFamily.sans` with Apple/Windows CJK fallbacks (PingFang SC, Hiragino Sans GB, Microsoft YaHei).
  - Extends colors with a `brand` palette (`50 #f5f7ff`, `100 #e6ebff`, `500 #4f6bed`, `600 #3b55d9`, `700 #2e43b3`).
- `src/styles/index.css` defines Tailwind `@layer components` utilities: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.card`, `.tag` — the whole component "kit" is those five classes plus raw Tailwind utilities in JSX.
- **No dark mode / theme switching.** Only a single light theme. `body` gets `bg-slate-50 text-slate-900` from `index.html`.

---

## 22. Tests

- **Framework**: Vitest with `environment: 'jsdom'`, `@testing-library/jest-dom` (setup imports `'@testing-library/jest-dom/vitest'`).
- Test files (all under `tests/`):
  - `exam.test.ts` — `isAnswerCorrect` (single/multi/blank), `scorePaper` (all-correct, partial-multi, blank, 60% ceil, dynamic max score 27/32 → pass, pure-single, pure-multi), `buildComprehensivePaper` (no dup, small-bank re-count), `buildModulePaper`, `buildRetryWrongPaper`.
  - `schema.test.ts` — `QuestionSchema` positive/negative cases (good single/multi, wrong answer counts, missing option explanations, illegal difficulty/module/status, paper-design-intent claim requirement); `validateQuestions` duplicate-ID detection.
  - `storage.test.ts` — save/load/find/delete/clear/replaceAll ExamRecord; `deriveExamRecordScore` legacy correction (27/140 → 27/32) without touching raw localStorage; settings persistence.
  - `filter.test.ts` — `filterActiveQuestions` semantics.
  - `question-bank.test.ts` — Node-side load of the real bank; asserts 400 active questions, all `reviewed`, all with 4 options, 16 module dirs each with a manifest, sum of files == manifest.totalCount, `exports/question-bank.json` == 400 and `reviews/myflicker-review-package.json` == 371 generated draft questions.
  - `audit.test.ts` — quality-gate tests using `scripts/audit-questions.ts` (buildQuestionAudit, distractor similarity, meta-statement detection); consumes `reviews/regeneration-targets.json` + `repair-modified-ids.json`. Very RL-specific.
  - `round2-blind.test.ts`, `round2-heuristic-leakage.test.ts` — review round 2 gates (leakage / distractor heuristics).

Coverage: pure lib logic + Node-side bank/audit integrity. No React component tests despite `@testing-library/react` being installed.

---

## 23. Which code is RL-DOMAIN-COUPLED

Do NOT lift into a generic kit verbatim; abstract or drop.

- **`src/lib/modules.ts`** — the 16 hard-coded module tuples, `ARCHETYPES`, `DEPTHS`, `CLAIM_TYPES`, `DIFFICULTY_LABELS`. All RL-flavoured. In a generic kit these need to become data (config file) or a per-instance module registry.
- **`src/lib/schema.ts`** — Zod schema is generic-looking but:
  - Enums for `module`, `archetype`, `depth`, `claimType` are RL-specific (via `MODULE_IDS`, `ARCHETYPES`, …).
  - `SourceRefSchema.type = enum(['book','paper','official_docs','frontier_note'])` is academic-source flavoured.
  - `tier1|tier2|tier3` source tiering is an RL bank convention.
  - The `paper_design_intent` claim-type constraint and the `bank-400-` batch rule are hard-coded RL project conventions.
  - Multiple-choice must have 2 or 3 correct — a domain-editorial rule, not a generic requirement.
- **`src/data/questions/**`** — 400 RL/PPO/GRPO/LLM post-training questions. Content, not code, but obviously RL-only.
- **`scripts/build-question-bank.ts`, `scripts/question-content.ts`, `scripts/audit-questions.ts`, `scripts/generation-config.ts`, `scripts/export-questions.ts`, `scripts/review/*`, `config/question-generation.yaml`, `docs/SYLLABUS.md`, `docs/QUESTION_AUTHORING_GUIDE.md`, `references/*`, `reviews/*`, `exports/hands-on-rl-coverage.json`** — all RL-authoring pipeline.
- **`tests/question-bank.test.ts`** — asserts 400 active, 371 draft, etc. RL-specific numbers.
- **`tests/audit.test.ts`, `tests/round2-*.test.ts`** — audit/leakage tests over the RL bank.
- **README, project name `posttrain-exam`, brand copy "PostTrain Exam · 强化学习与大模型后训练选择题"**, footer label — all RL-branded.

None of the *runtime* code encodes an actual PPO/value-function/policy-gradient computation — the coupling is exclusively in strings/enums/content, which is exactly the surface that needs to be parameterised.

---

## 24. Which code is GENERIC and RE-USABLE (candidates for `packages/core`)

- **`src/lib/random.ts`** — pure Fisher–Yates `shuffle`, `sampleUnique`, `uuid`. Fully generic; already accepts an injected `rand`. Lift verbatim.
- **`src/lib/exam.ts`** — the `ExamPaper`, `ExamMode`, `UserAnswers`, `UserConfidence`, `QuestionScoreDetail`, `ExamScoreResult` types plus `buildComprehensivePaper`, `buildModulePaper`, `buildRetryWrongPaper`, `configForActualQuestions`, `isAnswerCorrect`, `scorePaper`, `withOptionShuffle`. Depends only on a `Question` shape with `{ id, type, module, options, correctAnswers }` — trivially abstractable to a `<TQuestion extends BaseQuestion>` generic or a struct interface. The dynamic max-score logic is a real feature worth keeping.
- **`src/lib/config.ts`** — `ExamConfig`, `computeMaxScore`, `computePassScore`. Generic.
- **`src/lib/utils.ts`** — `downloadBlob`, `toCsvRow`, `formatDate`, `formatDuration`. Generic.
- **`src/lib/storage.ts`** — localStorage record store with legacy score correction. Generic if you parameterise the `STORAGE_KEY` / `SETTINGS_KEY` prefix and let the Question-type map be provided. The `deriveExamRecordScore` pattern (correct at read time, never rewrite) is genuinely useful and worth preserving.
- **`src/lib/questions.ts`** — the `import.meta.glob(...)` loader is generic, but see §25 — for Astro islands the loader shape changes.
- **`src/components/MathText.tsx`** — generic KaTeX-in-markdown renderer, no RL content.
- **`src/hooks/ExamContext.tsx`** — generic React context for `paper + settings`.
- **Page layouts / interaction patterns** in `HomePage`, `ExamPage`, `ResultPage`, `QuestionBankPage` — the *shapes* (progress bar, question nav grid, expandable question card, filter bar) are generic; the *content* is RL-coupled but only via strings (Chinese copy) and module lists.
- **Test scaffolding** in `exam.test.ts`, `schema.test.ts` (structural cases), `storage.test.ts`, `filter.test.ts` — the pure-logic tests port cleanly once the schema is generalised.

---

## 25. Which code should be RE-IMPLEMENTED for the new kit

For a new Astro-islands era with different abstractions:

- **Router + entry point** (`main.tsx`, `App.tsx`, `HashRouter`). Astro handles routing at the file-system level; each page is a `.astro` file and interactive parts become React (or other framework) islands. Reimplement.
- **Page components** (`HomePage`, `ExamPage`, `ResultPage`, `QuestionBankPage`). Split into (a) static Astro layout markup and (b) small React islands: `<ExamRunner/>`, `<QuestionCard/>`, `<QuestionBankBrowser/>`, `<ResultDetail/>`, `<RecordList/>`, `<SettingsPanel/>`. The current pages are monolithic and mix data-fetching + state + inline sub-components (Stat, Field, ProgressBar, QuestionNav) — good opportunity to extract a real component library.
- **`ExamContext`** — with Astro islands you generally don't share React context across islands; use nano-stores / URL params / `localStorage` events / persisted stores instead. Reimplement.
- **`src/lib/questions.ts`** loader — `import.meta.glob` still works under Vite in Astro, but a better fit for Astro is `getCollection('questions')` with the content-collections API + a Zod schema. Reimplement (keeping the Zod schema from core).
- **`src/lib/schema.ts`** — keep the *shape*, but reimplement as a generic base schema in `packages/core` + a per-kit extension schema that plugs in domain enums (module IDs, archetypes, claim types). Drop the `bank-400-` and `paper_design_intent` rules from the base; they become optional plugins.
- **`src/lib/modules.ts`** — reimplement as a per-kit config (e.g. `kit.config.ts` or `modules.json`) supplied by the site, not hard-coded in the framework.
- **Styling** — Tailwind is still fine, but the current `.btn-*/.card/.tag` component classes are ad-hoc. In an Astro-islands era it's worth committing to a small primitive component set (Button, Card, Tag, StatTile, ProgressBar, OptionChip) in the core package with Tailwind classes.
- **Deploy config** — reimplement with a real `astro.config.mjs`, env-driven `base:` and a GitHub Actions workflow (the current repo has none).
- **Tests around bank integrity** (`question-bank.test.ts`, `audit.test.ts`, `round2-*`) — reimplement per-kit; the framework provides *helpers* (schema validation, manifest checker) but each kit brings its own quantitative gates.

---

## 26. Concrete migration map

| File / area | Verdict |
| --- | --- |
| `package.json` | `REIMPLEMENT` (new deps: Astro, Nanostores, no react-router). Keep KaTeX + Zod + Vitest + Tailwind. |
| `vite.config.ts` | `REIMPLEMENT` as `astro.config.mjs`; port `base` derivation from env. |
| `tsconfig.json` | `LIFT_AND_ADAPT` (Astro-compatible settings; add Astro types). |
| `tailwind.config.js` | `LIFT_AS_IS` (or `LIFT_AND_ADAPT` if renaming `brand` palette). |
| `postcss.config.js` | `LIFT_AS_IS`. |
| `index.html` | `REIMPLEMENT` (becomes `src/layouts/BaseLayout.astro`). |
| `src/main.tsx` | `SKIP` (Astro-native entry replaces it). |
| `src/App.tsx` | `SKIP` (routing → file-based). |
| `src/styles/index.css` | `LIFT_AND_ADAPT` (keep KaTeX import + component classes; move to `packages/ui`). |
| `src/hooks/ExamContext.tsx` | `REIMPLEMENT` as nano-store (`packages/core/stores/exam.ts`). |
| `src/components/MathText.tsx` | `LIFT_AS_IS` into `packages/ui` (React island). |
| `src/lib/schema.ts` | `LIFT_AND_ADAPT` — split into `baseSchema` (generic) in `packages/core` + `extendSchema()` for kit-specific enums; drop `bank-400-*` rule. |
| `src/lib/modules.ts` | `REIMPLEMENT` — turn into a per-kit config (JSON/TS), keep `DIFFICULTY_LABELS`/`ARCHETYPES`/`CLAIM_TYPES` as *examples*/defaults. |
| `src/lib/exam.ts` | `LIFT_AS_IS` (parameterise on `<TQuestion>`), place in `packages/core/exam`. |
| `src/lib/config.ts` | `LIFT_AS_IS` → `packages/core/config`. |
| `src/lib/random.ts` | `LIFT_AS_IS` → `packages/core/random`. Consider adding a seeded PRNG (mulberry32) helper. |
| `src/lib/storage.ts` | `LIFT_AND_ADAPT` — parameterise storage-key prefix; keep `deriveExamRecordScore` legacy correction pattern. |
| `src/lib/questions.ts` | `REIMPLEMENT` on top of Astro Content Collections; keep the `filterActiveQuestions` + `getAllQuestions` API. |
| `src/lib/utils.ts` | `LIFT_AS_IS` → `packages/core/utils`. |
| `src/pages/HomePage.tsx` | `REIMPLEMENT` (split: static Astro page + `<RecordList/>` + `<ExamStarter/>` islands). |
| `src/pages/ExamPage.tsx` | `REIMPLEMENT` as `<ExamRunner/>` React island; extract `<QuestionCard/>`, `<OptionButton/>`, `<QuestionNavGrid/>`, `<ProgressBar/>`, `<ConfidenceChips/>`. |
| `src/pages/ResultPage.tsx` | `REIMPLEMENT` (island + Astro layout); extract `<ScoreSummary/>`, `<QuestionResultCard/>`, `<ExportButtons/>`. |
| `src/pages/QuestionBankPage.tsx` | `REIMPLEMENT` as `<QuestionBankBrowser/>` island with the same filter set. |
| `src/types/env.d.ts` | `REIMPLEMENT` (Astro provides its own). |
| `src/types/react-katex.d.ts` | `LIFT_AS_IS` (until upstream ships types). |
| `src/data/questions/**` | `SKIP` (RL content stays in the RL kit; the new kit ships its own bank; the *directory convention* and manifest shape → `LIFT_AS_IS` as a schema doc). |
| `exports/*` | `SKIP` (produced by scripts; per-kit output). |
| `scripts/load.ts` | `LIFT_AND_ADAPT` (rename dir path; keep recursive walker). |
| `scripts/validate-questions.ts` | `LIFT_AND_ADAPT` (reuse validator; new CLI entry). |
| `scripts/build-question-bank.ts` | `SKIP` (RL bank generator — recreate per kit if wanted). |
| `scripts/question-content.ts` | `SKIP` (RL knowledge cards). |
| `scripts/audit-questions.ts` | `LIFT_AND_ADAPT` — generic audit primitives (`normalizedOptionSimilarity`, `detectMetaStatement`, position/length/difficulty distributions) can move to core; RL-specific gates stay per-kit. |
| `scripts/generation-config.ts` | `LIFT_AND_ADAPT` (YAML loader is generic; schema is RL). |
| `scripts/export-questions.ts` | `LIFT_AND_ADAPT` (CSV/JSON/MD exporter is generic). |
| `scripts/review/*.mjs` | `SKIP` (RL review workflow). |
| `config/question-generation.yaml` | `SKIP`. |
| `docs/SYLLABUS.md`, `docs/QUESTION_AUTHORING_GUIDE.md` | `SKIP` (RL-specific). |
| `references/*`, `reviews/*` | `SKIP`. |
| `tests/exam.test.ts` | `LIFT_AS_IS`. |
| `tests/schema.test.ts` | `LIFT_AND_ADAPT` (drop RL-specific enum values). |
| `tests/storage.test.ts` | `LIFT_AS_IS` (adjust storage-key prefix). |
| `tests/filter.test.ts` | `LIFT_AS_IS`. |
| `tests/question-bank.test.ts` | `LIFT_AND_ADAPT` (integrity helpers → core; per-kit numbers → per-kit tests). |
| `tests/audit.test.ts`, `tests/round2-*` | `SKIP` (RL-specific). |
| `tests/setup.ts` | `LIFT_AS_IS`. |
| `README.md`, `CONTRIBUTING.md`, `LICENSE` | `REIMPLEMENT`. |

---

## 27. README highlights

- **Positioning**: "极简、可开源的强化学习与大模型后训练选择题系统" — for self-testing RL / PPO / GRPO / LLM post-training / RL Systems.
- **Philosophy** (explicit):
  - Pure frontend — no backend, no DB, no user accounts.
  - Bank lives in JSON files under `src/data/questions/`, split per module.
  - Zod schema is the source of truth; `npm run validate:questions` is a one-liner check.
  - Bank content is authored under `docs/SYLLABUS.md`, `docs/QUESTION_AUTHORING_GUIDE.md`, and `config/question-generation.yaml` (module quotas, source tiers, bias controls, scoring rules).
  - Human review is captured in `reviews/**`; questions stay `draft` until explicitly promoted to `reviewed`.
  - Deploy targets are GitHub Pages (`base: './'`, `HashRouter`, `dist/` → `gh-pages`) and Vercel (auto-detect).
  - The roadmap explicitly rules out leaderboards, social, badges, user systems, and unrelated dashboards.
- **Quickstart**: `git clone` → `npm install` → `npm run dev` → `http://localhost:5173`.
- **Scripts** table: `dev`, `build`, `preview`, `test`, `generate:questions`, `validate:questions`, `audit:questions`, `export:questions`.
- **Exam modes**: comprehensive (max 40 single + 20 multi), per-module practice, wrong-question retry.
- **Scoring**: single 2 pts / multiple 3 pts / no partial credit / pass = ceil(60% of max) / max recomputed from actual sampled questions.
- **Add-a-question**: literal JSON template with every schema field, then `npm run validate:questions` + `npm run export:questions`.
- **Schema table** enumerates every core field (mirrored in §14 above).
- **Review-status semantics** documented: `draft` (dev-only), `reviewed` (formal exam), `deprecated` (retained in git only).
- **Screenshots** are placeholders (`docs/screenshots/{home,exam,result,bank}.png`).
- **Directory-structure diagram** at the bottom lists every top-level piece — matches the actual layout with no drift.

---

### Bottom-line abstraction picture

- The lift-and-shift target is **`src/lib/{exam,config,random,utils,storage}.ts` + `src/components/MathText.tsx` + `src/hooks/ExamContext.tsx`** — ~600 lines of purely mechanical exam/scoring/persistence/formula code, with almost no RL knowledge baked in. That's your `packages/core` seed.
- The one real domain-coupling in the *runtime* is the pair `modules.ts` + `schema.ts`'s enums. Split the schema into `baseQuestionSchema` (generic) + `extendQuestionSchema({moduleIds, archetypes, claimTypes, extraRules})` (per-kit) and this whole system becomes a topic-agnostic exam kit.
- Pages/routes are the Astro-islands rewrite; the RL bank + authoring pipeline stays in a separate repo (or a separate `apps/rl` inside the monorepo) and never leaks into core.
