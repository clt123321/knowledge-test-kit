import type { Question } from '@knowledge-test/schema';
import { normalizeReviewStatus, type ReviewStatus } from '@knowledge-test/schema';

export interface FilterOptions {
  /** Only include questions whose normalized status is in this set. */
  allowedStatuses?: readonly ReviewStatus[];
  /** Include drafts even if not in `allowedStatuses` (dev mode). */
  includeDraft?: boolean;
  /** Restrict to a specific module. */
  moduleId?: string;
  /** Restrict to a specific subtopic. */
  subtopic?: string;
  /** Restrict to specific difficulty levels. */
  difficulties?: readonly number[];
  /** Restrict to a question type. */
  type?: 'single' | 'multiple';
  /** Case-insensitive substring search over stem / options / explanation / tags. */
  keyword?: string;
}

const DEFAULT_ALLOWED: ReviewStatus[] = ['agent_reviewed', 'human_reviewed'];

export function filterQuestions(
  questions: readonly Question[],
  opts: FilterOptions = {},
): Question[] {
  const allowed = new Set<ReviewStatus>(opts.allowedStatuses ?? DEFAULT_ALLOWED);
  const kw = opts.keyword?.trim().toLowerCase() ?? '';

  return questions.filter((q) => {
    const norm = normalizeReviewStatus(q.reviewStatus);
    if (norm === 'deprecated') return false;
    if (norm === 'draft' && !opts.includeDraft) return false;
    if (!allowed.has(norm) && !(norm === 'draft' && opts.includeDraft)) return false;
    if (opts.moduleId && q.module !== opts.moduleId) return false;
    if (opts.subtopic && q.subtopic !== opts.subtopic) return false;
    if (opts.type && q.type !== opts.type) return false;
    if (opts.difficulties && q.difficulty != null && !opts.difficulties.includes(q.difficulty))
      return false;

    if (kw) {
      const hay =
        q.stem.toLowerCase() +
        ' ' +
        q.options.map((o) => o.text).join(' ').toLowerCase() +
        ' ' +
        (q.explanation ?? '').toLowerCase() +
        ' ' +
        (q.misconceptionTags ?? []).join(' ').toLowerCase() +
        ' ' +
        (q.subtopic ?? '').toLowerCase();
      if (!hay.includes(kw)) return false;
    }

    return true;
  });
}

export function statusDistribution(
  questions: readonly Question[],
): Record<ReviewStatus, number> {
  const dist: Record<ReviewStatus, number> = {
    draft: 0,
    agent_reviewed: 0,
    human_reviewed: 0,
    deprecated: 0,
  };
  for (const q of questions) {
    dist[normalizeReviewStatus(q.reviewStatus)]++;
  }
  return dist;
}
