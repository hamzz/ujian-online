export type QuestionType = "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "essay";

export type AnswerKey = {
  correct?: string | string[] | boolean;
  mode?: "exact" | "keywords";
  keywords?: string[];
};

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function gradeAnswer(type: QuestionType, answerKey: AnswerKey, response: any): number {
  if (type === "essay") return 0;

  if (type === "multiple_choice") {
    return String(response) === String(answerKey.correct) ? 1 : 0;
  }

  if (type === "multiple_select") {
    const expected = new Set((answerKey.correct as string[] | undefined) || []);
    const actual = new Set((response as string[] | undefined) || []);
    if (expected.size !== actual.size) return 0;
    for (const value of expected) {
      if (!actual.has(value)) return 0;
    }
    return 1;
  }

  if (type === "true_false") {
    return Boolean(response) === Boolean(answerKey.correct) ? 1 : 0;
  }

  if (type === "short_answer") {
    const mode = answerKey.mode || "exact";
    const text = normalizeText(String(response || ""));
    if (mode === "exact") {
      return text === normalizeText(String(answerKey.correct || "")) ? 1 : 0;
    }
    const keywords = (answerKey.keywords || []).map(normalizeText);
    return keywords.length > 0 && keywords.every((key) => text.includes(key)) ? 1 : 0;
  }

  return 0;
}
