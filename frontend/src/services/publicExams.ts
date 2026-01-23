import { apiFetch } from '../api';

export type StartSimpleExamPayload = {
  name: string;
  class_name: string;
  exam_key: string;
};

export const startPublicExam = (payload: StartSimpleExamPayload) =>
  apiFetch<{ session_id: string }>('/public/exams/start', {
    method: 'POST',
    body: JSON.stringify({ ...payload, exam_key: payload.exam_key.trim().toUpperCase() })
  });
