export type Role = 'admin' | 'teacher' | 'student';

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'
  | 'essay';

export type AnswerKey =
  | { correct: string }
  | { correct: string[] }
  | { correct: boolean }
  | { correct: string; match?: 'exact' | 'keywords'; keywords?: string[] }
  | { rubric: string };

export type ExamSettings = {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  perPage?: 'single' | 'all';
  attempts?: number;
  timerMode?: 'countdown' | 'countup';
  autoSubmit?: boolean;
  showExplanation?: 'never' | 'always' | 'wrong_only';
  simpleAccess?: {
    enabled?: boolean;
    requireClass?: boolean;
  };
  antiCheat?: {
    fullscreen?: boolean;
    blockCopy?: boolean;
    autoSubmitOnCheat?: boolean;
  };
};

export type UserPayload = {
  id: string;
  username: string;
  email?: string | null;
  role: Role;
};
