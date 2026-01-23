import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import type { UserPayload } from '../types';
import { authGuard } from '../utils/helpers';
import { createTeacherService } from '../services/teacher.service';

type Deps = { db?: DatabaseContext };

export const registerTeacherRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createTeacherService({ db });

  app.group('/teacher', (teacher) =>
    teacher
      .guard(authGuard(['teacher', 'admin']))
      .get('/subjects', async () => {
        return service.listSubjects();
      })
      .post('/subjects', async ({ body, set }) => {
        const payload = body as { name: string };
        if (!payload.name) {
          set.status = 400;
          return { error: 'Subject name required' };
        }
        return service.createSubject(payload.name);
      })
      .put('/subjects/:id', async ({ params, body }) => {
        const payload = body as { name?: string };
        await service.updateSubject(params.id, payload.name);
        return { success: true };
      })
      .delete('/subjects/:id', async ({ params }) => {
        await service.deleteSubject(params.id);
        return { success: true };
      })
      .post('/import/questions', async ({ body, set, user }) => {
        const payload = body as { csv: string; subject_id?: string };
        if (!payload.csv) {
          set.status = 400;
          return { error: 'CSV required' };
        }
        const result = await service.importQuestions(payload, (user as UserPayload).id);
        if (result.inserted === 0) {
          set.status = 400;
          return { error: 'CSV empty' };
        }
        return result;
      })
      .get('/export/questions', async ({ query: queryParams, set }) => {
        const csv = await service.exportQuestions(queryParams as Record<string, string>);
        set.headers['content-type'] = 'text/csv';
        return csv;
      })
      .get('/questions', async ({ query: queryParams }) => {
        return service.listQuestions(queryParams as Record<string, string>);
      })
      .post('/questions', async ({ body, set, user }) => {
        const payload = body as any;
        if (!payload.subject_id || !payload.type || !payload.content || !payload.answer_key) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        return service.createQuestion(payload, (user as UserPayload).id);
      })
      .post('/questions/bulk-delete', async ({ body, set }) => {
        const payload = body as { ids: string[] };
        if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
          set.status = 400;
          return { error: 'ids required' };
        }
        await service.bulkDeleteQuestions(payload.ids);
        return { success: true };
      })
      .put('/questions/:id', async ({ params, body }) => {
        const payload = body as any;
        await service.updateQuestion(params.id, payload);
        return { success: true };
      })
      .delete('/questions/:id', async ({ params }) => {
        await service.deleteQuestion(params.id);
        return { success: true };
      })
      .get('/exams', async ({ query: queryParams }) => {
        return service.listExams(queryParams as Record<string, string>);
      })
      .post('/exams', async ({ body, set, user }) => {
        const payload = body as any;
        if (!payload.title || !payload.subject_id || !payload.duration_minutes) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        return service.createExam(payload, (user as UserPayload).id);
      })
      .get('/exams/:id', async ({ params }) => {
        const exam = await service.getExam(params.id);
        if (!exam) return { error: 'Not found' };
        return exam;
      })
      .get('/exams/:id/results', async ({ params }) => {
        return service.getExamResults(params.id);
      })
      .get('/exams/:id/results.csv', async ({ params, set }) => {
        const csv = await service.getExamResultsCsv(params.id);
        set.headers['content-type'] = 'text/csv';
        return csv;
      })
      .put('/exams/:id', async ({ params, body }) => {
        await service.updateExam(params.id, body as any);
        return { success: true };
      })
      .delete('/exams/:id', async ({ params }) => {
        await service.deleteExam(params.id);
        return { success: true };
      })
      .post('/exams/bulk-delete', async ({ body, set }) => {
        const payload = body as { ids: string[] };
        if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
          set.status = 400;
          return { error: 'ids required' };
        }
        await service.bulkDeleteExams(payload.ids);
        return { success: true };
      })
      .get('/essay-submissions', async () => {
        return service.listEssaySubmissions();
      })
      .put('/essay-submissions/:sessionId/:questionId', async ({ params, body }) => {
        await service.gradeEssay(params.sessionId, params.questionId, body as any);
        return { success: true };
      })
  );

  return app;
};
