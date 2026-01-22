import { describe, expect, it } from 'bun:test';
import { computeGradeLetter, gradeAnswer } from '../src/utils/grading';

const question = (type: any, answer_key: any) => ({ type, answer_key });

it('grades multiple choice exact match', () => {
  expect(gradeAnswer(question('multiple_choice', { correct: 'A' }), { response: 'A' })).toBe(1);
  expect(gradeAnswer(question('multiple_choice', { correct: 'A' }), { response: 'B' })).toBe(0);
});

it('grades multiple select exact set match', () => {
  expect(
    gradeAnswer(question('multiple_select', { correct: ['A', 'B'] }), { response: ['B', 'A'] })
  ).toBe(1);
  expect(
    gradeAnswer(question('multiple_select', { correct: ['A', 'B'] }), { response: ['A'] })
  ).toBe(0);
});

it('grades short answer with keywords', () => {
  expect(
    gradeAnswer(
      question('short_answer', { correct: 'gravity', match: 'keywords', keywords: ['gravity', 'mass'] }),
      { response: 'Gravity depends on mass and distance.' }
    )
  ).toBe(1);
});

it('returns grade letters', () => {
  expect(computeGradeLetter(95)).toBe('A');
  expect(computeGradeLetter(82)).toBe('B');
  expect(computeGradeLetter(71)).toBe('C');
  expect(computeGradeLetter(60)).toBe('D');
  expect(computeGradeLetter(59)).toBe('E');
});
