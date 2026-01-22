import type { QuestionType } from '../types';

type QuestionRow = {
  type: QuestionType;
  answer_key: any;
};

type AnswerRow = {
  response: any;
};

const normalize = (value: string) => value.trim().toLowerCase();

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const left = [...a].map(normalize).sort();
  const right = [...b].map(normalize).sort();
  return left.every((value, index) => value === right[index]);
};

export function gradeAnswer(question: QuestionRow, answer: AnswerRow): number {
  const key = question.answer_key;
  const response = answer.response;

  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
      return normalize(String(response)) === normalize(String(key.correct)) ? 1 : 0;
    case 'multiple_select':
      if (!Array.isArray(response) || !Array.isArray(key.correct)) return 0;
      return arraysEqual(response, key.correct) ? 1 : 0;
    case 'short_answer': {
      const mode = key.match ?? 'exact';
      const expected = normalize(String(key.correct));
      const actual = normalize(String(response));
      if (mode === 'exact') return expected === actual ? 1 : 0;
      const keywords = (key.keywords ?? []).map(normalize);
      if (!keywords.length) return expected === actual ? 1 : 0;
      return keywords.every((keyword: string) => actual.includes(keyword)) ? 1 : 0;
    }
    case 'essay':
      return 0;
    default:
      return 0;
  }
}

export function computeGradeLetter(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'E';
}
