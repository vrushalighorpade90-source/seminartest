import type { Question } from '../types';

export interface ShuffledOptionView {
  text: string;
  originalOptionIndex: number;
}

export interface ShuffledQuestionView {
  originalQuestionIndex: number;
  id: string;
  questionText: string;
  options: ShuffledOptionView[];
}

/**
 * Unbiased cryptographically random integer in [0, maxExclusive - 1].
 * Falls back to Math.random() if Web Crypto is unavailable.
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const arr = new Uint32Array(1);
    let rand = 0;
    do {
      globalThis.crypto.getRandomValues(arr);
      rand = arr[0];
    } while (rand >= limit);
    return rand % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Unbiased Fisher-Yates shuffle returning a new array.
 */
export function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Generates an independent randomized order of both questions AND options
 * for each individual student session while tracking canonical indices
 * so server-side grading and question-wise review remain 100% accurate.
 */
export function buildShuffledStudentQuestions(questions: Question[]): ShuffledQuestionView[] {
  const indexedQuestions: ShuffledQuestionView[] = (questions || []).map((q, originalQuestionIndex) => {
    const indexedOptions: ShuffledOptionView[] = (q.options || []).map((text, originalOptionIndex) => ({
      text,
      originalOptionIndex,
    }));

    return {
      originalQuestionIndex,
      id: q.id,
      questionText: q.questionText,
      options: fisherYatesShuffle(indexedOptions),
    };
  });

  return fisherYatesShuffle(indexedQuestions);
}

/**
 * Converts a student's selected answers (keyed by shuffled display question index
 * and shuffled display option index) back to canonical question/option indices
 * matching test.questions on the backend.
 */
export function mapShuffledAnswersToCanonical(
  displayAnswers: Record<number, number>,
  shuffledQuestions: ShuffledQuestionView[]
): Record<number, number> {
  const canonical: Record<number, number> = {};
  for (const [dispQIdxStr, dispOptIdx] of Object.entries(displayAnswers || {})) {
    const dispQIdx = parseInt(dispQIdxStr, 10);
    const qView = shuffledQuestions[dispQIdx];
    if (qView && typeof dispOptIdx === 'number' && qView.options[dispOptIdx]) {
      canonical[qView.originalQuestionIndex] = qView.options[dispOptIdx].originalOptionIndex;
    }
  }
  return canonical;
}
