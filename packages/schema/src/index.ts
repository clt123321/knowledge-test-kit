import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*  Review status                                                             */
/* -------------------------------------------------------------------------- */

/** Canonical, normalized review statuses used everywhere inside the kit. */
export const CANONICAL_REVIEW_STATUSES = [
  'draft',
  'agent_reviewed',
  'human_reviewed',
  'deprecated',
] as const;
export type ReviewStatus = (typeof CANONICAL_REVIEW_STATUSES)[number];

/**
 * Raw review status as it may appear inside a content repository.
 *
 * - `reviewed` is a legacy value used by early banks (e.g. `rl-question-base`)
 *   which is folded into `agent_reviewed` at load time.
 */
export const RAW_REVIEW_STATUSES = [
  'draft',
  'reviewed',
  'agent_reviewed',
  'human_reviewed',
  'deprecated',
] as const;
export type RawReviewStatus = (typeof RAW_REVIEW_STATUSES)[number];

export const ReviewStatusSchema = z.enum(RAW_REVIEW_STATUSES);

/** Statuses considered publicly serveable by default. */
export const DEFAULT_PUBLIC_STATUSES: ReviewStatus[] = [
  'agent_reviewed',
  'human_reviewed',
];

/** Statuses considered practice-eligible by default. */
export const DEFAULT_PRACTICE_STATUSES: ReviewStatus[] = [
  'agent_reviewed',
  'human_reviewed',
];

export function normalizeReviewStatus(raw: string): ReviewStatus {
  switch (raw) {
    case 'draft':
    case 'agent_reviewed':
    case 'human_reviewed':
    case 'deprecated':
      return raw;
    case 'reviewed':
      return 'agent_reviewed';
    default:
      return 'draft';
  }
}

/* -------------------------------------------------------------------------- */
/*  Question option                                                           */
/* -------------------------------------------------------------------------- */

export const OptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});
export type QuestionOption = z.infer<typeof OptionSchema>;

/* -------------------------------------------------------------------------- */
/*  Source references                                                         */
/* -------------------------------------------------------------------------- */

export const LegacySourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  note: z.string().optional(),
});
export type LegacySource = z.infer<typeof LegacySourceSchema>;

export const SourceRefSchema = z.object({
  title: z.string().min(1),
  type: z
    .enum(['book', 'paper', 'official_docs', 'frontier_note', 'other'])
    .default('other'),
  tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  chapter: z.string().optional(),
  section: z.string().optional(),
  equation: z.string().optional(),
  url: z.string().url().optional(),
  supports: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

/* -------------------------------------------------------------------------- */
/*  Question                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The base, domain-agnostic question schema.
 *
 * All content banks — RL, ML compiler, quant trade, or a fresh generic
 * bank — validate against this. Per-bank extensions can be built with
 * `extendQuestionSchema()` below.
 */
export const BaseQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['single', 'multiple']),
    module: z.string().min(1),
    subtopic: z.string().optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    stem: z.string().min(1),
    options: z.array(OptionSchema).min(2),
    correctAnswers: z.array(z.string().min(1)).min(1),
    explanation: z.string().min(1),
    optionExplanations: z.record(z.string(), z.string()).default({}),
    learningObjective: z.string().optional(),
    archetype: z.string().optional(),
    depth: z.string().optional(),
    claimType: z.string().optional(),
    sourceRefs: z.array(SourceRefSchema).default([]),
    misconceptionTags: z.array(z.string()).default([]),
    distractorRationales: z.record(z.string(), z.string()).default({}),
    source: z.array(LegacySourceSchema).default([]),
    generationBatch: z.string().optional(),
    reviewStatus: ReviewStatusSchema,
    version: z.number().int().min(1).default(1),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    const optionIds = q.options.map((o) => o.id);
    const dupOpt = optionIds.filter(
      (id, i) => optionIds.indexOf(id) !== i,
    );
    if (dupOpt.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate option id(s): ${dupOpt.join(', ')}`,
        path: ['options'],
      });
    }

    if (q.type === 'single' && q.correctAnswers.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `single-choice questions must have exactly 1 correct answer, got ${q.correctAnswers.length}`,
        path: ['correctAnswers'],
      });
    }
    if (q.type === 'multiple' && q.correctAnswers.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `multiple-choice questions must have at least 2 correct answers, got ${q.correctAnswers.length}`,
        path: ['correctAnswers'],
      });
    }

    for (const answer of q.correctAnswers) {
      if (!optionIds.includes(answer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctAnswers contains unknown option id "${answer}"`,
          path: ['correctAnswers'],
        });
      }
    }
  });

export type Question = z.infer<typeof BaseQuestionSchema>;

/**
 * Build a stricter, per-bank schema by narrowing the free-form enums.
 */
export interface ExtendQuestionSchemaOptions {
  moduleIds?: readonly string[];
  archetypes?: readonly string[];
  depths?: readonly string[];
  claimTypes?: readonly string[];
  /** Require every option to have a matching `optionExplanations[optionId]`. */
  requireOptionExplanations?: boolean;
  /** Require every non-deprecated question to have >=1 sourceRefs. */
  requireSourceRefs?: boolean;
}

