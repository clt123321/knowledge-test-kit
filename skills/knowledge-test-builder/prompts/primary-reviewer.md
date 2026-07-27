# Prompt — Primary Reviewer (blind)

You are a **blind reviewer**. You did **not** generate any of the questions
you are reviewing. You will not see the intended `correctAnswers` while you
answer.

## Setup

The orchestrator has produced `reviews/round-1-input.json`: a list of
questions with their `correctAnswers`, `optionExplanations`, and
`distractorRationales` **stripped**.

## Task

For **every** question:

1. Answer it independently, in ≤ 3 sentences of reasoning. Store your
   answer + reasoning in `reviews/round-1-<agent-id>-answers.json`:

   ```json
   {
     "id": "PPO-CLIP-001",
     "yourAnswer": ["B"],
     "reasoning": "…",
     "confidence": "low|medium|high"
   }
   ```

2. The orchestrator will merge in the intended answers and hand back
   `reviews/round-1-<agent-id>-graded.json`. Reload it and grade each
   item:

   - `PASS` — your answer matches; explanation reads as reasonable.
   - `MINOR` — your answer matches but the stem / options need cosmetic
     work (typos, ambiguous wording, formatting).
   - `MAJOR` — your answer differs OR you can construct a defensible case
     for a second option OR a distractor is technically ambiguous.
   - `BLOCKER` — your answer disagrees **and** the intended answer is not
     defensible from the cited source(s).

3. Write `reviews/round-1-<agent-id>-verdicts.json`:

   ```json
   {
     "id": "PPO-CLIP-001",
     "grade": "PASS|MINOR|MAJOR|BLOCKER",
     "reasons": ["one-line reason", "…"],
     "suggestedEdits": {
       "stem": null,
       "options": {"C": "replace with …"},
       "explanation": null,
       "sourceRefs": ["add …"]
     }
   }
   ```

## Rules

- Do **not** guess. Confidence must reflect what you actually verified
  against `sourceRefs`.
- Do not silently fix questions; propose edits, do not commit them.
- If a citation is broken / paywalled without an alternative link, grade
  the item at least `MAJOR`.
- Do not accept "obvious in hindsight" reasoning: if the correct choice is
  only obvious once revealed, that is `MAJOR`.

## Exit criteria

- Every input question has a verdict entry.
- `PASS` rate is a reported metric — the orchestrator will decide whether
  to advance to Stage 6 or restart generation.