export function extendQuestionSchema(opts: ExtendQuestionSchemaOptions = {}) {
  return BaseQuestionSchema.superRefine((q, ctx) => {
    if (opts.moduleIds && !opts.moduleIds.includes(q.module)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unknown module "${q.module}"; expected one of ${opts.moduleIds.join(', ')}`,
        path: ['module'],
      });
    }
    if (opts.archetypes && q.archetype && !opts.archetypes.includes(q.archetype)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unknown archetype "${q.archetype}"`,
        path: ['archetype'],
      });
    }
    if (opts.depths && q.depth && !opts.depths.includes(q.depth)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unknown depth "${q.depth}"`,
        path: ['depth'],
      });
    }
    if (opts.claimTypes && q.claimType && !opts.claimTypes.includes(q.claimType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unknown claimType "${q.claimType}"`,
        path: ['claimType'],
      });
    }
    if (opts.requireOptionExplanations) {
      for (const opt of q.options) {
        if (!q.optionExplanations || !q.optionExplanations[opt.id]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `missing optionExplanations["${opt.id}"]`,
            path: ['optionExplanations', opt.id],
          });
        }
      }
    }
    if (
      opts.requireSourceRefs &&
      q.reviewStatus !== 'deprecated' &&
      (!q.sourceRefs || q.sourceRefs.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sourceRefs must be non-empty for non-deprecated questions',
        path: ['sourceRefs'],
      });
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Module                                                                    */
/* -------------------------------------------------------------------------- */

export const ModuleSchema = z.object({
  id: z.string().min(1),
  code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().optional(),
});
export type Module = z.infer<typeof ModuleSchema>;

/* -------------------------------------------------------------------------- */
/*  Reference (book / paper / official docs)                                  */
/* -------------------------------------------------------------------------- */

export const ReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['book', 'paper', 'official_docs', 'frontier_note', 'other']),
  authors: z.array(z.string()).optional(),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  isbn: z.string().optional(),
  arxivId: z.string().optional(),
  summary: z.string().optional(),
  tier: z.enum(['tier1', 'tier2', 'tier3']).optional(),
  tags: z.array(z.string()).optional(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

/* -------------------------------------------------------------------------- */
/*  Knowledge-test.config.json                                                */
/* -------------------------------------------------------------------------- */

export const SiteConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  language: z.string().default('zh-CN'),
  repository: z.string().optional(),
  publicUrl: z.string().default(''),
  logo: z.string().nullable().optional(),
});

export const ContentConfigSchema = z.object({
  questionGlobs: z.array(z.string()).default(['questions/**/*.json']),
  referenceGlobs: z
    .array(z.string())
    .default(['references/**/*.{json,md}']),
  syllabusGlobs: z.array(z.string()).default(['syllabus/**/*.md']),
  moduleFile: z.string().default('modules.json'),
});

export const ReviewConfigSchema = z.object({
  publicStatuses: z
    .array(z.enum(CANONICAL_REVIEW_STATUSES))
    .default([...DEFAULT_PUBLIC_STATUSES]),
  practiceStatuses: z
    .array(z.enum(CANONICAL_REVIEW_STATUSES))
    .default([...DEFAULT_PRACTICE_STATUSES]),
});

export const ExamConfigSchema = z.object({
  singleScore: z.number().default(2),
  multipleScore: z.number().default(3),
  passingRatio: z.number().min(0).max(1).default(0.6),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  defaultSingleCount: z.number().int().min(0).default(20),
  defaultMultipleCount: z.number().int().min(0).default(10),
});

export const ThemeConfigSchema = z.object({
  primaryColor: z.string().default(''),
  darkMode: z.boolean().default(true),
});

export const KnowledgeTestConfigSchema = z.object({
  schemaVersion: z.string().default('1.0.0'),
  site: SiteConfigSchema,
  content: ContentConfigSchema.default({
    questionGlobs: ['questions/**/*.json'],
    referenceGlobs: ['references/**/*.{json,md}'],
    syllabusGlobs: ['syllabus/**/*.md'],
    moduleFile: 'modules.json',
  }),
  review: ReviewConfigSchema.default({
    publicStatuses: [...DEFAULT_PUBLIC_STATUSES],
    practiceStatuses: [...DEFAULT_PRACTICE_STATUSES],
  }),
  exam: ExamConfigSchema.default({
    singleScore: 2,
    multipleScore: 3,
    passingRatio: 0.6,
    shuffleQuestions: true,
    shuffleOptions: true,
    defaultSingleCount: 20,
    defaultMultipleCount: 10,
  }),
  theme: ThemeConfigSchema.default({
    primaryColor: '',
    darkMode: true,
  }),
});
export type KnowledgeTestConfig = z.infer<typeof KnowledgeTestConfigSchema>;
export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type ContentConfig = z.infer<typeof ContentConfigSchema>;
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;
export type ExamConfig = z.infer<typeof ExamConfigSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

/* -------------------------------------------------------------------------- */
/*  Validation helpers                                                        */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  path: string;
  message: string;
  questionId?: string;
  file?: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  items: T[];
  issues: ValidationIssue[];
}

export function validateQuestions(
  input: unknown[],
  schema: typeof BaseQuestionSchema | ReturnType<typeof extendQuestionSchema> = BaseQuestionSchema,
): ValidationResult<Question> {
  const questions: Question[] = [];
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  input.forEach((raw, i) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const err of parsed.error.errors) {
        issues.push({
          path: `[${i}].${err.path.join('.')}`,
          message: err.message,
          questionId:
            (raw as { id?: string } | null | undefined)?.id ?? undefined,
        });
      }
      return;
    }
    const q = parsed.data as Question;
    if (seenIds.has(q.id)) {
      issues.push({
        path: `[${i}].id`,
        message: `duplicate question id "${q.id}"`,
        questionId: q.id,
      });
      return;
    }
    seenIds.add(q.id);
    questions.push(q);
  });

  return { ok: issues.length === 0, items: questions, issues };
}
